import OpenAI from "openai";
import { z } from "zod";
import { getModelConfig, requireOpenAI, isOpenAIConfigured } from "@/lib/config/models";
import { buildStylistSystemPrompt } from "@/lib/chrysty/persona";
import { MAX_PIECES_PER_LOOK } from "@/lib/chrysty/look-count-constants";
import { buildOpenAIPlanningUserRules } from "@/lib/chrysty/outfit-planning-rules";
import type { WardrobeItemMetadata } from "@/lib/memory/schema";

let client: OpenAI | null = null;

function getClient() {
  if (!client) client = new OpenAI({ apiKey: requireOpenAI() });
  return client;
}

const visionSchema = z.object({
  category: z.string(),
  description: z.string(),
  colors: z.array(z.string()),
  formality: z.string(),
  season: z.array(z.string()).optional(),
  keywords: z.array(z.string()).optional(),
});

export async function analyzeWardrobeImage(
  imageUrl: string,
  userLabel?: string
): Promise<WardrobeItemMetadata> {
  if (!isOpenAIConfigured()) {
    return {
      category: "top",
      description: userLabel || "Clothing item",
      colors: ["neutral"],
      formality: "casual",
      keywords: [],
    };
  }

  const { openai } = getModelConfig();
  const response = await getClient().chat.completions.create({
    model: openai.vision,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `Analyze this wardrobe photo. Return JSON only with: category (top|bottom|shoes|outerwear|dress|accessory), description (short label), colors[], formality (casual|smart-casual|formal), season[], keywords[].${userLabel ? ` User suggested: ${userLabel}` : ""}`,
          },
          { type: "image_url", image_url: { url: imageUrl } },
        ],
      },
    ],
    response_format: { type: "json_object" },
  });

  const raw = response.choices[0]?.message?.content ?? "{}";
  return visionSchema.parse(JSON.parse(raw));
}

const outfitPlanSchema = z.object({
  planningReasoning: z.string().default(""),
  looks: z
    .array(
      z.object({
        lookIndex: z.number().int().optional(),
        styleDirection: z.string().optional(),
        stylingReasoning: z.string().optional(),
        itemReasoning: z.string().optional(),
        wardrobeItemIds: z.array(z.string()),
        rationale: z.string(),
        vibe: z.string(),
        occasionTag: z.string(),
        imagePrompt: z.string().optional(),
        isStylistPick: z.boolean().optional(),
      })
    )
    .min(1)
    .max(7),
  assistantMessage: z.string(),
});

export type OutfitPlan = z.infer<typeof outfitPlanSchema>;

export async function planOutfits(params: {
  userMessage: string;
  lookCount: number;
  wardrobe: { id: string; description: string; category: string | null }[];
  memoryJson?: string;
  userName?: string;
  workspaceMission?: string;
  workspaceStylingContext?: string;
  bodyReferenceSummary?: string;
}): Promise<OutfitPlan> {
  const ids = params.wardrobe.map((w) => w.id);
  const fallbackLooks = buildFallbackLooks(params.wardrobe, params.userMessage, params.lookCount);

  if (!isOpenAIConfigured()) {
    return {
      planningReasoning: "Fallback plan (no OpenAI configured).",
      looks: fallbackLooks,
      assistantMessage: "Here's what I'd put together from your closet.",
    };
  }

  const { openai } = getModelConfig();
  const wardrobeList = params.wardrobe
    .map((w) => `- ${w.id}: ${w.description} (${w.category ?? "item"})`)
    .join("\n");

  const response = await getClient().chat.completions.create({
    model: openai.outfitPlan,
    messages: [
      {
        role: "system",
        content: buildStylistSystemPrompt({
          memoryJson: params.memoryJson,
          wardrobeSummary: wardrobeList,
          userName: params.userName,
          workspaceMission: params.workspaceMission,
          workspaceStylingContext: params.workspaceStylingContext,
          bodyReferenceSummary: params.bodyReferenceSummary,
        }),
      },
      {
        role: "user",
        content: `Plan exactly ${params.lookCount} outfit looks using ONLY these wardrobe item IDs.\nRequest: ${params.userMessage}\n\n${buildOpenAIPlanningUserRules(MAX_PIECES_PER_LOOK)}\n\nReturn JSON: { planningReasoning, looks: [{ lookIndex, styleDirection, stylingReasoning, itemReasoning, wardrobeItemIds, rationale, vibe, occasionTag, imagePrompt, isStylistPick }], assistantMessage }\nMark exactly one isStylistPick true.\nValid IDs:\n${wardrobeList}`,
      },
    ],
    response_format: { type: "json_object" },
  });

  try {
    const parsed = outfitPlanSchema.parse(
      JSON.parse(response.choices[0]?.message?.content ?? "{}")
    );
    parsed.looks = parsed.looks.map((look) => ({
      ...look,
      wardrobeItemIds: Array.from(
        new Set(look.wardrobeItemIds.filter((id) => ids.includes(id)))
      ).slice(0, MAX_PIECES_PER_LOOK),
    }));
    if (parsed.looks.length === 0) {
      return {
        planningReasoning: parsed.planningReasoning ?? "",
        looks: fallbackLooks,
        assistantMessage: parsed.assistantMessage,
      };
    }
    if (!parsed.looks.some((l) => l.isStylistPick)) {
      parsed.looks[0].isStylistPick = true;
    }
    parsed.looks = parsed.looks.slice(0, params.lookCount);
    return parsed;
  } catch {
    return {
      planningReasoning: "Fallback plan (OpenAI parse failed).",
      looks: fallbackLooks,
      assistantMessage: "Here's what I'd put together from your closet.",
    };
  }
}

