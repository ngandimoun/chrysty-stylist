import { createWorkflow, createStep } from "@mastra/core/workflows";
import { z } from "zod";
import { outfitLookPlanSchema } from "@/lib/ai/outfit-plan-schema";
import { craftFalEditPromptWithGemini } from "@/lib/ai/fal-edit-prompt";
import { falEditPromptSchema, type CraftFalEditPromptInput } from "@/lib/ai/fal-edit-prompt-schema";

const workflowInputSchema = z.object({
  look: outfitLookPlanSchema,
  stylingMessage: z.string().min(1),
  bodyRefs: z.array(
    z.object({
      id: z.string().min(1),
      index: z.number().int().min(0).max(4),
      referenceType: z.string().min(1),
      imageUrl: z.string().min(1),
      storagePath: z.string().min(1),
    })
  ),
  wardrobePieces: z.array(
    z.object({
      id: z.string().min(1),
      sortIndex: z.number().int().min(0),
      category: z.string().nullable(),
      description: z.string(),
      colors: z.array(z.string()).nullable(),
      imageUrl: z.string().min(1),
      storagePath: z.string().min(1),
    })
  ),
});

const craftStep = createStep({
  id: "craft-fal-edit-prompt",
  description: "Analyze subjects, validate fit, craft gender-aware Fal edit prompt",
  inputSchema: workflowInputSchema,
  outputSchema: falEditPromptSchema,
  execute: async ({ inputData }) => {
    const result = await craftFalEditPromptWithGemini(inputData as CraftFalEditPromptInput);
    return falEditPromptSchema.parse(result);
  },
});

export const falEditPromptWorkflow = createWorkflow({
  id: "fal-edit-prompt",
  inputSchema: workflowInputSchema,
  outputSchema: falEditPromptSchema,
})
  .then(craftStep)
  .commit();
