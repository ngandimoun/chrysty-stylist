import { createWorkflow, createStep } from "@mastra/core/workflows";
import { z } from "zod";
import { outfitPlanSchema } from "@/lib/ai/outfit-plan-schema";
import { planOutfitsWithGemini } from "@/lib/ai/gemini";

const workflowInputSchema = z.object({
  stylingMessage: z.string().min(1),
  lookCount: z.number().int().min(1).max(7),
  workspaceMission: z.string().nullable().optional(),
  workspaceStylingContext: z.string().nullable().optional(),
  memoryJson: z.string().nullable().optional(),
  bodyReferenceSummary: z.string().nullable().optional(),
  bodyRefs: z.array(
    z.object({
      imageUrl: z.string().min(1),
      referenceType: z.string().min(1),
    })
  ),
  wardrobeCatalog: z.array(
    z.object({
      id: z.string().min(1),
      imageUrl: z.string().min(1),
      mimeType: z.string().min(1),
      description: z.string().optional(),
      category: z.string().nullable().optional(),
      colors: z.array(z.string()).nullable().optional(),
    })
  ),
});

const workflowOutputSchema = outfitPlanSchema;

const planStep = createStep({
  id: "plan-outfits",
  description: "Reason about looks then pick wardrobe IDs",
  inputSchema: workflowInputSchema,
  outputSchema: workflowOutputSchema,
  execute: async ({ inputData }) => {
    const plan = await planOutfitsWithGemini({
      stylingMessage: inputData.stylingMessage,
      lookCount: inputData.lookCount,
      workspaceMission: inputData.workspaceMission ?? undefined,
      workspaceStylingContext: inputData.workspaceStylingContext ?? undefined,
      memoryJson: inputData.memoryJson ?? undefined,
      bodyReferenceSummary: inputData.bodyReferenceSummary ?? undefined,
      bodyRefs: inputData.bodyRefs,
      wardrobeCatalog: inputData.wardrobeCatalog,
    });

    // Ensure it matches schema for downstream.
    return workflowOutputSchema.parse(plan);
  },
});

export const outfitPlanningWorkflow = createWorkflow({
  id: "outfit-planning",
  inputSchema: workflowInputSchema,
  outputSchema: workflowOutputSchema,
}).then(planStep).commit();

