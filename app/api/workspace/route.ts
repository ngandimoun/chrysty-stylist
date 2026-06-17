import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { cookies } from "next/headers";
import { z } from "zod";
import { createAdminClient, isSupabaseConfigured } from "@/lib/supabase/admin";
import { STYLIST_TABLES } from "@/lib/supabase/tables";
import { ensureMemoryRows } from "@/lib/memory/service";
import { ensureDefaultWardrobe } from "@/lib/wardrobe/service";
import { getCookieOptions, WORKSPACE_COOKIE } from "@/lib/workspace/cookie";
import { addTokenToRegistry } from "@/lib/workspace/registry";
import { mergeWorkspaceSettings, parseWorkspaceSettings } from "@/lib/workspace/settings";
import type { Json } from "@/types/database";

const profileSchema = z.object({
  dressingFor: z.string().min(1),
  styleDescriptors: z.array(z.string()).min(1).max(3),
  stylePriority: z.string().min(1),
});

const bodySchema = z.object({
  displayName: z.string().optional(),
  workspaceName: z.string().optional(),
  mission: z.string().max(280).optional(),
  profile: profileSchema.optional(),
  onboardingComplete: z.boolean().optional(),
});

function serializeWorkspace(workspace: {
  id: string;
  name: string;
  display_name: string | null;
  onboarding_complete: boolean;
  settings: Json;
}) {
  const settings = parseWorkspaceSettings(workspace.settings);
  return {
    id: workspace.id,
    name: workspace.name,
    displayName: workspace.display_name,
    mission: settings.mission ?? null,
    profile: settings.profile ?? null,
    onboardingComplete: workspace.onboarding_complete,
  };
}

export async function POST(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  const cookieStore = await cookies();
  const existingToken = cookieStore.get(WORKSPACE_COOKIE)?.value;

  if (existingToken) {
    const { getWorkspaceFromCookie } = await import("@/lib/workspace/session");
    const existing = await getWorkspaceFromCookie();
    if (existing) {
      return NextResponse.json({
        workspace: serializeWorkspace(existing),
      });
    }
  }

  const json = await request.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(json);
  const displayName = parsed.success ? parsed.data.displayName : undefined;
  const workspaceName = parsed.success ? parsed.data.workspaceName : "My Style";

  const visitorToken = randomBytes(32).toString("hex");
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from(STYLIST_TABLES.workspaces)
    .insert({
      visitor_token: visitorToken,
      name: workspaceName ?? "My Style",
      display_name: displayName ?? null,
    })
    .select("*")
    .single();

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? "Failed" }, { status: 500 });
  }

  await ensureMemoryRows(data.id);
  await ensureDefaultWardrobe(data.id);

  cookieStore.set(WORKSPACE_COOKIE, visitorToken, getCookieOptions());
  await addTokenToRegistry(visitorToken);

  return NextResponse.json({
    workspace: serializeWorkspace(data),
  });
}

export async function PATCH(request: Request) {
  try {
    const workspace = await (await import("@/lib/workspace/session")).requireWorkspace();
    const json = await request.json();
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid body" }, { status: 400 });
    }

    const supabase = createAdminClient();
    const updates: {
      display_name?: string | null;
      name?: string;
      onboarding_complete?: boolean;
      settings?: ReturnType<typeof mergeWorkspaceSettings>;
      updated_at?: string;
    } = {};

    if (parsed.data.displayName !== undefined) {
      updates.display_name = parsed.data.displayName;
    }
    if (parsed.data.workspaceName !== undefined) {
      updates.name = parsed.data.workspaceName;
    }
    if (parsed.data.onboardingComplete !== undefined) {
      updates.onboarding_complete = parsed.data.onboardingComplete;
    }

    if (parsed.data.mission !== undefined || parsed.data.profile !== undefined) {
      const settingsPatch: Parameters<typeof mergeWorkspaceSettings>[1] = {};
      if (parsed.data.mission !== undefined) {
        settingsPatch.mission = parsed.data.mission;
      }
      if (parsed.data.profile !== undefined) {
        settingsPatch.profile = parsed.data.profile;
      }
      updates.settings = mergeWorkspaceSettings(workspace.settings, settingsPatch);
      updates.updated_at = new Date().toISOString();
    }

    const { data, error } = await supabase
      .from(STYLIST_TABLES.workspaces)
      .update(updates)
      .eq("id", workspace.id)
      .select("*")
      .single();

    if (error) throw error;

    return NextResponse.json({
      workspace: serializeWorkspace(data),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Update failed";
    const status = e instanceof z.ZodError ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function GET() {
  try {
    const { getWorkspaceFromCookie } = await import("@/lib/workspace/session");
    const workspace = await getWorkspaceFromCookie();
    if (!workspace) {
      return NextResponse.json({ workspace: null });
    }
    return NextResponse.json({
      workspace: serializeWorkspace(workspace),
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to load workspace" },
      { status: 500 }
    );
  }
}
