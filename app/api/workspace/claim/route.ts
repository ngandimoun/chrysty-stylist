import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient, isSupabaseConfigured } from "@/lib/supabase/admin";
import { STYLIST_TABLES } from "@/lib/supabase/tables";
import { requireWorkspace } from "@/lib/workspace/session";
import { getServerSession } from "@/lib/chrysty/server-session";
import { configurePlatformForToken } from "@/lib/chrysty/platform";
import { auth } from "@chrysty/platform";

export async function POST(request: NextRequest) {
  try {
    if (!isSupabaseConfigured()) {
      return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
    }

    const workspace = await requireWorkspace();
    const session = await getServerSession(request);

    if (!session?.access_token) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    configurePlatformForToken(session.access_token);

    const user = await auth.getUser();
    const userId = user.id;

    const supabase = createAdminClient();
    const updates: { user_id: string; display_name?: string | null; updated_at: string } = {
      user_id: userId,
      updated_at: new Date().toISOString(),
    };

    if (!workspace.display_name && user.fullName) {
      updates.display_name = user.fullName;
    }

    const { data, error } = await supabase
      .from(STYLIST_TABLES.workspaces)
      .update(updates)
      .eq("id", workspace.id)
      .select("id, user_id, display_name")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      claimed: true,
      workspaceId: data.id,
      userId: data.user_id,
      displayName: data.display_name,
    });
  } catch {
    return NextResponse.json({ error: "Failed to claim workspace" }, { status: 500 });
  }
}

