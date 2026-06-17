import { cookies } from "next/headers";
import { createAdminClient, isSupabaseConfigured } from "@/lib/supabase/admin";
import { STYLIST_TABLES } from "@/lib/supabase/tables";
import { WORKSPACE_COOKIE } from "@/lib/workspace/cookie";
import type { Workspace } from "@/types/database";

export async function getWorkspaceFromCookie(): Promise<Workspace | null> {
  if (!isSupabaseConfigured()) return null;
  const cookieStore = await cookies();
  const token = cookieStore.get(WORKSPACE_COOKIE)?.value;
  if (!token) return null;

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from(STYLIST_TABLES.workspaces)
    .select("*")
    .eq("visitor_token", token)
    .single();

  if (error || !data) return null;
  return data as Workspace;
}

export async function requireWorkspace(): Promise<Workspace> {
  const workspace = await getWorkspaceFromCookie();
  if (!workspace) throw new Error("Workspace not found");
  return workspace;
}
