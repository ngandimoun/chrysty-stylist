import { NextResponse } from "next/server";
import { createAdminClient, isSupabaseConfigured } from "@/lib/supabase/admin";
import { STYLIST_TABLES } from "@/lib/supabase/tables";
import { requireWorkspace } from "@/lib/workspace/session";
import { renderGenerationLooks } from "@/lib/images/render-generation";
import { isFalConfigured } from "@/lib/config/fal";
import { generateLog } from "@/lib/chrysty/generate-debug";

export const maxDuration = 300;

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ generationId: string }> }
) {
  try {
    if (!isSupabaseConfigured()) {
      return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
    }

    if (!isFalConfigured()) {
      return NextResponse.json({ error: "Image styling is not configured" }, { status: 503 });
    }

    const { generationId } = await params;
    const workspace = await requireWorkspace();
    const supabase = createAdminClient();

    const { data: generation, error } = await supabase
      .from(STYLIST_TABLES.outfitGenerations)
      .select("id, status")
      .eq("id", generationId)
      .eq("workspace_id", workspace.id)
      .maybeSingle();

    if (error || !generation) {
      return NextResponse.json({ error: "Generation not found" }, { status: 404 });
    }

    const { data: looks } = await supabase
      .from(STYLIST_TABLES.outfitLooks)
      .select("id, image_id")
      .eq("generation_id", generationId);

    const totalCount = looks?.length ?? 0;
    const renderedCount = looks?.filter((look) => look.image_id).length ?? 0;

    if (generation.status === "complete" && totalCount > 0 && renderedCount >= totalCount) {
      return NextResponse.json({
        ok: true,
        status: "complete",
        skipped: true,
        renderedCount,
        totalCount,
      });
    }

    generateLog("render_trigger", { generationId, source: "client", renderedCount, totalCount });

    await renderGenerationLooks({
      generationId,
      workspaceId: workspace.id,
    });

    const { data: looksAfter } = await supabase
      .from(STYLIST_TABLES.outfitLooks)
      .select("id, image_id")
      .eq("generation_id", generationId);

    const { data: generationAfter } = await supabase
      .from(STYLIST_TABLES.outfitGenerations)
      .select("status")
      .eq("id", generationId)
      .single();

    const finalRenderedCount = looksAfter?.filter((look) => look.image_id).length ?? 0;
    const finalTotalCount = looksAfter?.length ?? 0;
    const status = generationAfter?.status ?? "failed";

    return NextResponse.json({
      ok: status !== "failed",
      status,
      renderedCount: finalRenderedCount,
      totalCount: finalTotalCount,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Render failed" },
      { status: 500 }
    );
  }
}
