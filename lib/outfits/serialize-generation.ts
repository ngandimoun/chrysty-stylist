import {
  signStoragePath,
  STORAGE_BUCKETS,
} from "@/lib/supabase/admin";
import {
  getItemImagePath,
  listConfirmedWardrobeItems,
} from "@/lib/wardrobe/service";
import { resolveLookWardrobePieces } from "@/lib/wardrobe/resolve-look-pieces";
import type { OutfitLook } from "@/types/database";
import type { OutfitLookPlan } from "@/lib/ai/outfit-plan-schema";
import type { OutfitLookUI } from "@/store/ui";

export const GENERATION_HISTORY_LIMIT = 20;

export const DEFAULT_USER_PROMPT_LABEL = "Your request";

export type GenerationRecord = {
  id: string;
  user_prompt: string | null;
  prompt_context: unknown;
  status: string;
  created_at: string;
};

function planLookAt(
  promptContext: Record<string, unknown> | null | undefined,
  index: number
): OutfitLookPlan | undefined {
  const plan = promptContext?.plan as { looks?: OutfitLookPlan[] } | undefined;
  return plan?.looks?.[index];
}

export async function toLookUI(
  look: OutfitLook,
  index: number,
  promptContext: Record<string, unknown> | null | undefined,
  imageUrlById: Map<string, string>,
  wardrobeRows: Awaited<ReturnType<typeof listConfirmedWardrobeItems>>
): Promise<OutfitLookUI> {
  const planLook = planLookAt(promptContext, index);
  const wardrobeItemIds = look.wardrobe_item_ids ?? [];
  const hasGeneratedImage = Boolean(look.image_id);
  let imageUrl: string | null = null;

  if (hasGeneratedImage) {
    imageUrl = await signStoragePath(STORAGE_BUCKETS.uploads, look.storage_path);
  }

  return {
    id: look.id,
    rationale: look.rationale,
    vibe: look.vibe,
    occasionTag: look.occasion_tag,
    isStylistPick: look.is_stylist_pick,
    wardrobeItemIds,
    selectedItems: resolveLookWardrobePieces(wardrobeItemIds, wardrobeRows, imageUrlById),
    styleDirection: planLook?.styleDirection,
    stylingReasoning: planLook?.stylingReasoning,
    itemReasoning: planLook?.itemReasoning,
    imageUrl,
    renderStatus: hasGeneratedImage ? "ready" : "pending",
    downloadUrl: `/api/outfits/${look.id}/download`,
  };
}

export type SerializedGeneration = {
  generationId: string;
  userPrompt: string;
  createdAt: string;
  generationStatus: string | null;
  looks: OutfitLookUI[];
  renderedCount: number;
  totalCount: number;
};

export async function serializeGeneration(
  generation: GenerationRecord,
  looks: OutfitLook[],
  wardrobeRows: Awaited<ReturnType<typeof listConfirmedWardrobeItems>>,
  imageUrlById: Map<string, string>
): Promise<SerializedGeneration> {
  const promptContext = generation.prompt_context as Record<string, unknown> | null;
  const uiLooks = await Promise.all(
    looks.map((row, index) => toLookUI(row, index, promptContext, imageUrlById, wardrobeRows))
  );
  const renderedCount = uiLooks.filter((l) => l.renderStatus === "ready").length;

  return {
    generationId: generation.id,
    userPrompt: generation.user_prompt?.trim() || DEFAULT_USER_PROMPT_LABEL,
    createdAt: generation.created_at,
    generationStatus: generation.status ?? null,
    looks: uiLooks,
    renderedCount,
    totalCount: uiLooks.length,
  };
}

export async function buildWardrobeImageMap(workspaceId: string) {
  const wardrobeRows = await listConfirmedWardrobeItems(workspaceId);
  const imageUrlById = new Map(
    await Promise.all(
      wardrobeRows.map(async (row) => [
        row.id,
        await signStoragePath(STORAGE_BUCKETS.uploads, getItemImagePath(row)),
      ] as const)
    )
  );

  return { wardrobeRows, imageUrlById };
}
