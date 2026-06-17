import { NextResponse } from "next/server";
import { createAdminClient, isSupabaseConfigured } from "@/lib/supabase/admin";
import { STYLIST_TABLES } from "@/lib/supabase/tables";
import { requireWorkspace } from "@/lib/workspace/session";
import type { OutfitLook } from "@/types/database";
import {
  buildWardrobeImageMap,
  GENERATION_HISTORY_LIMIT,
  serializeGeneration,
  type GenerationRecord,
} from "@/lib/outfits/serialize-generation";

async function loadGenerationLooks(generationId: string) {
  const supabase = createAdminClient();
  const { data: looks, error } = await supabase
    .from(STYLIST_TABLES.outfitLooks)
    .select("*")
    .eq("generation_id", generationId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return (looks ?? []) as OutfitLook[];
}

export async function GET(request: Request) {
  try {
    if (!isSupabaseConfigured()) {
      return NextResponse.json({
        looks: [],
        generations: [],
        generationId: null,
        generationStatus: null,
      });
    }

    const workspace = await requireWorkspace();
    const supabase = createAdminClient();
    const { searchParams } = new URL(request.url);
    const requestedGenerationId = searchParams.get("generationId");

    if (requestedGenerationId) {
      const { data: generationRecord } = await supabase
        .from(STYLIST_TABLES.outfitGenerations)
        .select("id, user_prompt, prompt_context, status, created_at")
        .eq("id", requestedGenerationId)
        .eq("workspace_id", workspace.id)
        .maybeSingle();

      if (!generationRecord) {
        return NextResponse.json({
          looks: [],
          generationId: null,
          generationStatus: null,
          renderedCount: 0,
          totalCount: 0,
        });
      }

      const looks = await loadGenerationLooks(generationRecord.id);
      if (!looks.length) {
        return NextResponse.json({
          looks: [],
          generationId: generationRecord.id,
          generationStatus: generationRecord.status ?? null,
          renderedCount: 0,
          totalCount: 0,
        });
      }

      const { wardrobeRows, imageUrlById } = await buildWardrobeImageMap(workspace.id);
      const serialized = await serializeGeneration(
        generationRecord as GenerationRecord,
        looks,
        wardrobeRows,
        imageUrlById
      );

      return NextResponse.json({
        looks: serialized.looks,
        generationId: serialized.generationId,
        generationStatus: serialized.generationStatus,
        renderedCount: serialized.renderedCount,
        totalCount: serialized.totalCount,
      });
    }

    const { data: generationRecords, error: generationsError } = await supabase
      .from(STYLIST_TABLES.outfitGenerations)
      .select("id, user_prompt, prompt_context, status, created_at")
      .eq("workspace_id", workspace.id)
      .order("created_at", { ascending: false })
      .limit(GENERATION_HISTORY_LIMIT);

    if (generationsError) throw generationsError;

    if (!generationRecords?.length) {
      return NextResponse.json({ generations: [] });
    }

    const { wardrobeRows, imageUrlById } = await buildWardrobeImageMap(workspace.id);
    const generations = await Promise.all(
      generationRecords.map(async (record) => {
        const looks = await loadGenerationLooks(record.id);
        return serializeGeneration(
          record as GenerationRecord,
          looks,
          wardrobeRows,
          imageUrlById
        );
      })
    );

    const nonEmptyGenerations = generations.filter((g) => g.totalCount > 0);

    return NextResponse.json({ generations: nonEmptyGenerations });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to load looks" },
      { status: 400 }
    );
  }
}
