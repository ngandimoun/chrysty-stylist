import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { createAdminClient, isSupabaseConfigured } from "@/lib/supabase/admin";
import { STYLIST_TABLES } from "@/lib/supabase/tables";
import { getServerUserId } from "@/lib/supabase/server";
import type { Json } from "@/types/database";
import { getCookieOptions, WORKSPACE_COOKIE } from "@/lib/workspace/cookie";
import { addTokenToRegistry, getRegistryTokens } from "@/lib/workspace/registry";
import { toWorkspaceSummary } from "@/lib/workspace/serialize";

const bodySchema = z.object({
  workspaceId: z.string().uuid(),
});

export async function POST(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  const json = await request.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const registryTokens = await getRegistryTokens();
  const userId = await getServerUserId();
  const supabase = createAdminClient();

  let data: {
    id: string;
    name: string;
    visitor_token: string;
    onboarding_complete: boolean;
    settings: Json;
  } | null = null;

  if (registryTokens.length > 0) {
    const { data: fromRegistry, error } = await supabase
      .from(STYLIST_TABLES.workspaces)
      .select("id, name, visitor_token, onboarding_complete, settings")
      .eq("id", parsed.data.workspaceId)
      .in("visitor_token", registryTokens)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    data = fromRegistry;
  }

  if (!data && userId) {
    const { data: owned, error } = await supabase
      .from(STYLIST_TABLES.workspaces)
      .select("id, name, visitor_token, onboarding_complete, settings")
      .eq("id", parsed.data.workspaceId)
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    data = owned;
  }

  if (!data) {
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  }

  await addTokenToRegistry(data.visitor_token);

  const cookieStore = await cookies();
  cookieStore.set(WORKSPACE_COOKIE, data.visitor_token, getCookieOptions());

  return NextResponse.json({
    workspace: toWorkspaceSummary(data, data.visitor_token),
  });
}
