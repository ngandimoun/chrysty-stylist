import { z } from "zod";
import { MAX_PIECES_PER_LOOK } from "@/lib/chrysty/look-count-constants";

export const perceivedPresentationSchema = z.enum([
  "masculine",
  "feminine",
  "androgynous",
  "child",
  "unknown",
]);

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

function nonEmptyString(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

function coerceLook(raw: unknown, idx: number) {
  const look = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
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

  return {
    ...look,
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
    ...(Array.isArray(look.subjectAssignments)
      ? { subjectAssignments: look.subjectAssignments }
      : {}),
  };
}

export function coerceOutfitPlan(raw: unknown): unknown {
  if (!raw || typeof raw !== "object") return raw;

  const obj = raw as Record<string, unknown>;
  if (!Array.isArray(obj.looks)) return raw;

  const looks = obj.looks.map((look, idx) => coerceLook(look, idx));
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

export function parseOutfitPlan(raw: unknown): OutfitPlan {
  return outfitPlanSchema.parse(coerceOutfitPlan(raw));
}
