import { createAdminClient } from "@/lib/supabase/admin";
import { STYLIST_TABLES } from "@/lib/supabase/tables";
import { listBodyReferences } from "@/lib/body/service";
import { getDefaultWardrobeId, listConfirmedWardrobeItems } from "@/lib/wardrobe/service";
import { renderAndStoreLookSafe } from "@/lib/images/render-look";
import type { OutfitLookPlan, OutfitPlan } from "@/lib/ai/outfit-plan-schema";
import { generateLog } from "@/lib/chrysty/generate-debug";
import { isFalConfigured } from "@/lib/config/fal";

export async function renderGenerationLooks(params: {
  generationId: string;
  workspaceId: string;
}): Promise<void> {
  if (!isFalConfigured()) {
    generateLog("render_generation_skipped", { reason: "fal_not_configured" });
    return;
  }

  const supabase = createAdminClient();
  const { generationId, workspaceId } = params;

  const { data: generation, error: genError } = await supabase
    .from(STYLIST_TABLES.outfitGenerations)
    .select("id, wardrobe_id, prompt_context, user_prompt, status")
    .eq("id", generationId)
    .eq("workspace_id", workspaceId)
    .single();

  if (genError || !generation) {
    generateLog("render_generation_failed", { reason: "generation_not_found", generationId });
    return;
  }

  const bodyRefs = await listBodyReferences(workspaceId);
  if (!bodyRefs.length) {
    await supabase
      .from(STYLIST_TABLES.outfitGenerations)
      .update({ status: "failed" })
      .eq("id", generationId);
    generateLog("render_generation_failed", { reason: "no_body_refs", generationId });
    return;
  }

  const promptContext = generation.prompt_context as {
    plan?: OutfitPlan;
    stylingMessage?: string;
    message?: string;
  } | null;
  const plan = promptContext?.plan;
  const stylingMessage =
    promptContext?.stylingMessage ?? generation.user_prompt ?? "Style this look";

  const { data: lookRows, error: looksError } = await supabase
    .from(STYLIST_TABLES.outfitLooks)
    .select("id, wardrobe_item_ids, created_at")
    .eq("generation_id", generationId)
    .order("created_at", { ascending: true });

  if (looksError || !lookRows?.length) {
    await supabase
      .from(STYLIST_TABLES.outfitGenerations)
      .update({ status: "failed" })
      .eq("id", generationId);
    return;
  }

  const wardrobeId = generation.wardrobe_id ?? (await getDefaultWardrobeId(workspaceId));
  const wardrobeRows = await listConfirmedWardrobeItems(workspaceId, wardrobeId);

  await supabase
    .from(STYLIST_TABLES.outfitGenerations)
    .update({ status: "rendering" })
    .eq("id", generationId);

  generateLog("render_generation_start", {
    generationId,
    lookCount: lookRows.length,
    bodyRefCount: bodyRefs.length,
  });

  let successCount = 0;

  for (let i = 0; i < lookRows.length; i++) {
    const lookRow = lookRows[i]!;
    const planLook: OutfitLookPlan | undefined = plan?.looks?.[i];

    if (!planLook) {
      generateLog("render_look_skipped", { lookId: lookRow.id, reason: "no_plan_look" });
      continue;
    }

    generateLog("render_look_start", { lookId: lookRow.id, index: i + 1, total: lookRows.length });

    const result = await renderAndStoreLookSafe({
      workspaceId,
      generationId,
      lookId: lookRow.id,
      planLook,
      stylingMessage,
      bodyRefs,
      wardrobeRows,
    });

    if (result) successCount += 1;
  }

  const finalStatus = successCount > 0 ? "complete" : "failed";
  await supabase
    .from(STYLIST_TABLES.outfitGenerations)
    .update({ status: finalStatus })
    .eq("id", generationId);

  generateLog("render_generation_done", {
    generationId,
    successCount,
    total: lookRows.length,
    status: finalStatus,
  });
}
