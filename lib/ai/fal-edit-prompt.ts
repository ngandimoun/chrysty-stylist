import { GoogleGenAI, Type } from "@google/genai";
import { getModelConfig, requireGeminiApiKey, isGeminiConfigured } from "@/lib/config/models";
import {
  falEditPromptSchema,
  type CraftFalEditPromptInput,
  type FalEditPrompt,
  type StyledImageLayout,
} from "@/lib/ai/fal-edit-prompt-schema";
import { generateLog } from "@/lib/chrysty/generate-debug";
import { buildFalRenderPromptSuffix, FAL_FULL_BODY_RULES } from "@/lib/chrysty/fal-render-rules";

const GEMINI_TIMEOUT_MS = 90_000;

const VALID_CROP_ZONES = new Set(["upper_torso", "mid_outfit", "lower_legs", "feet"]);

function normalizeFalPrompt(raw: unknown): unknown {
  if (!raw || typeof raw !== "object") return raw;
  const record = { ...(raw as Record<string, unknown>) };

  const sceneType = record.sceneType;
  if (typeof sceneType === "string" && !["solo", "couple", "family", "group"].includes(sceneType)) {
    record.sceneType = "solo";
  }

  if (Array.isArray(record.imageIndexMap)) {
    record.imageIndexMap = record.imageIndexMap.map((entry) => {
      if (!entry || typeof entry !== "object") return entry;
      const mapEntry = { ...(entry as Record<string, unknown>) };
      if (mapEntry.role === "body") mapEntry.role = "user_look";
      if (mapEntry.role === "wardrobe") mapEntry.role = "wardrobe_reference";
      return mapEntry;
    });
  }

  if (record.styledImageLayout && typeof record.styledImageLayout === "object") {
    const layout = { ...(record.styledImageLayout as Record<string, unknown>) };
    if (layout.mode !== "hero_only" && layout.mode !== "detail_insets") {
      layout.mode = "hero_only";
    }
    if (Array.isArray(layout.insets)) {
      const seenZones = new Set<string>();
      layout.insets = layout.insets
        .filter((entry) => entry && typeof entry === "object")
        .map((entry) => ({ ...(entry as Record<string, unknown>) }))
        .filter((entry) => {
          const zone = entry.cropZone;
          if (typeof zone !== "string" || !VALID_CROP_ZONES.has(zone) || seenZones.has(zone)) {
            return false;
          }
          seenZones.add(zone);
          return typeof entry.focusLabel === "string" && typeof entry.reasoning === "string";
        })
        .slice(0, 3);
    } else {
      layout.insets = [];
    }
    if (layout.mode === "hero_only") layout.insets = [];
    if (layout.mode === "detail_insets" && (layout.insets as unknown[]).length === 0) {
      layout.mode = "hero_only";
    }
    record.styledImageLayout = layout;
  }

  return record;
}

let client: GoogleGenAI | null = null;

function getClient() {
  if (!client) client = new GoogleGenAI({ apiKey: requireGeminiApiKey() });
  return client;
}

async function fetchImageInlinePart(url: string, label: string) {
  const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new Error(`Failed to fetch ${label} image (${res.status})`);
  const mimeType = res.headers.get("content-type")?.split(";")[0]?.trim() || "image/jpeg";
  const buffer = Buffer.from(await res.arrayBuffer());
  return { inlineData: { mimeType, data: buffer.toString("base64") } };
}

function buildFallbackStyledImageLayout(input: CraftFalEditPromptInput): StyledImageLayout {
  const bodyCount = input.bodyRefs.length;
  if (bodyCount > 1) {
    return { mode: "hero_only", insets: [] };
  }

  const msg = input.stylingMessage.toLowerCase();
  const itemFocused =
    /\b(shoe|sneaker|boot|heel|blazer|jacket|coat|accessory|bag|watch|detail|highlight|show the|see the)\b/.test(
      msg
    );

  if (itemFocused) {
    const insets: StyledImageLayout["insets"] = [];
    if (/\b(shoe|sneaker|boot|heel|foot|feet)\b/.test(msg)) {
      insets.push({
        cropZone: "feet",
        focusLabel: "footwear",
        reasoning: "User request highlights shoes or feet.",
      });
    }
    if (/\b(blazer|jacket|coat|shirt|top|blouse)\b/.test(msg)) {
      insets.push({
        cropZone: "upper_torso",
        focusLabel: "upper outfit",
        reasoning: "User request highlights the top or jacket.",
      });
    }
    if (/\b(trouser|pant|skirt|bottom)\b/.test(msg)) {
      insets.push({
        cropZone: "lower_legs",
        focusLabel: "lower outfit",
        reasoning: "User request highlights bottoms.",
      });
    }
    if (insets.length > 0) {
      return { mode: "detail_insets", insets: insets.slice(0, 3) };
    }
  }

  return { mode: "hero_only", insets: [] };
}