function buildFallbackLooks(
  wardrobe: { id: string; description: string; category: string | null }[],
  message: string,
  lookCount: number
) {
  const top = wardrobe.find((w) => w.category === "top") ?? wardrobe[0];
  const bottom = wardrobe.find((w) => w.category === "bottom") ?? wardrobe[1];
  const shoes = wardrobe.find((w) => w.category === "shoes") ?? wardrobe[2];
  const ids = [top, bottom, shoes].filter(Boolean).map((w) => w!.id);

  const n = Math.max(1, Math.min(7, lookCount || 1));
  return Array.from({ length: n }).map((_, i) => ({
    lookIndex: i + 1,
    styleDirection: i === 0 ? "Stylist pick" : "Alternate",
    stylingReasoning: "Fallback plan (no model configured).",
    itemReasoning: "Using your confirmed pieces as a starter.",
    wardrobeItemIds: i === 0 ? ids : ids.slice(0, 2),
    rationale:
      i === 0
        ? "A balanced everyday combination from your confirmed pieces."
        : "A simpler take if you want something lighter.",
    vibe: i === 0 ? "Clean and effortless" : "Relaxed",
    occasionTag: message.slice(0, 40) || "Today",
    isStylistPick: i === 0,
  }));
}

export async function streamStylistChat(params: {
  messages: { role: "user" | "assistant"; content: string }[];
  memoryJson?: string;
  wardrobeSummary?: string;
  userName?: string;
  workspaceMission?: string;
}) {
  if (!isOpenAIConfigured()) {
    async function* mock() {
      yield "I'm here to help you get dressed. Add a few wardrobe photos and ask me what to wear.";
    }
    return mock();
  }

  const { openai } = getModelConfig();
  const stream = await getClient().chat.completions.create({
    model: openai.chat,
    stream: true,
    messages: [
      {
        role: "system",
        content: buildStylistSystemPrompt({
          memoryJson: params.memoryJson,
          wardrobeSummary: params.wardrobeSummary,
          userName: params.userName,
          workspaceMission: params.workspaceMission,
        }),
      },
      ...params.messages,
    ],
  });

  async function* generator() {
    for await (const chunk of stream) {
      const text = chunk.choices[0]?.delta?.content;
      if (text) yield text;
    }
  }
  return generator();
}

export async function mergeMemorySummary(params: {
  section: string;
  existing: string[];
  newSignals: string[];
}): Promise<string[]> {
  if (!isOpenAIConfigured() || params.newSignals.length === 0) {
    return [...new Set([...params.existing, ...params.newSignals])].slice(0, 5);
  }

  const { openai } = getModelConfig();
  const response = await getClient().chat.completions.create({
    model: openai.memory,
    messages: [
      {
        role: "system",
        content: `Merge stylist memory bullets for section "${params.section}". Max 5 bullets. Dedupe. Return JSON { bullets: string[] }`,
      },
      {
        role: "user",
        content: JSON.stringify({
          existing: params.existing,
          newSignals: params.newSignals,
        }),
      },
    ],
    response_format: { type: "json_object" },
  });

  try {
    const parsed = JSON.parse(response.choices[0]?.message?.content ?? "{}");
    return z.array(z.string()).max(5).parse(parsed.bullets);
  } catch {
    return [...new Set([...params.existing, ...params.newSignals])].slice(0, 5);
  }
}
