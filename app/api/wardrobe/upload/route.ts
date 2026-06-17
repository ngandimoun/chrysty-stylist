export const maxDuration = 60;

import { NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import {
  createAdminClient,
  isSupabaseConfigured,
  signStoragePathWithFallback,
  STORAGE_BUCKETS,
  stylistWardrobePath,
} from "@/lib/supabase/admin";
import { STYLIST_TABLES } from "@/lib/supabase/tables";
import { createPendingUpload, processUploadedImage } from "@/lib/images/service";
import { normalizeImageUpload } from "@/lib/images/normalize-upload";
import { assertWardrobeUploadAllowed, getDefaultWardrobeId } from "@/lib/wardrobe/service";
import type { WardrobeItemWithImage } from "@/lib/wardrobe/service";
import { wardrobeItemToUploadAsset } from "@/lib/uploads/asset";
import { requireWorkspace } from "@/lib/workspace/session";

export async function POST(request: Request) {
  try {
    if (!isSupabaseConfigured()) {
      return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
    }

    const workspace = await requireWorkspace();
    await assertWardrobeUploadAllowed(workspace.id);

    const formData = await request.formData();
    const file = formData.get("file");
    if (!file || typeof file === "string") {
      return NextResponse.json({ error: "File required" }, { status: 400 });
    }

    const filename =
      (typeof formData.get("filename") === "string" && formData.get("filename")) ||
      "image.jpg";
    const mimeType = file.type || "application/octet-stream";
    const imageId = uuidv4();
    const itemId = uuidv4();
    const wardrobeId = await getDefaultWardrobeId(workspace.id);
    const rawBuffer = Buffer.from(await file.arrayBuffer());
    const normalized = await normalizeImageUpload(rawBuffer, mimeType);
    const storagePath = stylistWardrobePath(workspace.id, imageId, normalized.ext);

    const supabase = createAdminClient();

    const pendingImage = await createPendingUpload({
      workspaceId: workspace.id,
      imageId,
      storagePath,
      mimeType: normalized.mimeType,
      source: "wardrobe",
    });

    const { error: uploadError } = await supabase.storage
      .from(STORAGE_BUCKETS.uploads)
      .upload(storagePath, normalized.buffer, {
        contentType: normalized.mimeType,
        upsert: true,
      });
    if (uploadError) throw uploadError;

    await supabase.from(STYLIST_TABLES.wardrobeItems).insert({
      id: itemId,
      workspace_id: workspace.id,
      wardrobe_id: wardrobeId,
      image_id: imageId,
      storage_path: storagePath,
      status: "pending",
      description: "",
    });

    const { image: processedImage, analysis, analyzed } = await processUploadedImage({
      image: pendingImage,
    });

    const metadata = {
      ...analysis,
      analyzed,
    };

    const { data: updated, error } = await supabase
      .from(STYLIST_TABLES.wardrobeItems)
      .update({
        category: analysis.category,
        colors: analysis.colors,
        description: analysis.description,
        formality: analysis.formality,
        thumb_path: processedImage.thumb_path,
        storage_path: processedImage.storage_path,
        status: "confirmed",
        metadata,
        updated_at: new Date().toISOString(),
      })
      .eq("id", itemId)
      .select("*")
      .single();

    if (error) throw error;

    const imageUrl = await signStoragePathWithFallback(
      STORAGE_BUCKETS.uploads,
      processedImage.thumb_path ?? processedImage.storage_path,
      processedImage.storage_path
    );

    const item = wardrobeItemToUploadAsset(
      { ...(updated as WardrobeItemWithImage), image: processedImage },
      imageUrl
    );

    return NextResponse.json({ item });
  } catch (e) {
    console.error("[wardrobe/upload]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Upload failed" },
      { status: 500 }
    );
  }
}
