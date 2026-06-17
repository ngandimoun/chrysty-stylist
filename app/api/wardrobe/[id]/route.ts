import { NextResponse } from "next/server";

import { deleteWardrobeItem } from "@/lib/wardrobe/service";
import { isSupabaseConfigured } from "@/lib/supabase/admin";
import { requireWorkspace } from "@/lib/workspace/session";

type RouteContext = { params: Promise<{ id: string }> };

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    if (!isSupabaseConfigured()) {
      return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
    }

    const { id } = await context.params;
    const workspace = await requireWorkspace();
    await deleteWardrobeItem(workspace.id, id);

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Delete failed" },
      { status: 400 }
    );
  }
}
