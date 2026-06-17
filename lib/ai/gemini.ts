import { GoogleGenAI, Type } from "@google/genai";

import { getModelConfig, requireGeminiApiKey } from "@/lib/config/models";

import { parseOutfitPlan, PERCEIVED_PRESENTATION_OPTIONS, type OutfitPlan } from "@/lib/ai/outfit-plan-schema";

import { MAX_PIECES_PER_LOOK } from "@/lib/chrysty/look-count-constants";

import { buildOutfitPlanningRules, buildMultiPersonPlanningRules } from "@/lib/chrysty/outfit-planning-rules";

import type { WorkspaceProfile } from "@/lib/workspace/settings";

import { generateLog } from "@/lib/chrysty/generate-debug";
import { generateContentWithRetry } from "@/lib/ai/gemini-retry";



const GEMINI_TIMEOUT_MS = 120_000;



let client: GoogleGenAI | null = null;



function getClient() {

  if (!client) client = new GoogleGenAI({ apiKey: requireGeminiApiKey() });

  return client;

}



export type WardrobeCatalogItem = {

  id: string;

  imageUrl: string;

  mimeType: string;

  description?: string;

  category?: string | null;

  colors?: string[] | null;

};



export type BodyRef = {

  imageUrl: string;

  referenceType: string;

};



function wardrobeItemLabel(item: WardrobeCatalogItem): string {

  const category = item.category?.trim() || "item";

  const description = item.description?.trim() || "unknown";

  const colors = item.colors?.length ? item.colors.join(", ") : "n/a";

  return `Wardrobe item id=${item.id} | ${category} | ${description} | colors: ${colors}:`;

}



async function fetchImageInlinePart(url: string, label: string) {

  const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });

  if (!res.ok) {

    throw new Error(`Failed to fetch ${label} image (${res.status})`);

  }

  const mimeType = res.headers.get("content-type")?.split(";")[0]?.trim() || "image/jpeg";

  const buffer = Buffer.from(await res.arrayBuffer());

  return {

    inlineData: {

      mimeType,

      data: buffer.toString("base64"),

    },

  };

}