function buildFallbackPrompt(input: CraftFalEditPromptInput): FalEditPrompt {
  const { look, bodyRefs, wardrobePieces, stylingMessage } = input;
  const bodyCount = bodyRefs.length;
  const wardrobeOffset = bodyCount;

  const subjectStyling =
    look.subjectAssignments?.map((s) => ({
      bodyRefIndex: s.bodyRefIndex,
      personLabel: s.personLabel,
      perceivedPresentation: s.perceivedPresentation,
      wardrobeItemIds: s.wardrobeItemIds,
      layeringNotes: s.assignmentReasoning,
    })) ?? [
      {
        bodyRefIndex: 0,
        personLabel: "the user",
        perceivedPresentation: "unknown" as const,
        wardrobeItemIds: look.wardrobeItemIds,
        layeringNotes: "Apply wardrobe items in logical layering order.",
      },
    ];

  const wardrobeLabels = wardrobePieces
    .map((w, i) => `image ${wardrobeOffset + i + 1} (${w.description})`)
    .join(", ");

  const editPrompt =
    look.imagePrompt ??
    [
      `User request: ${stylingMessage}.`,
      bodyCount === 1
        ? `Image 1 is the user's look photo. Dress this person using wardrobe references: ${wardrobeLabels}.`
        : `Images 1-${bodyCount} are the user's look reference photos. Preserve every face and identity. Dress each person using the correct wardrobe items.`,
      look.styleDirection,
      look.rationale,
      FAL_FULL_BODY_RULES,
      "Photorealistic. Only change clothing. Do not swap outfits between people.",
    ].join(" ");

  const imageIndexMap = [
    ...bodyRefs.map((b, i) => ({
      index: i,
      role: "user_look" as const,
      bodyRefId: b.id,
      label: `Look photo ${i + 1} (${b.referenceType})`,
    })),
    ...wardrobePieces.map((w, i) => ({
      index: wardrobeOffset + i,
      role: "wardrobe_reference" as const,
      wardrobeItemId: w.id,
      label: w.description,
    })),
  ];

  return falEditPromptSchema.parse({
    editPrompt,
    primaryLookImageIndex: 0,
    imageIndexMap,
    subjectStyling,
    assignmentValidation: look.wardrobeItemIds.map((id) => ({
      bodyRefIndex: subjectStyling[0]?.bodyRefIndex ?? 0,
      wardrobeItemId: id,
      isValid: true,
    })),
    preserveInstructions:
      "Preserve face, skin tone, hair, body shape, pose, and background for every person. Do not generate new people.",
    sceneType: bodyCount > 2 ? "family" : bodyCount === 2 ? "couple" : "solo",
    styledImageLayout: buildFallbackStyledImageLayout(input),
  });
}

