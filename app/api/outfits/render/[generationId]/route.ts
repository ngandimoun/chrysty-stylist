import { NextResponse } from "next/server";
import { createAdminClient, isSupabaseConfigured } from "@/lib/supabase/admin";
import { STYLIST_TABLES } from "@/lib/supabase/tables";
import { requireWorkspace } from "@/lib/workspace/session";
import { scheduleGenerationRender } from "@/lib/images/schedule-render";
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
      return NextResponse.json({ ok: true, status: "complete", skipped: true });
    }

    if (generation.status !== "rendering") {
      await supabase
        .from(STYLIST_TABLES.outfitGenerations)
        .update({ status: "rendering" })
        .eq("id", generationId);
    }

    generateLog("render_trigger", { generationId, source: "client", renderedCount, totalCount });

    scheduleGenerationRender({
      generationId,
      workspaceId: workspace.id,
      source: "client",
    });

    return NextResponse.json({ ok: true, status: "rendering" }, { status: 202 });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Render failed" },
      { status: 500 }
    );
  }
}
