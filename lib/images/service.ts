import { createHash } from "crypto";
import sharp from "sharp";
import {
  createAdminClient,
  STORAGE_BUCKETS,
  signStoragePath,
} from "@/lib/supabase/admin";
import { STYLIST_TABLES } from "@/lib/supabase/tables";
import { analyzeWardrobeItem } from "@/lib/ai/wardrobe-analyze";
import { createThumbnail } from "@/lib/ai/collage";
import type { BodyReferenceType, UploadSource } from "@/lib/uploads/limits";
import type { UploadedImage, Json } from "@/types/database";
import type { WardrobeItemMetadata } from "@/lib/memory/schema";

async function downloadUploadedObject(storagePath: string): Promise<Buffer> {
  const supabase = createAdminClient();
  const delays = [0, 400, 800];
  let lastError: Error | null = null;

  for (const delay of delays) {
    if (delay > 0) {
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
    const { data, error } = await supabase.storage
      .from(STORAGE_BUCKETS.uploads)
      .download(storagePath);
    if (!error && data) {
      return Buffer.from(await data.arrayBuffer());
    }
    lastError = error ?? new Error("Object not found");
  }

  throw lastError;
}

async function persistImageVariants(params: {
  image: UploadedImage;
  originalBuffer: Buffer;
  vision: Record<string, unknown> | WardrobeItemMetadata | null;
}): Promise<UploadedImage> {
  const supabase = createAdminClient();
  const contentHash = createHash("sha256").update(params.originalBuffer).digest("hex");
  const meta = await sharp(params.originalBuffer).metadata();
  const thumbBuffer = await createThumbnail(params.originalBuffer);
  const thumbPath = params.image.storage_path.replace(/original\.[a-z0-9]+$/i, "thumb.jpg");

  let savedThumbPath: string | null = thumbPath;
  const { error: thumbError } = await supabase.storage
    .from(STORAGE_BUCKETS.uploads)
    .upload(thumbPath, thumbBuffer, { contentType: "image/jpeg", upsert: true });
  if (thumbError) {
    console.warn("[images] thumb upload failed, using original path", thumbError.message);
    savedThumbPath = null;
  }

  const { data: updated, error } = await supabase
    .from(STYLIST_TABLES.uploadedImages)
    .update({
      thumb_path: savedThumbPath,
      byte_size: params.originalBuffer.length,
      width: meta.width ?? null,
      height: meta.height ?? null,
      content_hash: contentHash,
      status: "ready",
      vision: (params.vision ?? {}) as Json,
    })
    .eq("id", params.image.id)
    .select("*")
    .single();

  if (error) throw error;
  return updated as UploadedImage;
}

export async function createPendingUpload(params: {
  workspaceId: string;
  imageId: string;
  storagePath: string;
  mimeType: string;
  source: UploadSource;
}) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from(STYLIST_TABLES.uploadedImages)
    .insert({
      id: params.imageId,
      workspace_id: params.workspaceId,
      storage_path: params.storagePath,
      mime_type: params.mimeType,
      status: "pending",
      source: params.source,
    })
    .select("*")
    .single();

  if (error) throw error;
  return data as UploadedImage;
}

export async function finalizeUploadedImage(params: {
  image: UploadedImage;
  originalBuffer: Buffer;
  vision?: Record<string, unknown> | WardrobeItemMetadata | null;
}): Promise<UploadedImage> {
  return persistImageVariants({
    image: params.image,
    originalBuffer: params.originalBuffer,
    vision: params.vision ?? null,
  });
}

export async function processStoredImage(params: {
  image: UploadedImage;
  vision?: Record<string, unknown> | null;
}): Promise<UploadedImage> {
  const originalBuffer = await downloadUploadedObject(params.image.storage_path);
  return finalizeUploadedImage({
    image: params.image,
    originalBuffer,
    vision: params.vision ?? null,
  });
}

export async function processUploadedImage(params: {
  image: UploadedImage;
  userLabel?: string;
}): Promise<{
  image: UploadedImage;
  analysis: WardrobeItemMetadata;
  analyzed: boolean;
}> {
  const originalBuffer = await downloadUploadedObject(params.image.storage_path);
  const signedUrl = await signStoragePath(STORAGE_BUCKETS.uploads, params.image.storage_path);
  const { metadata: analysis, analyzed } = await analyzeWardrobeItem(signedUrl, params.userLabel);
  const image = await persistImageVariants({
    image: params.image,
    originalBuffer,
    vision: { ...analysis, analyzed },
  });

  return { image, analysis, analyzed };
}

export async function processBodyReference(params: {
  image: UploadedImage;
  referenceType?: BodyReferenceType;
}): Promise<UploadedImage> {
  const referenceType = params.referenceType ?? "body";
  return processStoredImage({
    image: params.image,
    vision: { referenceType },
  });
}

export async function registerGeneratedImage(params: {
  workspaceId: string;
  imageId: string;
  storagePath: string;
}) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from(STYLIST_TABLES.uploadedImages)
    .insert({
      id: params.imageId,
      workspace_id: params.workspaceId,
      storage_path: params.storagePath,
      mime_type: "image/jpeg",
      status: "ready",
      source: "generated",
    })
    .select("*")
    .single();

  if (error) throw error;
  return data;
}

export async function resolveImagePath(imageId: string | null, fallbackPath: string): Promise<string> {
  if (!imageId) return fallbackPath;
  const supabase = createAdminClient();
  const { data } = await supabase
    .from(STYLIST_TABLES.uploadedImages)
    .select("storage_path, thumb_path")
    .eq("id", imageId)
    .single();
  if (!data) return fallbackPath;
  return data.thumb_path ?? data.storage_path;
}
