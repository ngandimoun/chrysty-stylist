import { isGeminiConfigured, isOpenAIConfigured } from "@/lib/config/models";
import { outfitPlanSchema, type OutfitPlan } from "@/lib/ai/outfit-plan-schema";
import { planOutfits as planOutfitsWithOpenAI } from "@/lib/ai/openai";
import { outfitPlanningWorkflow } from "@/src/mastra/workflows/outfit-planning";
import type { WardrobeCatalogItem, BodyRef } from "@/lib/ai/gemini";
import { generateLog } from "@/lib/chrysty/generate-debug";

export async function planOutfitsForGeneration(input: {
  stylingMessage: string;
  lookCount: number;
  wardrobe: { id: string; description: string; category: string | null }[];
  wardrobeCatalog: WardrobeCatalogItem[];
  bodyRefs: BodyRef[];
  memoryJson?: string;
  workspaceMission?: string;
  workspaceStylingContext?: string;
  bodyReferenceSummary?: string;
  userName?: string;
}): Promise<OutfitPlan> {
  if (isGeminiConfigured()) {
    generateLog("planning_provider", { provider: "gemini", lookCount: input.lookCount });
    const run = await outfitPlanningWorkflow.createRun();
    const result = await run.start({
      inputData: {
        stylingMessage: input.stylingMessage,
        lookCount: input.lookCount,
        workspaceMission: input.workspaceMission ?? null,
        workspaceStylingContext: input.workspaceStylingContext ?? null,
        memoryJson: input.memoryJson ?? null,
        bodyReferenceSummary: input.bodyReferenceSummary ?? null,
        bodyRefs: input.bodyRefs,
        wardrobeCatalog: input.wardrobeCatalog,
      },
    });
    if (result.status !== "success") {
      if (result.status === "failed") {
        throw result.error instanceof Error
          ? result.error
          : new Error(
              typeof result.error === "object" &&
                result.error &&
                "message" in result.error &&
                typeof (result.error as { message: unknown }).message === "string"
                ? (result.error as { message: string }).message
                : "Planning failed"
            );
      }
      throw new Error(`Planning failed (${result.status})`);
    }
    return outfitPlanSchema.parse(result.result);
  }

  if (isOpenAIConfigured()) {
    generateLog("planning_provider", { provider: "openai", lookCount: input.lookCount });
    const openAiPlan = await planOutfitsWithOpenAI({
      userMessage: input.stylingMessage,
      lookCount: input.lookCount,
      wardrobe: input.wardrobe,
      memoryJson: input.memoryJson,
      userName: input.userName,
      workspaceMission: input.workspaceMission,
      workspaceStylingContext: input.workspaceStylingContext,
      bodyReferenceSummary: input.bodyReferenceSummary,
    });
    return outfitPlanSchema.parse(openAiPlan);
  }

  // Last resort: minimal plan from wardrobe ids (keeps app usable).
  generateLog("planning_provider", { provider: "fallback", lookCount: input.lookCount });
  const ids = input.wardrobe.map((w) => w.id).slice(0, 3);
  const looks = Array.from({ length: Math.max(1, input.lookCount) }).map((_, i) => ({
    lookIndex: i + 1,
    styleDirection: i === 0 ? "Stylist pick" : "Alternate",
    stylingReasoning: "Fallback plan (no model configured).",
    itemReasoning: "Using your confirmed pieces as a starter.",
    wardrobeItemIds: ids,
    rationale: "A balanced starting look from your confirmed pieces.",
    vibe: "Clean and effortless",
    occasionTag: input.stylingMessage.slice(0, 40) || "Today",
    isStylistPick: i === 0,
  }));

  return outfitPlanSchema.parse({
    planningReasoning: "Fallback plan because no model is configured.",
    assistantMessage: "Here's what I'd put together from your closet.",
    looks,
  });
}

