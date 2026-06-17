import { createAdminClient } from "@/lib/supabase/admin";
import { STYLIST_TABLES } from "@/lib/supabase/tables";
import { listBodyReferences } from "@/lib/body/service";
import { getDefaultWardrobeId, listConfirmedWardrobeItems } from "@/lib/wardrobe/service";
import { renderAndStoreLookSafe } from "@/lib/images/render-look";
import type { OutfitLookPlan, OutfitPlan } from "@/lib/ai/outfit-plan-schema";
import { generateLog } from "@/lib/chrysty/generate-debug";
import { isFalConfigured } from "@/lib/config/fal";

export type RenderGenerationResult = {
  status: "rendering" | "complete" | "failed";
  renderedCount: number;
  totalCount: number;
  hasMore: boolean;
  renderedThisCall: boolean;
};

export async function renderGenerationLooks(params: {
  generationId: string;
  workspaceId: string;
}): Promise<RenderGenerationResult> {
  const emptyResult = (
    status: RenderGenerationResult["status"],
    renderedCount = 0,
    totalCount = 0
  ): RenderGenerationResult => ({
    status,
    renderedCount,
    totalCount,
    hasMore: false,
    renderedThisCall: false,
  });

  if (!isFalConfigured()) {
    generateLog("render_generation_skipped", { reason: "fal_not_configured" });
    return emptyResult("failed");
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
    return emptyResult("failed");
  }

  const bodyRefs = await listBodyReferences(workspaceId);
  if (!bodyRefs.length) {
    await supabase
      .from(STYLIST_TABLES.outfitGenerations)
      .update({ status: "failed" })
      .eq("id", generationId);
    generateLog("render_generation_failed", { reason: "no_body_refs", generationId });
    return emptyResult("failed");
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
    .select("id, wardrobe_item_ids, image_id, created_at")
    .eq("generation_id", generationId)
    .order("created_at", { ascending: true });

  if (looksError || !lookRows?.length) {
    await supabase
      .from(STYLIST_TABLES.outfitGenerations)
      .update({ status: "failed" })
      .eq("id", generationId);
    return emptyResult("failed");
  }

  const totalCount = lookRows.length;
  const alreadyRendered = lookRows.filter((row) => row.image_id).length;

  if (alreadyRendered >= totalCount) {
    await supabase
      .from(STYLIST_TABLES.outfitGenerations)
      .update({ status: "complete" })
      .eq("id", generationId);
    return {
      status: "complete",
      renderedCount: alreadyRendered,
      totalCount,
      hasMore: false,
      renderedThisCall: false,
    };
  }

  const wardrobeId = generation.wardrobe_id ?? (await getDefaultWardrobeId(workspaceId));
  const wardrobeRows = await listConfirmedWardrobeItems(workspaceId, wardrobeId);

  await supabase
    .from(STYLIST_TABLES.outfitGenerations)
    .update({ status: "rendering" })
    .eq("id", generationId);

  const nextIndex = lookRows.findIndex((row) => !row.image_id);
  if (nextIndex < 0) {
    return {
      status: "complete",
      renderedCount: alreadyRendered,
      totalCount,
      hasMore: false,
      renderedThisCall: false,
    };
  }

  const lookRow = lookRows[nextIndex]!;
  const planLook: OutfitLookPlan | undefined = plan?.looks?.[nextIndex];

  generateLog("render_generation_start", {
    generationId,
    lookCount: totalCount,
    bodyRefCount: bodyRefs.length,
    nextLookIndex: nextIndex + 1,
    alreadyRendered,
  });

  if (!planLook) {
    generateLog("render_look_skipped", { lookId: lookRow.id, reason: "no_plan_look" });
    const renderedCount = lookRows.filter((row) => row.image_id).length;
    const status = renderedCount > 0 ? "rendering" : "failed";
    await supabase
      .from(STYLIST_TABLES.outfitGenerations)
      .update({ status: renderedCount >= totalCount ? "complete" : status })
      .eq("id", generationId);
    return {
      status: renderedCount >= totalCount ? "complete" : status,
      renderedCount,
      totalCount,
      hasMore: renderedCount < totalCount,
      renderedThisCall: false,
    };
  }

  generateLog("render_look_start", {
    lookId: lookRow.id,
    index: nextIndex + 1,
    total: totalCount,
  });

  const result = await renderAndStoreLookSafe({
    workspaceId,
    generationId,
    lookId: lookRow.id,
    planLook,
    stylingMessage,
    bodyRefs,
    wardrobeRows,
  });

  const { data: looksAfter } = await supabase
    .from(STYLIST_TABLES.outfitLooks)
    .select("id, image_id")
    .eq("generation_id", generationId);

  const renderedCount = looksAfter?.filter((row) => row.image_id).length ?? 0;
  const hasMore = renderedCount < totalCount;
  const status: RenderGenerationResult["status"] =
    renderedCount >= totalCount ? "complete" : renderedCount > 0 || hasMore ? "rendering" : "failed";

  if (renderedCount === 0 && !hasMore) {
    await supabase
      .from(STYLIST_TABLES.outfitGenerations)
      .update({ status: "failed" })
      .eq("id", generationId);
  } else {
    await supabase
      .from(STYLIST_TABLES.outfitGenerations)
      .update({ status: renderedCount >= totalCount ? "complete" : "rendering" })
      .eq("id", generationId);
  }

  generateLog("render_generation_done", {
    generationId,
    renderedThisCall: Boolean(result),
    renderedCount,
    total: totalCount,
    status,
    hasMore,
  });

  return {
    status: renderedCount >= totalCount ? "complete" : status,
    renderedCount,
    totalCount,
    hasMore,
    renderedThisCall: Boolean(result),
  };
}
