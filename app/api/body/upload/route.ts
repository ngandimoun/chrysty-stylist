export const maxDuration = 60;

import { NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import {
  createAdminClient,
  isSupabaseConfigured,
  signStoragePathWithFallback,
  STORAGE_BUCKETS,
  stylistBodyPath,
} from "@/lib/supabase/admin";
import { assertBodyUploadAllowed } from "@/lib/body/service";
import { createPendingUpload, finalizeUploadedImage } from "@/lib/images/service";
import { normalizeImageUpload } from "@/lib/images/normalize-upload";
import type { BodyReferenceType } from "@/lib/uploads/limits";
import { bodyReferenceToUploadAsset } from "@/lib/uploads/asset";
import { requireWorkspace } from "@/lib/workspace/session";

export async function POST(request: Request) {
  try {
    if (!isSupabaseConfigured()) {
      return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
    }

    const workspace = await requireWorkspace();
    await assertBodyUploadAllowed(workspace.id);

    const formData = await request.formData();
    const file = formData.get("file");
    if (!file || typeof file === "string") {
      return NextResponse.json({ error: "File required" }, { status: 400 });
    }

    const filename =
      (typeof formData.get("filename") === "string" && formData.get("filename")) ||
      "image.jpg";
    const referenceTypeRaw = formData.get("referenceType");
    const referenceType: BodyReferenceType =
      referenceTypeRaw === "face" || referenceTypeRaw === "mannequin"
        ? referenceTypeRaw
        : "body";
    const mimeType = file.type || "application/octet-stream";
    const imageId = uuidv4();
    const rawBuffer = Buffer.from(await file.arrayBuffer());
    const normalized = await normalizeImageUpload(rawBuffer, mimeType);
    const storagePath = stylistBodyPath(workspace.id, imageId, normalized.ext);

    const supabase = createAdminClient();

    const pendingImage = await createPendingUpload({
      workspaceId: workspace.id,
      imageId,
      storagePath,
      mimeType: normalized.mimeType,
      source: "body",
    });

    const { error: uploadError } = await supabase.storage
      .from(STORAGE_BUCKETS.uploads)
      .upload(storagePath, normalized.buffer, {
        contentType: normalized.mimeType,
        upsert: true,
      });
    if (uploadError) throw uploadError;

    const processed = await finalizeUploadedImage({
      image: pendingImage,
      originalBuffer: normalized.buffer,
      vision: { referenceType },
    });

    const imageUrl = await signStoragePathWithFallback(
      STORAGE_BUCKETS.uploads,
      processed.thumb_path ?? processed.storage_path,
      processed.storage_path
    );

    return NextResponse.json({
      item: bodyReferenceToUploadAsset({
        id: processed.id,
        imageUrl,
        storagePath: processed.storage_path,
        referenceType,
      }),
    });
  } catch (e) {
    console.error("[body/upload]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Upload failed" },
      { status: 500 }
    );
  }
}