export async function craftFalEditPromptWithGemini(
  input: CraftFalEditPromptInput
): Promise<FalEditPrompt> {
  if (!isGeminiConfigured()) return buildFallbackPrompt(input);

  const cfg = getModelConfig();
  const model = cfg.gemini.outfitPlan || "gemini-3.5-flash";
  const bodyCount = input.bodyRefs.length;
  const wardrobeOffset = bodyCount;

  const bodyParts = (
    await Promise.all(
      input.bodyRefs.map(async (b) => [
        { text: `Look reference index=${b.index} id=${b.id} type=${b.referenceType}:` },
        await fetchImageInlinePart(b.imageUrl, `look-${b.index}`),
      ])
    )
  ).flat();

  const wardrobeParts = (
    await Promise.all(
      input.wardrobePieces.map(async (w) => [
        {
          text: `Wardrobe item id=${w.id} sort=${w.sortIndex} category=${w.category ?? "item"} | ${w.description}:`,
        },
        await fetchImageInlinePart(w.imageUrl, `wardrobe-${w.id}`),
      ])
    )
  ).flat();

  const planJson = JSON.stringify(
    {
      styleDirection: input.look.styleDirection,
      stylingReasoning: input.look.stylingReasoning,
      itemReasoning: input.look.itemReasoning,
      imagePrompt: input.look.imagePrompt,
      wardrobeItemIds: input.look.wardrobeItemIds,
      subjectAssignments: input.look.subjectAssignments,
    },
    null,
    2
  );

  const prompt = [
    `You craft image-edit prompts for virtual outfit styling.`,
    `User request: "${input.stylingMessage}"`,
    ``,
    `IMAGE ORDER for the edit API:`,
    `- Indices 0..${bodyCount - 1}: user's look photos (THE people to dress — never replace them).`,
    `- Indices ${wardrobeOffset}..${wardrobeOffset + input.wardrobePieces.length - 1}: wardrobe closet items in plan order.`,
    ``,
    `TASK:`,
    `1. Analyze each look photo — identify man, woman, child, group positions from VISUAL cues.`,
    `2. Analyze each wardrobe item — infer intended wearer (masculine/feminine/unisex/child).`,
    `3. Validate subjectAssignments from the plan — flag gender/fit mismatches (e.g. skirt on masculine person).`,
    `4. Fix invalid assignments: reassign to correct person or mark isValid=false.`,
    `5. Choose primaryLookImageIndex — the photo Fal edits (group shot with all subjects, or main person).`,
    `6. Write editPrompt using 1-based image numbers, naming people clearly ("the man", "the woman").`,
    `7. Include: preserve all faces/identities; only change clothing; do not swap outfits between people.`,
    `8. Framing: ${FAL_FULL_BODY_RULES}`,
    `9. styledImageLayout — decide final image post-processing (no text overlays on output):`,
    `   - mode "hero_only": full-body hero + watermark only. Use for couple/family/group, face-only refs, vibe/occasion requests ("date night in Paris"), or when the full look is enough.`,
    `   - mode "detail_insets": full-body hero PLUS up to 3 small inset zooms. Use for solo shots when distinct pieces deserve a close-up (shoes, blazer texture, accessory) OR user explicitly asks to highlight an item.`,
    `   - NEVER use detail_insets for couple, family, or group — cropping faces looks wrong.`,
    `   - inset cropZone: upper_torso | mid_outfit | lower_legs | feet. No duplicate zones. Avoid tight face crops.`,
    ``,
    `Look plan JSON:`,
    planJson,
    ``,
    `Return JSON matching the schema.`,
  ].join("\n");

  generateLog("fal_prompt_gemini_start", {
    model,
    bodyRefs: bodyCount,
    wardrobePieces: input.wardrobePieces.length,
  });

  try {
    const response = await getClient().models.generateContent({
      model,
      contents: [{ role: "user", parts: [{ text: prompt }, ...bodyParts, ...wardrobeParts] }],
      config: {
        temperature: 0.2,
        responseMimeType: "application/json",
        abortSignal: AbortSignal.timeout(GEMINI_TIMEOUT_MS),
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            editPrompt: { type: Type.STRING },
            primaryLookImageIndex: { type: Type.INTEGER },
            imageIndexMap: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  index: { type: Type.INTEGER },
                  role: { type: Type.STRING },
                  bodyRefId: { type: Type.STRING },
                  wardrobeItemId: { type: Type.STRING },
                  label: { type: Type.STRING },
                },
                required: ["index", "role", "label"],
              },
            },
            subjectStyling: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  bodyRefIndex: { type: Type.INTEGER },
                  personLabel: { type: Type.STRING },
                  perceivedPresentation: { type: Type.STRING },
                  wardrobeItemIds: { type: Type.ARRAY, items: { type: Type.STRING } },
                  layeringNotes: { type: Type.STRING },
                },
                required: [
                  "bodyRefIndex",
                  "personLabel",
                  "perceivedPresentation",
                  "wardrobeItemIds",
                  "layeringNotes",
                ],
              },
            },
            assignmentValidation: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  bodyRefIndex: { type: Type.INTEGER },
                  wardrobeItemId: { type: Type.STRING },
                  isValid: { type: Type.BOOLEAN },
                  mismatchReason: { type: Type.STRING },
                },
                required: ["bodyRefIndex", "wardrobeItemId", "isValid"],
              },
            },
            preserveInstructions: { type: Type.STRING },
            sceneType: { type: Type.STRING },
            styledImageLayout: {
              type: Type.OBJECT,
              properties: {
                mode: { type: Type.STRING },
                insets: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      cropZone: { type: Type.STRING },
                      focusLabel: { type: Type.STRING },
                      reasoning: { type: Type.STRING },
                    },
                    required: ["cropZone", "focusLabel", "reasoning"],
                  },
                },
              },
              required: ["mode", "insets"],
            },
          },
          required: [
            "editPrompt",
            "primaryLookImageIndex",
            "imageIndexMap",
            "subjectStyling",
            "assignmentValidation",
            "preserveInstructions",
            "sceneType",
            "styledImageLayout",
          ],
        },
      },
    });

    const parsed = falEditPromptSchema.parse(normalizeFalPrompt(JSON.parse(response.text ?? "{}")));
    generateLog("fal_prompt_gemini_done", {
      sceneType: parsed.sceneType,
      primaryLookImageIndex: parsed.primaryLookImageIndex,
      invalidAssignments: parsed.assignmentValidation.filter((v) => !v.isValid).length,
      styledImageLayout: parsed.styledImageLayout.mode,
      insetCount: parsed.styledImageLayout.insets.length,
    });
    return parsed;
  } catch (e) {
    generateLog("fal_prompt_gemini_fallback", {
      error: e instanceof Error ? e.message : String(e),
    });
    return buildFallbackPrompt(input);
  }
}

export function buildValidatedWardrobeIds(
  prompt: FalEditPrompt,
  allWardrobeIds: string[]
): string[] {
  const invalid = new Set(
    prompt.assignmentValidation.filter((v) => !v.isValid).map((v) => v.wardrobeItemId)
  );
  const fromSubjects = new Set(
    prompt.subjectStyling.flatMap((s) => s.wardrobeItemIds)
  );
  const valid = allWardrobeIds.filter((id) => !invalid.has(id) && fromSubjects.has(id));
  return valid.length > 0 ? valid : allWardrobeIds.filter((id) => !invalid.has(id));
}

export function hasBlockingValidationFailures(prompt: FalEditPrompt): boolean {
  const invalidCount = prompt.assignmentValidation.filter((v) => !v.isValid).length;
  const validItems = prompt.subjectStyling.flatMap((s) => s.wardrobeItemIds).length;
  return invalidCount > 0 && validItems === 0;
}
