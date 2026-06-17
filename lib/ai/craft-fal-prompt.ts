import { falEditPromptWorkflow } from "@/src/mastra/workflows/fal-edit-prompt";
import { craftFalEditPromptWithGemini } from "@/lib/ai/fal-edit-prompt";
import { falEditPromptSchema } from "@/lib/ai/fal-edit-prompt-schema";
import type { CraftFalEditPromptInput } from "@/lib/ai/fal-edit-prompt-schema";
import { isGeminiConfigured } from "@/lib/config/models";
import { generateLog } from "@/lib/chrysty/generate-debug";

export async function craftFalEditPrompt(input: CraftFalEditPromptInput) {
  if (isGeminiConfigured()) {
    try {
      const run = await falEditPromptWorkflow.createRun();
      const result = await run.start({ inputData: input });
      if (result.status === "success" && result.result) {
        return falEditPromptSchema.parse(result.result);
      }
      if (result.status === "failed") {
        generateLog("fal_prompt_workflow_failed", {
          error: result.error instanceof Error ? result.error.message : String(result.error),
        });
      }
    } catch (e) {
      generateLog("fal_prompt_workflow_failed", {
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }
  return craftFalEditPromptWithGemini(input);
}

export type { CraftFalEditPromptInput, FalEditPrompt } from "@/lib/ai/fal-edit-prompt-schema";
