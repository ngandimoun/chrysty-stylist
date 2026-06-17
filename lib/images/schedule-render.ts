import { renderGenerationLooks } from "@/lib/images/render-generation";
import { generateError, generateLog } from "@/lib/chrysty/generate-debug";

/** Fire-and-forget render — reliable in dev (unlike Next.js after()). */
export function scheduleGenerationRender(params: {
  generationId: string;
  workspaceId: string;
  source?: string;
}) {
  generateLog("render_scheduled", {
    generationId: params.generationId,
    source: params.source ?? "unknown",
  });

  void renderGenerationLooks({
    generationId: params.generationId,
    workspaceId: params.workspaceId,
  }).catch((e) => generateError("render_generation_failed", e));
}
