export const maxDuration = 300;

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { v4 as uuidv4 } from "uuid";
import {
  createAdminClient,
  isSupabaseConfigured,
  signStoragePath,
  STORAGE_BUCKETS,
} from "@/lib/supabase/admin";
import { STYLIST_TABLES } from "@/lib/supabase/tables";
import { requireWorkspace } from "@/lib/workspace/session";
import { listBodyReferences, summarizeBodyReferences } from "@/lib/body/service";
import { getMemoryJson } from "@/lib/memory/service";
import { appendMessage, getOrCreateConversation } from "@/lib/chat/service";
import { detectChatIntent, OUTFIT_RESPONSE_TEMPLATE } from "@/lib/chrysty/chat-intents";
import {
  PlatformAccessError,
  requirePlatformAccess,
} from "@/lib/chrysty/guard";
import { trackAgentUsage } from "@/lib/chrysty/track-usage";
import {
  getDefaultWardrobeId,
  getItemImagePath,
  listConfirmedWardrobeItems,
} from "@/lib/wardrobe/service";
import { getModelConfig } from "@/lib/config/models";
import { buildStylingContext } from "@/lib/chrysty/workspace-profile";
import { parseWorkspaceSettings } from "@/lib/workspace/settings";
import { planOutfitsForGeneration } from "@/lib/ai/plan-outfits";
import { generateError, generateLog, normalizeGenerationError } from "@/lib/chrysty/generate-debug";
import { resolveLookWardrobePieces } from "@/lib/wardrobe/resolve-look-pieces";
import type { OutfitLookPlan } from "@/lib/ai/outfit-plan-schema";
import { isFalConfigured } from "@/lib/config/fal";

const schema = z.object({
  message: z.string().min(1),
  lookCount: z.number().int().min(1).max(7).default(1),
});

function wardrobeStoragePath(
  look: OutfitLookPlan,
  wardrobeRows: Awaited<ReturnType<typeof listConfirmedWardrobeItems>>
) {
  const firstId = look.wardrobeItemIds[0];
  const item = wardrobeRows.find((w) => w.id === firstId) ?? wardrobeRows[0];
  return getItemImagePath(item);
}

