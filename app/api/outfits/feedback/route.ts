import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient, isSupabaseConfigured } from "@/lib/supabase/admin";
import { STYLIST_TABLES } from "@/lib/supabase/tables";
import { requireWorkspace } from "@/lib/workspace/session";
import {
  recordPreferenceSignal,
  summarizeMemoryFromFeedback,
} from "@/lib/memory/service";
import { ONBOARDING_COPY } from "@/lib/chrysty/onboarding";
import type { OutfitLook } from "@/types/database";

const feedbackSchema = z.object({
  lookId: z.string().uuid(),
  feedback: z.enum(["loved", "off", "almost", "more_like_this", "too_formal"]),
});

export async function POST(request: Request) {
  try {
    if (!isSupabaseConfigured()) {
      return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
    }

    const workspace = await requireWorkspace();
    const body = feedbackSchema.parse(await request.json());
    const supabase = createAdminClient();

    const { data: lookRow } = await supabase
      .from(STYLIST_TABLES.outfitLooks)
      .select("*")
      .eq("id", body.lookId)
      .single();

    if (!lookRow) {
      return NextResponse.json({ error: "Look not found" }, { status: 404 });
    }

    const look = lookRow as OutfitLook;

    const { data: generation } = await supabase
      .from(STYLIST_TABLES.outfitGenerations)
      .select("workspace_id")
      .eq("id", look.generation_id)
      .single();

    if (generation?.workspace_id !== workspace.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await supabase
      .from(STYLIST_TABLES.outfitLooks)
      .update({
        feedback: body.feedback,
        ...(body.feedback === "loved" ? { worn_at: new Date().toISOString() } : {}),
      })
      .eq("id", body.lookId);

    await recordPreferenceSignal(
      workspace.id,
      "outfit_feedback",
      { lookId: body.lookId, feedback: body.feedback },
      body.lookId
    );

    await summarizeMemoryFromFeedback({
      workspaceId: workspace.id,
      feedback: body.feedback,
      lookRationale: look.rationale,
      userName: workspace.display_name ?? undefined,
    });

    if (!workspace.onboarding_complete) {
      await supabase
        .from(STYLIST_TABLES.workspaces)
        .update({ onboarding_complete: true })
        .eq("id", workspace.id);
    }

    return NextResponse.json({
      ok: true,
      message: ONBOARDING_COPY.feedback.confirmMessage,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Feedback failed" },
      { status: 400 }
    );
  }
}
