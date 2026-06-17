import { GoogleGenAI, Type } from "@google/genai";
import { z } from "zod";
import {
  getModelConfig,
  isGeminiConfigured,
  isOpenAIConfigured,
  requireGeminiApiKey,
} from "@/lib/config/models";
import { analyzeWardrobeImage } from "@/lib/ai/openai";
import type { WardrobeItemMetadata } from "@/lib/memory/schema";

const visionSchema = z.object({
  category: z.string(),
  description: z.string(),
  colors: z.array(z.string()),
  formality: z.string(),
  season: z.array(z.string()).optional(),
  keywords: z.array(z.string()).optional(),
});

let geminiClient: GoogleGenAI | null = null;

function getGeminiClient() {
  if (!geminiClient) geminiClient = new GoogleGenAI({ apiKey: requireGeminiApiKey() });
  return geminiClient;
}

function placeholderMetadata(userLabel?: string): WardrobeItemMetadata {
  return {
    category: "uncategorized",
    description: userLabel?.trim() || "Clothing item",
    colors: [],
    formality: "casual",
    keywords: [],
  };
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

export async function analyzeWardrobeWithGemini(
  imageUrl: string,
  userLabel?: string
): Promise<WardrobeItemMetadata> {
  const cfg = getModelConfig();
  const model = cfg.gemini.outfitPlan || "gemini-3.5-flash";
  const imagePart = await fetchImageInlinePart(imageUrl, "wardrobe");

  const response = await getGeminiClient().models.generateContent({
    model,
    contents: [
      {
        role: "user",
        parts: [
          {
            text: `Analyze this wardrobe photo. Return JSON with: category (top|bottom|shoes|outerwear|dress|accessory|uncategorized), description (short label), colors[], formality (casual|smart-casual|formal), season[], keywords[].${userLabel ? ` User suggested: ${userLabel}` : ""}`,
          },
          imagePart,
        ],
      },
    ],
    config: {
      temperature: 0.2,
      responseMimeType: "application/json",
      abortSignal: AbortSignal.timeout(30_000),
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          category: { type: Type.STRING },
          description: { type: Type.STRING },
          colors: { type: Type.ARRAY, items: { type: Type.STRING } },
          formality: { type: Type.STRING },
          season: { type: Type.ARRAY, items: { type: Type.STRING } },
          keywords: { type: Type.ARRAY, items: { type: Type.STRING } },
        },
        required: ["category", "description", "colors", "formality"],
      },
    },
  });

  return visionSchema.parse(JSON.parse(response.text ?? "{}"));
}

export async function analyzeWardrobeItem(
  imageUrl: string,
  userLabel?: string
): Promise<{ metadata: WardrobeItemMetadata; analyzed: boolean }> {
  if (isGeminiConfigured()) {
    try {
      return { metadata: await analyzeWardrobeWithGemini(imageUrl, userLabel), analyzed: true };
    } catch (error) {
      console.warn("[wardrobe-analyze] Gemini failed, trying fallback", error);
    }
  }

  if (isOpenAIConfigured()) {
    try {
      return { metadata: await analyzeWardrobeImage(imageUrl, userLabel), analyzed: true };
    } catch (error) {
      console.warn("[wardrobe-analyze] OpenAI failed, using placeholder", error);
    }
  }

  return { metadata: placeholderMetadata(userLabel), analyzed: false };
}
