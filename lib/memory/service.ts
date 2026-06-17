import { createAdminClient } from "@/lib/supabase/admin";
import { STYLIST_TABLES } from "@/lib/supabase/tables";
import { mergeMemorySummary } from "@/lib/ai/openai";
import {
  EMPTY_MEMORY,
  MEMORY_SECTION_LABELS,
  MEMORY_SECTIONS,
  type MemorySection,
  type MemorySectionContent,
} from "@/lib/memory/schema";
import type { MemoryCard, Json } from "@/types/database";

export async function getMemoryCards(workspaceId: string): Promise<MemoryCard[]> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from(STYLIST_TABLES.memorySummaries)
    .select("*")
    .eq("workspace_id", workspaceId);

  const map = new Map<string, MemorySectionContent>();
  for (const section of MEMORY_SECTIONS) {
    map.set(section, EMPTY_MEMORY[section]);
  }
  for (const row of data ?? []) {
    const content = row.content as MemorySectionContent;
    map.set(row.section as MemorySection, content);
  }

  return MEMORY_SECTIONS.map((section) => ({
    section,
    label: MEMORY_SECTION_LABELS[section],
    bullets: map.get(section)?.bullets ?? [],
  }));
}

export async function getMemoryJson(workspaceId: string): Promise<string> {
  const cards = await getMemoryCards(workspaceId);
  return JSON.stringify(
    Object.fromEntries(cards.map((c) => [c.section, c.bullets]))
  );
}

export async function ensureMemoryRows(workspaceId: string) {
  const supabase = createAdminClient();
  for (const section of MEMORY_SECTIONS) {
    await supabase.from(STYLIST_TABLES.memorySummaries).upsert(
      {
        workspace_id: workspaceId,
        section,
        content: EMPTY_MEMORY[section],
        updated_at: new Date().toISOString(),
      },
      { onConflict: "workspace_id,section" }
    );
  }
}

export async function recordPreferenceSignal(
  workspaceId: string,
  signalType: string,
  payload: Json,
  sourceLookId?: string
) {
  const supabase = createAdminClient();
  await supabase.from(STYLIST_TABLES.preferenceSignals).insert({
    workspace_id: workspaceId,
    signal_type: signalType,
    payload,
    source_look_id: sourceLookId ?? null,
  });
}

export async function summarizeMemoryFromFeedback(params: {
  workspaceId: string;
  feedback: string;
  lookRationale?: string;
  userName?: string;
}) {
  const supabase = createAdminClient();
  await ensureMemoryRows(params.workspaceId);

  const section: MemorySection =
    params.feedback === "loved" || params.feedback === "more_like_this"
      ? "works"
      : params.feedback === "off" || params.feedback === "too_formal"
        ? "avoid"
        : "words";

  const signal =
    params.feedback === "loved"
      ? `Loved look: ${params.lookRationale ?? "recent outfit"}`
      : params.feedback === "off"
        ? `Did not like: ${params.lookRationale ?? "recent outfit"}`
        : params.feedback === "too_formal"
          ? "Prefers less formal looks"
          : params.feedback === "more_like_this"
            ? `Wants more looks like: ${params.lookRationale ?? "recent outfit"}`
            : "Wants slight adjustments to recommendations";

  const { data: existing } = await supabase
    .from(STYLIST_TABLES.memorySummaries)
    .select("content")
    .eq("workspace_id", params.workspaceId)
    .eq("section", section)
    .single();

  const current = (existing?.content as MemorySectionContent)?.bullets ?? [];
  const merged = await mergeMemorySummary({
    section,
    existing: current,
    newSignals: [signal],
  });

  await supabase
    .from(STYLIST_TABLES.memorySummaries)
    .update({
      content: { bullets: merged },
      updated_at: new Date().toISOString(),
    })
    .eq("workspace_id", params.workspaceId)
    .eq("section", section);
}

export async function updateMemoryFromChat(workspaceId: string, userMessage: string) {
  const lower = userMessage.toLowerCase();
  if (!/(moved|new job|prefer|don't like|no heels|casual now|more formal)/i.test(lower)) {
    return;
  }

  await ensureMemoryRows(workspaceId);
  const supabase = createAdminClient();
  const section: MemorySection = /don't like|no |avoid/i.test(lower) ? "avoid" : "words";
  const { data: existing } = await supabase
    .from(STYLIST_TABLES.memorySummaries)
    .select("content")
    .eq("workspace_id", workspaceId)
    .eq("section", section)
    .single();

  const current = (existing?.content as MemorySectionContent)?.bullets ?? [];
  const merged = await mergeMemorySummary({
    section,
    existing: current,
    newSignals: [userMessage.slice(0, 120)],
  });

  await supabase
    .from(STYLIST_TABLES.memorySummaries)
    .update({
      content: { bullets: merged },
      updated_at: new Date().toISOString(),
    })
    .eq("workspace_id", workspaceId)
    .eq("section", section);
}