export async function POST(request: NextRequest) {
  const startedAt = Date.now();
  try {
    await requirePlatformAccess(request);

    if (!isSupabaseConfigured()) {
      generateLog("blocked", { reason: "supabase_not_configured" });
      return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
    }

    const workspace = await requireWorkspace();
    const { message, lookCount } = schema.parse(await request.json());
    const stylingMessage = message.trim();

    generateLog("request", {
      workspaceId: workspace.id,
      workspaceName: workspace.display_name ?? workspace.name,
      message,
      stylingMessage,
      lookCount,
    });

    const supabase = createAdminClient();
    const wardrobeId = await getDefaultWardrobeId(workspace.id);
    const wardrobeRows = await listConfirmedWardrobeItems(workspace.id, wardrobeId);

    const wardrobe = wardrobeRows.map((w) => ({
      id: w.id,
      description: w.description,
      category: w.category,
      colors: w.colors,
      storage_path: getItemImagePath(w),
      thumb_path: w.image?.thumb_path ?? w.thumb_path,
    }));

    if (!wardrobe.length) {
      generateLog("blocked", { reason: "empty_wardrobe", workspaceId: workspace.id });
      return NextResponse.json(
        { error: "Add at least one wardrobe photo first" },
        { status: 400 }
      );
    }

    const memoryJson = await getMemoryJson(workspace.id);
    const workspaceSettings = parseWorkspaceSettings(workspace.settings);
    const workspaceStylingContext = buildStylingContext({
      mission: workspaceSettings.mission,
      profile: workspaceSettings.profile,
    });
    const bodyRefs = await listBodyReferences(workspace.id);

    if (isFalConfigured() && !bodyRefs.length) {
      generateLog("blocked", { reason: "no_body_refs", workspaceId: workspace.id });
      return NextResponse.json(
        { error: "Add your look photo first" },
        { status: 400 }
      );
    }

    const bodyReferenceSummary = summarizeBodyReferences(bodyRefs);
    const intent = detectChatIntent(message);

    const wardrobeCatalog = await Promise.all(
      wardrobeRows.map(async (row) => ({
        id: row.id,
        imageUrl: await signStoragePath(STORAGE_BUCKETS.uploads, getItemImagePath(row)),
        mimeType: "image/jpeg",
        description: row.description,
        category: row.category,
        colors: row.colors,
      }))
    );
    const imageUrlById = new Map(wardrobeCatalog.map((item) => [item.id, item.imageUrl]));

    const modelConfig = getModelConfig();
    generateLog("preprocess_done", {
      intent,
      wardrobeCount: wardrobe.length,
      wardrobeIds: wardrobe.map((w) => w.id),
      bodyRefCount: bodyRefs.length,
      signedCatalogCount: wardrobeCatalog.length,
      hasMemory: Boolean(memoryJson?.trim()),
      hasStylingContext: Boolean(workspaceStylingContext?.trim()),
      mission: workspaceSettings.mission ?? null,
      geminiModel: modelConfig.gemini.outfitPlan,
      elapsedMs: Date.now() - startedAt,
    });

    generateLog("planning_start", { lookCount, stylingMessage });
    const planStartedAt = Date.now();
    const plan = await planOutfitsForGeneration({
      stylingMessage,
      lookCount,
      wardrobe,
      wardrobeCatalog,
      bodyRefs: bodyRefs.map((b) => ({ imageUrl: b.imageUrl, referenceType: b.referenceType })),
      memoryJson,
      userName: workspace.display_name ?? undefined,
      workspaceMission: workspaceSettings.mission ?? undefined,
      workspaceStylingContext,
      bodyReferenceSummary,
    });
    try {
      await trackAgentUsage({
        inputTokens: Math.ceil(stylingMessage.length / 4),
        outputTokens: Math.ceil(
          (plan.assistantMessage.length + plan.planningReasoning.length) / 4
        ),
      });
    } catch (error) {
      console.error("[usage/track] Failed to record usage:", error);
    }
    const looksToSave = plan.looks.slice(0, lookCount);
    generateLog("planning_done", {
      plannedLooks: plan.looks.length,
      looksToRender: looksToSave.length,
      planningMs: Date.now() - planStartedAt,
      looks: looksToSave.map((look, i) => ({
        index: i + 1,
        styleDirection: look.styleDirection,
        vibe: look.vibe,
        occasionTag: look.occasionTag,
        wardrobeItemIds: look.wardrobeItemIds,
        selectedItemIds: resolveLookWardrobePieces(
          look.wardrobeItemIds,
          wardrobeRows,
          imageUrlById
        ).map((piece) => piece.id),
        isStylistPick: look.isStylistPick ?? false,
      })),
    });

    const conversation = await getOrCreateConversation(workspace.id);
    await appendMessage(conversation.id, "user", message, {}, workspace.id);

    const { data: generation, error: genError } = await supabase
      .from(STYLIST_TABLES.outfitGenerations)
      .insert({
        workspace_id: workspace.id,
        wardrobe_id: wardrobeId,
        conversation_id: conversation.id,
        user_prompt: message,
        intent,
        prompt_context: {
          message,
          stylingMessage,
          lookCount,
          intent,
          workspaceProfile: workspaceSettings.profile,
          mission: workspaceSettings.mission,
          plan,
        },
        status: "pending",
        model_config: getModelConfig(),
      })
      .select("*")
      .single();

    if (genError || !generation) throw genError;

    const savedLooks = await Promise.all(
      looksToSave.map(async (look) => {
        const lookId = uuidv4();
        const storagePath = wardrobeStoragePath(look, wardrobeRows);

        const { data: lookRow, error: lookError } = await supabase
          .from(STYLIST_TABLES.outfitLooks)
          .insert({
            id: lookId,
            generation_id: generation.id,
            image_id: null,
            storage_path: storagePath,
            wardrobe_item_ids: look.wardrobeItemIds,
            rationale: look.rationale,
            vibe: look.vibe,
            occasion_tag: look.occasionTag,
            is_stylist_pick: look.isStylistPick ?? false,
          })
          .select("*")
          .single();

        if (lookError || !lookRow) throw lookError;

        await supabase.from(STYLIST_TABLES.outfitLookItems).insert(
          look.wardrobeItemIds.map((wardrobeItemId, index) => ({
            look_id: lookId,
            wardrobe_item_id: wardrobeItemId,
            sort_order: index,
          }))
        );

        return { lookRow, planLook: look };
      })
    );

    const stylistPick = savedLooks.find((l) => l.lookRow.is_stylist_pick) ?? savedLooks[0];
    const falRendering = isFalConfigured();
    const generationStatus = falRendering ? "rendering" : "complete";

    await supabase
      .from(STYLIST_TABLES.outfitGenerations)
      .update({
        ...(stylistPick ? { stylist_pick_id: stylistPick.lookRow.id } : {}),
        status: generationStatus,
      })
      .eq("id", generation.id);

    const intro =
      OUTFIT_RESPONSE_TEMPLATE.introByIntent[intent] || plan.assistantMessage;
    const assistantContent = `${intro}\n\n${plan.assistantMessage}`;

    await appendMessage(
      conversation.id,
      "assistant",
      assistantContent,
      {
        type: "outfit_generation",
        generationId: generation.id,
        lookIds: savedLooks.map((l) => l.lookRow.id),
        wardrobeId,
        intent,
      },
      workspace.id
    );

    generateLog("complete", {
      generationId: generation.id,
      lookCount: savedLooks.length,
      stylistPickId: stylistPick?.lookRow.id ?? null,
      totalMs: Date.now() - startedAt,
    });

    return NextResponse.json({
      generationId: generation.id,
      rendering: falRendering,
      generationStatus,
      message: assistantContent,
      planningReasoning: plan.planningReasoning,
      assistantMessage: plan.assistantMessage,
      looks: savedLooks.map(({ lookRow, planLook }) => ({
        id: lookRow.id,
        rationale: lookRow.rationale,
        vibe: lookRow.vibe,
        occasionTag: lookRow.occasion_tag,
        isStylistPick: lookRow.is_stylist_pick,
        wardrobeItemIds: lookRow.wardrobe_item_ids,
        selectedItems: resolveLookWardrobePieces(
          lookRow.wardrobe_item_ids ?? [],
          wardrobeRows,
          imageUrlById
        ),
        styleDirection: planLook.styleDirection,
        stylingReasoning: planLook.stylingReasoning,
        itemReasoning: planLook.itemReasoning,
      })),
      heroLabel: OUTFIT_RESPONSE_TEMPLATE.heroLabel,
    });
  } catch (e) {
    if (e instanceof PlatformAccessError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    generateError("failed", e);
    const { message } = normalizeGenerationError(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
