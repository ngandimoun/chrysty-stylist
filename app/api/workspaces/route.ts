import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { cookies } from "next/headers";
import { z } from "zod";
import { createAdminClient, isSupabaseConfigured } from "@/lib/supabase/admin";
import { STYLIST_TABLES } from "@/lib/supabase/tables";
import { ensureMemoryRows } from "@/lib/memory/service";
import { ensureDefaultWardrobe } from "@/lib/wardrobe/service";
import { getCookieOptions, WORKSPACE_COOKIE } from "@/lib/workspace/cookie";
import {
  addTokenToRegistry,
  ensureRegistrySeeded,
} from "@/lib/workspace/registry";
import { mergeWorkspaceSettings } from "@/lib/workspace/settings";
import { getServerUserId } from "@/lib/supabase/server";
import { toWorkspaceSummary } from "@/lib/workspace/serialize";
import { listUserWorkspaceRows } from "@/lib/workspace/user-sync";
import type { Json } from "@/types/database";

const profileSchema = z.object({
  dressingFor: z.string().min(1),
  styleDescriptors: z.array(z.string()).min(1).max(3),
  stylePriority: z.string().min(1),
});

const createSchema = z.object({
  workspaceName: z.string().trim().min(1).max(80),
  mission: z.string().trim().min(1).max(280),
  profile: profileSchema,
});

export async function GET() {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  const cookieStore = await cookies();
  const activeToken = cookieStore.get(WORKSPACE_COOKIE)?.value;
  const tokens = await ensureRegistrySeeded(activeToken);
  const userId = await getServerUserId();

  const supabase = createAdminClient();
  const merged = new Map<
    string,
    {
      id: string;
      name: string;
      visitor_token: string;
      onboarding_complete: boolean;
      settings: Json;
      created_at: string;
    }
  >();

  if (tokens.length > 0) {
    const { data, error } = await supabase
      .from(STYLIST_TABLES.workspaces)
      .select("id, name, visitor_token, onboarding_complete, settings, created_at")
      .in("visitor_token", tokens);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    for (const row of data ?? []) {
      merged.set(row.id, row);
    }
  }

  if (userId) {
    try {
      const userRows = await listUserWorkspaceRows(userId);
      for (const row of userRows) {
        merged.set(row.id, row);
        await addTokenToRegistry(row.visitor_token);
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to load user workspaces";
      return NextResponse.json({ error: message }, { status: 500 });
    }
  }

  const workspaces = [...merged.values()]
    .sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    )
    .map((row) => toWorkspaceSummary(row, activeToken));

  return NextResponse.json({ workspaces });
}

export async function POST(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  const json = await request.json().catch(() => ({}));
  const parsed = createSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const cookieStore = await cookies();
  const activeToken = cookieStore.get(WORKSPACE_COOKIE)?.value;
  await ensureRegistrySeeded(activeToken);

  const visitorToken = randomBytes(32).toString("hex");
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from(STYLIST_TABLES.workspaces)
    .insert({
      visitor_token: visitorToken,
      name: parsed.data.workspaceName,
      settings: mergeWorkspaceSettings(null, {
        mission: parsed.data.mission,
        profile: parsed.data.profile,
      }),
    })
    .select("*")
    .single();

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? "Failed" }, { status: 500 });
  }

  await ensureMemoryRows(data.id);
  await ensureDefaultWardrobe(data.id);

  await addTokenToRegistry(visitorToken);
  cookieStore.set(WORKSPACE_COOKIE, visitorToken, getCookieOptions());

  return NextResponse.json({
    workspace: toWorkspaceSummary(data, visitorToken),
  });
}
