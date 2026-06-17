import { createAdminClient } from "@/lib/supabase/admin";
import { STYLIST_TABLES } from "@/lib/supabase/tables";
import type { Json } from "@/types/database";

export async function getOrCreateConversation(workspaceId: string) {
  const supabase = createAdminClient();
  const { data: existing } = await supabase
    .from(STYLIST_TABLES.conversations)
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing) return existing;

  const { data, error } = await supabase
    .from(STYLIST_TABLES.conversations)
    .insert({ workspace_id: workspaceId, status: "active" })
    .select("*")
    .single();

  if (error) throw error;
  return data;
}

export async function getRecentMessages(conversationId: string, limit = 20) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from(STYLIST_TABLES.messages)
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) throw error;
  return data ?? [];
}

export async function appendMessage(
  conversationId: string,
  role: "user" | "assistant" | "system",
  content: string,
  metadata: Json = {},
  workspaceId?: string
) {
  const supabase = createAdminClient();
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from(STYLIST_TABLES.messages)
    .insert({
      conversation_id: conversationId,
      role,
      content,
      metadata,
      workspace_id: workspaceId ?? null,
    })
    .select("*")
    .single();

  if (error) throw error;

  await supabase
    .from(STYLIST_TABLES.conversations)
    .update({ last_message_at: now })
    .eq("id", conversationId);

  return data;
}
