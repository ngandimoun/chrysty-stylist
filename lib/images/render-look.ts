import { v4 as uuidv4 } from "uuid";
import {
  createAdminClient,
  signStoragePath,
  stylistOutfitPath,
  STORAGE_BUCKETS,
} from "@/lib/supabase/admin";
import { STYLIST_TABLES } from "@/lib/supabase/tables";
import { registerGeneratedImage } from "@/lib/images/service";
import { craftFalEditPrompt } from "@/lib/ai/craft-fal-prompt";
import {
  buildValidatedWardrobeIds,
  hasBlockingValidationFailures,
} from "@/lib/ai/fal-edit-prompt";
import {
  fetchFalImageBuffer,
  renderLookWithFal,
  uploadStoragePathsToFal,
} from "@/lib/ai/fal-image";
import type { OutfitLookPlan } from "@/lib/ai/outfit-plan-schema";
import type { FalBodyRefInput, FalWardrobePieceInput } from "@/lib/ai/fal-edit-prompt-schema";
import { getFalConfig } from "@/lib/config/fal";
import { generateError, generateLog } from "@/lib/chrysty/generate-debug";
import { buildFalRenderPromptSuffix } from "@/lib/chrysty/fal-render-rules";
import { buildStyledLookImage } from "@/lib/images/lookbook-composite";
import { getItemImagePath, listConfirmedWardrobeItems } from "@/lib/wardrobe/service";
import type { BodyReference } from "@/lib/body/service";

export type RenderLookParams = {
  workspaceId: string;
  generationId: string;
  lookId: string;
  planLook: OutfitLookPlan;
  stylingMessage: string;
  bodyRefs: BodyReference[];
  wardrobeRows: Awaited<ReturnType<typeof listConfirmedWardrobeItems>>;
};

async function buildWardrobePieces(
  look: OutfitLookPlan,
  wardrobeRows: Awaited<ReturnType<typeof listConfirmedWardrobeItems>>
): Promise<FalWardrobePieceInput[]> {
  const pieces = await Promise.all(
    look.wardrobeItemIds.map(async (id, sortIndex) => {
      const row = wardrobeRows.find((w) => w.id === id);
      if (!row) return null;
      const storagePath = getItemImagePath(row);
      return {
        id: row.id,
        sortIndex,
        category: row.category,
        description: row.description,
        colors: row.colors,
        imageUrl: await signStoragePath(STORAGE_BUCKETS.uploads, storagePath),
        storagePath,
      };
    })
  );

  return pieces.filter((p): p is FalWardrobePieceInput => p !== null);
}

function buildBodyRefInputs(bodyRefs: BodyReference[]): FalBodyRefInput[] {
  return bodyRefs.map((b, index) => ({
    id: b.id,
    index,
    referenceType: b.referenceType,
    imageUrl: b.imageUrl,
    storagePath: b.storagePath,
  }));
}

export async function renderAndStoreLook(params: RenderLookParams): Promise<{
  imageId: string;
  storagePath: string;
} | null> {
  const { workspaceId, generationId, lookId, planLook, stylingMessage, bodyRefs, wardrobeRows } =
    params;

  if (!bodyRefs.length) {
    generateLog("render_look_skipped", { lookId, reason: "no_body_refs" });
    return null;
  }

  const wardrobePieces = await buildWardrobePieces(planLook, wardrobeRows);
  if (!wardrobePieces.length) {
    generateLog("render_look_skipped", { lookId, reason: "no_wardrobe_pieces" });
    return null;
  }

  const bodyInputs = buildBodyRefInputs(bodyRefs);

  const falPrompt = await craftFalEditPrompt({
    look: planLook,
    stylingMessage,
    bodyRefs: bodyInputs,
    wardrobePieces,
  });

  if (hasBlockingValidationFailures(falPrompt)) {
    generateLog("render_look_skipped", {
      lookId,
      reason: "validation_failed",
      invalid: falPrompt.assignmentValidation.filter((v) => !v.isValid),
    });
    return null;
  }

  const validWardrobeIds = buildValidatedWardrobeIds(falPrompt, planLook.wardrobeItemIds);
  const orderedWardrobePaths = validWardrobeIds
    .map((id) => wardrobePieces.find((w) => w.id === id)?.storagePath)
    .filter((p): p is string => Boolean(p));

  const bodyPaths = bodyRefs.map((b) => b.storagePath);
  const allStoragePaths = [...bodyPaths, ...orderedWardrobePaths];

  generateLog("render_look_fal_upload", {
    lookId,
    bodyCount: bodyPaths.length,
    wardrobeCount: orderedWardrobePaths.length,
    primaryLookImageIndex: falPrompt.primaryLookImageIndex,
    sceneType: falPrompt.sceneType,
  });

  generateLog("styled_image_layout", {
    lookId,
    mode: falPrompt.styledImageLayout.mode,
    insetCount: falPrompt.styledImageLayout.insets.length,
    insets: falPrompt.styledImageLayout.insets.map((i) => ({
      zone: i.cropZone,
      focus: i.focusLabel,
    })),
  });

  const falImageUrls = await uploadStoragePathsToFal(allStoragePaths);

  const fullPrompt = [
    falPrompt.editPrompt.includes(stylingMessage)
      ? falPrompt.editPrompt
      : `User request: ${stylingMessage}. ${falPrompt.editPrompt}`,
    falPrompt.preserveInstructions,
    "Do not swap outfits between people. Do not change anyone's perceived gender presentation.",
    buildFalRenderPromptSuffix(),
  ].join(" ");

  generateLog("render_look_fal_prompt", {
    lookId,
    stylingMessage,
    promptPreview: fullPrompt.slice(0, 240),
  });

  const falResult = await renderLookWithFal({
    prompt: fullPrompt,
    imageUrls: falImageUrls,
  });

  const rawBuffer = await fetchFalImageBuffer(falResult.url);
  const cfg = getFalConfig();
  const imageBuffer = cfg.lookbookCompositeEnabled
    ? await buildStyledLookImage({
        heroBuffer: rawBuffer,
        layout: falPrompt.styledImageLayout,
      })
    : rawBuffer;
  const contentType = cfg.lookbookCompositeEnabled
    ? "image/png"
    : cfg.outputFormat === "png"
      ? "image/png"
      : "image/jpeg";
  const ext = cfg.lookbookCompositeEnabled ? "png" : cfg.outputFormat === "png" ? "png" : "jpg";
  const storagePath = stylistOutfitPath(workspaceId, generationId, lookId).replace(
    /\.jpg$/,
    `.${ext}`
  );

  const supabase = createAdminClient();
  const { error: uploadError } = await supabase.storage
    .from(STORAGE_BUCKETS.uploads)
    .upload(storagePath, imageBuffer, { contentType, upsert: true });

  if (uploadError) throw uploadError;

  const imageId = uuidv4();
  await registerGeneratedImage({ workspaceId, imageId, storagePath });

  const { error: lookError } = await supabase
    .from(STYLIST_TABLES.outfitLooks)
    .update({ image_id: imageId, storage_path: storagePath })
    .eq("id", lookId);

  if (lookError) throw lookError;

  generateLog("render_look_done", { lookId, imageId, storagePath, requestId: falResult.requestId });

  return { imageId, storagePath };
}

export async function renderAndStoreLookSafe(params: RenderLookParams) {
  try {
    return await renderAndStoreLook(params);
  } catch (e) {
    generateError("render_look_failed", e);
    return null;
  }
}
