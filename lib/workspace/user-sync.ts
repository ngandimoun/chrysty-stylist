import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { getServerUserId } from "@/lib/supabase/server";
import { STYLIST_TABLES } from "@/lib/supabase/tables";
import { getCookieOptions, WORKSPACE_COOKIE } from "@/lib/workspace/cookie";
import { addTokenToRegistry, getRegistryTokens } from "@/lib/workspace/registry";

type UserWorkspaceRow = {
  id: string;
  visitor_token: string;
  created_at: string;
};

async function pickDefaultWorkspace(
  workspaces: UserWorkspaceRow[]
): Promise<UserWorkspaceRow> {
  if (workspaces.length === 1) return workspaces[0];

  const supabase = createAdminClient();
  const ids = workspaces.map((w) => w.id);
  const { data: uploads } = await supabase
    .from(STYLIST_TABLES.uploadedImages)
    .select("workspace_id")
    .in("workspace_id", ids);

  const counts = new Map<string, number>();
  for (const row of uploads ?? []) {
    counts.set(row.workspace_id, (counts.get(row.workspace_id) ?? 0) + 1);
  }

  return [...workspaces].sort((a, b) => {
    const countDiff = (counts.get(b.id) ?? 0) - (counts.get(a.id) ?? 0);
    if (countDiff !== 0) return countDiff;
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  })[0];
}

export async function listUserWorkspaceRows(userId: string) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from(STYLIST_TABLES.workspaces)
    .select("id, name, visitor_token, onboarding_complete, settings, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return data ?? [];
}

/**
 * When a logged-in user has no stylist_ws cookie (e.g. first visit on stylist.chrysty.dev),
 * seed the registry with all their owned workspaces and activate the one with the most uploads.
 */
export async function ensureUserWorkspaceCookie(): Promise<boolean> {
  const userId = await getServerUserId();
  if (!userId) return false;

  const workspaces = await listUserWorkspaceRows(userId);
  if (workspaces.length === 0) return false;

  for (const ws of workspaces) {
    await addTokenToRegistry(ws.visitor_token);
  }

  const cookieStore = await cookies();
  const activeToken = cookieStore.get(WORKSPACE_COOKIE)?.value;
  const ownedTokens = new Set(workspaces.map((w) => w.visitor_token));

  if (activeToken && ownedTokens.has(activeToken)) {
    return true;
  }

  const registry = await getRegistryTokens();
  const fromRegistry = workspaces.find((w) => registry.includes(w.visitor_token));
  const picked = fromRegistry ?? (await pickDefaultWorkspace(workspaces));

  cookieStore.set(WORKSPACE_COOKIE, picked.visitor_token, getCookieOptions());
  return true;
}
