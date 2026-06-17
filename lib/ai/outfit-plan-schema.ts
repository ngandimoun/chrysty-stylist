import { z } from "zod";
import { MAX_PIECES_PER_LOOK } from "@/lib/chrysty/look-count-constants";

export const PERCEIVED_PRESENTATION_OPTIONS = [
  "masculine",
  "feminine",
  "androgynous",
  "child",
  "unknown",
] as const;

export const perceivedPresentationSchema = z.enum(PERCEIVED_PRESENTATION_OPTIONS);

export const subjectAssignmentSchema = z.object({
  bodyRefIndex: z.number().int().min(0).max(4),
  perceivedPresentation: perceivedPresentationSchema,
  personLabel: z.string().min(1),
  wardrobeItemIds: z.array(z.string()),
  assignmentReasoning: z.string().min(1),
});

export const outfitLookPlanSchema = z.object({
  lookIndex: z.number().int().min(1),
  styleDirection: z.string().min(1),
  stylingReasoning: z.string().min(1),
  itemReasoning: z.string().min(1),
  wardrobeItemIds: z.array(z.string()).min(1).max(MAX_PIECES_PER_LOOK),
  rationale: z.string().min(1),
  vibe: z.string().min(1),
  occasionTag: z.string().min(1),
  imagePrompt: z.string().optional(),
  isStylistPick: z.boolean().optional(),
  subjectAssignments: z.array(subjectAssignmentSchema).optional(),
});

export const outfitPlanSchema = z.object({
  planningReasoning: z.string().min(1),
  looks: z.array(outfitLookPlanSchema).min(1).max(7),
  assistantMessage: z.string().min(1),
});

export type OutfitPlan = z.infer<typeof outfitPlanSchema>;
export type OutfitLookPlan = z.infer<typeof outfitLookPlanSchema>;
export type SubjectAssignment = z.infer<typeof subjectAssignmentSchema>;
export type PerceivedPresentation = z.infer<typeof perceivedPresentationSchema>;

const GARMENT_WORDS =
  /\b(tuxedo|jacket|blazer|dress|skirt|trouser|pants|shirt|tie|shoe|wearing|outfit|coat|blouse|heel|sneaker|bow)\b/i;

