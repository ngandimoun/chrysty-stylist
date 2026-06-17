import { NextResponse } from "next/server";
import { createAdminClient, isSupabaseConfigured, STORAGE_BUCKETS } from "@/lib/supabase/admin";
import { STYLIST_TABLES } from "@/lib/supabase/tables";
import { resolveImagePath } from "@/lib/images/service";
import { requireWorkspace } from "@/lib/workspace/session";
import type { OutfitLook } from "@/types/database";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!isSupabaseConfigured()) {
      return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
    }

    const { id } = await params;
    const workspace = await requireWorkspace();
    const supabase = createAdminClient();

    const { data: look, error: lookError } = await supabase
      .from(STYLIST_TABLES.outfitLooks)
      .select("*")
      .eq("id", id)
      .single();

    if (lookError || !look) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const outfitLook = look as OutfitLook;

    const { data: generation } = await supabase
      .from(STYLIST_TABLES.outfitGenerations)
      .select("workspace_id")
      .eq("id", outfitLook.generation_id)
      .single();

    if (generation?.workspace_id !== workspace.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const storagePath = await resolveImagePath(outfitLook.image_id, outfitLook.storage_path);

    const { data: file, error } = await supabase.storage
      .from(STORAGE_BUCKETS.uploads)
      .download(storagePath);

    if (error || !file) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const isPng = storagePath.toLowerCase().endsWith(".png");

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": isPng ? "image/png" : "image/jpeg",
        "Content-Disposition": `attachment; filename="chrysty-outfit-${id}.${isPng ? "png" : "jpg"}"`,
      },
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Download failed" },
      { status: 400 }
    );
  }
}