export async function planOutfitsWithGemini(params: {

  stylingMessage: string;

  lookCount: number;

  workspaceMission?: string;

  workspaceProfile?: WorkspaceProfile;

  workspaceStylingContext?: string;

  memoryJson?: string;

  bodyReferenceSummary?: string;

  bodyRefs: BodyRef[];

  wardrobeCatalog: WardrobeCatalogItem[];

}): Promise<OutfitPlan> {

  const cfg = getModelConfig();

  const model = cfg.gemini.outfitPlan || "gemini-3.5-flash";



  const wardrobeParts = (

    await Promise.all(

      params.wardrobeCatalog.map(async (w) => [

        { text: wardrobeItemLabel(w) },

        await fetchImageInlinePart(w.imageUrl, `wardrobe-${w.id}`),

      ])

    )

  ).flat();



  const bodyParts = (

    await Promise.all(

      params.bodyRefs.map(async (b, idx) => [

        { text: `Body reference id=body-${idx + 1} type=${b.referenceType}:` },

        await fetchImageInlinePart(b.imageUrl, `body-${idx + 1}`),

      ])

    )

  ).flat();



  const contextLines: string[] = [];

  if (params.workspaceMission?.trim()) contextLines.push(`Space mission: ${params.workspaceMission}`);

  if (params.workspaceStylingContext?.trim())

    contextLines.push(`Workspace styling context: ${params.workspaceStylingContext}`);

  if (params.bodyReferenceSummary?.trim())

    contextLines.push(`Body reference notes: ${params.bodyReferenceSummary}`);

  if (params.memoryJson?.trim()) contextLines.push(`Memory JSON: ${params.memoryJson}`);



  const prompt = [

    `You are Chrysty, an expert personal stylist.`,

    `You will plan exactly ${params.lookCount} looks.`,

    `The user request is: "${params.stylingMessage}"`,

    ``,

    `Rules:`,

    buildOutfitPlanningRules(MAX_PIECES_PER_LOOK),

    buildMultiPersonPlanningRules(params.bodyRefs.length),

    contextLines.length ? `\nContext:\n${contextLines.join("\n")}\n` : ``,

    `Now return JSON matching the schema.`,

  ]

    .filter(Boolean)

    .join("\n");



  generateLog("gemini_call", {

    model,

    lookCount: params.lookCount,

    wardrobeImages: params.wardrobeCatalog.length,

    bodyRefs: params.bodyRefs.length,

    stylingMessage: params.stylingMessage,

  });



  const response = await generateContentWithRetry(
    (activeModel) =>
      getClient().models.generateContent({
        model: activeModel,
        contents: [
          {
            role: "user",
            parts: [{ text: prompt }, ...bodyParts, ...wardrobeParts],
          },
        ],
        config: {
          temperature: 0.3,
          responseMimeType: "application/json",
          abortSignal: AbortSignal.timeout(GEMINI_TIMEOUT_MS),
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              planningReasoning: { type: Type.STRING },
              assistantMessage: { type: Type.STRING },
              looks: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    lookIndex: { type: Type.INTEGER },
                    styleDirection: { type: Type.STRING },
                    stylingReasoning: { type: Type.STRING },
                    itemReasoning: { type: Type.STRING },
                    wardrobeItemIds: { type: Type.ARRAY, items: { type: Type.STRING } },
                    rationale: { type: Type.STRING },
                    vibe: { type: Type.STRING },
                    occasionTag: { type: Type.STRING },
                    imagePrompt: { type: Type.STRING },
                    isStylistPick: { type: Type.BOOLEAN },
                    subjectAssignments: {
                      type: Type.ARRAY,
                      items: {
                        type: Type.OBJECT,
                        properties: {
                          bodyRefIndex: { type: Type.INTEGER },
                          perceivedPresentation: {
                            type: Type.STRING,
                            enum: [...PERCEIVED_PRESENTATION_OPTIONS],
                          },
                          personLabel: { type: Type.STRING },
                          wardrobeItemIds: { type: Type.ARRAY, items: { type: Type.STRING } },
                          assignmentReasoning: { type: Type.STRING },
                        },
                        required: [
                          "bodyRefIndex",
                          "perceivedPresentation",
                          "personLabel",
                          "wardrobeItemIds",
                          "assignmentReasoning",
                        ],
                      },
                    },
                  },
                  required: [
                    "lookIndex",
                    "styleDirection",
                    "stylingReasoning",
                    "itemReasoning",
                    "wardrobeItemIds",
                    "rationale",
                    "vibe",
                    "occasionTag",
                  ],
                },
              },
            },
            required: ["planningReasoning", "assistantMessage", "looks"],
          },
        },
      }),
    model
  );



  const text = response.text;

  const parsed = parseOutfitPlan(JSON.parse(text ?? "{}"), {
    bodyRefCount: params.bodyRefs.length,
  });



  const validIds = new Set(params.wardrobeCatalog.map((w) => w.id));

  const normalizedLooks = parsed.looks

    .map((l, idx) => {

      const ids = Array.from(new Set(l.wardrobeItemIds.filter((id) => validIds.has(id)))).slice(

        0,

        MAX_PIECES_PER_LOOK

      );

      return {

        ...l,

        lookIndex: idx + 1,

        wardrobeItemIds: ids,

      };

    })

    .filter((l) => l.wardrobeItemIds.length > 0)

    .slice(0, params.lookCount);



  if (!normalizedLooks.length) return parsed;



  const hasPick = normalizedLooks.some((l) => l.isStylistPick);

  if (!hasPick) normalizedLooks[0] = { ...normalizedLooks[0], isStylistPick: true };



  return { ...parsed, looks: normalizedLooks };

}