function nonEmptyString(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

function looksLikeOutfitDescription(value: string): boolean {
  return value.length > 40 || /^wearing\b/i.test(value) || GARMENT_WORDS.test(value);
}

export function coercePerceivedPresentation(raw: unknown): PerceivedPresentation {
  if (typeof raw !== "string") return "unknown";
  const trimmed = raw.trim();
  if (!trimmed) return "unknown";

  const lower = trimmed.toLowerCase();
  const exact = PERCEIVED_PRESENTATION_OPTIONS.find((value) => value === lower);
  if (exact) return exact;

  if (looksLikeOutfitDescription(trimmed)) return "unknown";

  if (/\b(child|kid|boy|girl)\b/i.test(lower)) return "child";
  if (/\b(woman|female|feminine|her)\b/i.test(lower)) return "feminine";
  if (/\b(androgynous|non-?binary)\b/i.test(lower)) return "androgynous";
  if (/\b(man|male|masculine|him)\b/i.test(lower)) return "masculine";

  return "unknown";
}

function coerceBodyRefIndex(raw: unknown): number {
  if (typeof raw === "number" && Number.isFinite(raw)) {
    return Math.max(0, Math.min(4, Math.floor(raw)));
  }
  if (typeof raw === "string" && raw.trim() !== "") {
    const parsed = Number(raw);
    if (Number.isFinite(parsed)) return Math.max(0, Math.min(4, Math.floor(parsed)));
  }
  return 0;
}

function coerceSubjectAssignment(
  raw: unknown,
  fallbackWardrobeIds: string[]
): SubjectAssignment | null {
  if (!raw || typeof raw !== "object") return null;
  const entry = raw as Record<string, unknown>;

  const rawPresentation = typeof entry.perceivedPresentation === "string" ? entry.perceivedPresentation : "";
  const perceivedPresentation = coercePerceivedPresentation(entry.perceivedPresentation);

  let assignmentReasoning = nonEmptyString(entry.assignmentReasoning, "");
  if (
    rawPresentation &&
    perceivedPresentation === "unknown" &&
    looksLikeOutfitDescription(rawPresentation) &&
    assignmentReasoning.length < 10
  ) {
    assignmentReasoning = rawPresentation;
  }
  if (!assignmentReasoning) {
    assignmentReasoning = "Assigned based on the look photo and wardrobe pieces.";
  }

  const personLabel = nonEmptyString(entry.personLabel, "the person");
  const wardrobeItemIds = Array.isArray(entry.wardrobeItemIds)
    ? entry.wardrobeItemIds.filter((id): id is string => typeof id === "string")
    : fallbackWardrobeIds;

  return {
    bodyRefIndex: coerceBodyRefIndex(entry.bodyRefIndex),
    perceivedPresentation,
    personLabel,
    wardrobeItemIds,
    assignmentReasoning,
  };
}

function coerceSubjectAssignments(
  raw: unknown,
  fallbackWardrobeIds: string[],
  bodyRefCount?: number
): SubjectAssignment[] | undefined {
  if (bodyRefCount !== undefined && bodyRefCount <= 1) return undefined;
  if (!Array.isArray(raw)) return undefined;

  const assignments = raw
    .map((entry) => coerceSubjectAssignment(entry, fallbackWardrobeIds))
    .filter((entry): entry is SubjectAssignment => entry !== null);

  return assignments.length > 0 ? assignments : undefined;
}

function coerceLook(raw: unknown, idx: number, bodyRefCount?: number) {
  const look = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const { subjectAssignments: rawSubjectAssignments, ...lookRest } = look;
  const lookNumber = idx + 1;

  const rationale = nonEmptyString(look.rationale, "A balanced look from your wardrobe.");
  const stylingReasoning = nonEmptyString(
    look.stylingReasoning,
    nonEmptyString(look.rationale, "Styled from your confirmed pieces.")
  );
  const itemReasoning = nonEmptyString(look.itemReasoning, stylingReasoning);

  const lookIndex =
    typeof look.lookIndex === "number" && look.lookIndex >= 1
      ? Math.floor(look.lookIndex)
      : lookNumber;

  const wardrobeItemIds = Array.isArray(look.wardrobeItemIds)
    ? look.wardrobeItemIds.filter((id): id is string => typeof id === "string")
    : [];

  const subjectAssignments = coerceSubjectAssignments(
    rawSubjectAssignments,
    wardrobeItemIds,
    bodyRefCount
  );

  return {
    ...lookRest,
    lookIndex,
    styleDirection: nonEmptyString(look.styleDirection, `Look ${lookNumber}`),
    stylingReasoning,
    itemReasoning,
    wardrobeItemIds,
    rationale,
    vibe: nonEmptyString(look.vibe, "Clean and effortless"),
    occasionTag: nonEmptyString(look.occasionTag, "Today"),
    ...(typeof look.imagePrompt === "string" ? { imagePrompt: look.imagePrompt } : {}),
    ...(typeof look.isStylistPick === "boolean" ? { isStylistPick: look.isStylistPick } : {}),
    ...(subjectAssignments ? { subjectAssignments } : {}),
  };
}

export type CoerceOutfitPlanOptions = {
  bodyRefCount?: number;
};

export function coerceOutfitPlan(raw: unknown, options?: CoerceOutfitPlanOptions): unknown {
  if (!raw || typeof raw !== "object") return raw;

  const obj = raw as Record<string, unknown>;
  if (!Array.isArray(obj.looks)) return raw;

  const bodyRefCount = options?.bodyRefCount;
  const looks = obj.looks.map((look, idx) => coerceLook(look, idx, bodyRefCount));
  const hasPick = looks.some((look) => look.isStylistPick === true);
  if (!hasPick && looks.length > 0) {
    looks[0] = { ...looks[0], isStylistPick: true };
  }

  return {
    ...obj,
    planningReasoning: nonEmptyString(
      obj.planningReasoning,
      "Planned looks from your wardrobe and request."
    ),
    assistantMessage: nonEmptyString(
      obj.assistantMessage,
      "Here's what I'd put together from your closet."
    ),
    looks,
  };
}

export function parseOutfitPlan(raw: unknown, options?: CoerceOutfitPlanOptions): OutfitPlan {
  return outfitPlanSchema.parse(coerceOutfitPlan(raw, options));
}
