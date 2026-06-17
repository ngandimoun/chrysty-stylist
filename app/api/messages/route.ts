import { NextResponse } from "next/server";
import { createAdminClient, isSupabaseConfigured } from "@/lib/supabase/admin";
import { STYLIST_TABLES } from "@/lib/supabase/tables";
import { requireWorkspace } from "@/lib/workspace/session";
import {
  appendMessage,
  getOrCreateConversation,
  getRecentMessages,
} from "@/lib/chat/service";

export async function GET() {
  try {
    if (!isSupabaseConfigured()) {
      return NextResponse.json({ messages: [] });
    }

    const workspace = await requireWorkspace();
    const conversation = await getOrCreateConversation(workspace.id);
    const messages = await getRecentMessages(conversation.id, 50);

    return NextResponse.json({ messages, conversationId: conversation.id });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed" },
      { status: 400 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    if (!isSupabaseConfigured()) {
      return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
    }

    const workspace = await requireWorkspace();
    const { onboardingComplete } = await request.json();
    const supabase = createAdminClient();

    await supabase
      .from(STYLIST_TABLES.workspaces)
      .update({ onboarding_complete: Boolean(onboardingComplete) })
      .eq("id", workspace.id);

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: "Failed" }, { status: 400 });
  }
}
