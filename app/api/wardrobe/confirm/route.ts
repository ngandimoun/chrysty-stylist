import { NextResponse } from "next/server";
import { z } from "zod";
import {
  createAdminClient,
  isSupabaseConfigured,
  signStoragePath,
  STORAGE_BUCKETS,
} from "@/lib/supabase/admin";
import { STYLIST_TABLES } from "@/lib/supabase/tables";
import { processUploadedImage } from "@/lib/images/service";
import type { UploadedImage, WardrobeItem } from "@/types/database";
import { requireWorkspace } from "@/lib/workspace/session";

const schema = z.object({
  itemId: z.string().uuid(),
  userLabel: z.string().optional(),
});

export async function POST(request: Request) {
  try {
    if (!isSupabaseConfigured()) {
      return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
    }

    const workspace = await requireWorkspace();
    const { itemId, userLabel } = schema.parse(await request.json());
    const supabase = createAdminClient();

    const { data: item, error: fetchError } = await supabase
      .from(STYLIST_TABLES.wardrobeItems)
      .select("*")
      .eq("id", itemId)
      .eq("workspace_id", workspace.id)
      .single();

    if (fetchError || !item) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    const wardrobeItem = item as WardrobeItem;
    let image: UploadedImage | null = null;

    if (wardrobeItem.image_id) {
      const { data: img } = await supabase
        .from(STYLIST_TABLES.uploadedImages)
        .select("*")
        .eq("id", wardrobeItem.image_id)
        .single();
      image = img as UploadedImage | null;
    }

    if (!image) {
      return NextResponse.json({ error: "Image not linked" }, { status: 400 });
    }

    const { image: processedImage, analysis, analyzed } = await processUploadedImage({
      image,
      userLabel,
    });

    const metadata = {
      ...analysis,
      analyzed,
    };

    const { data: updated, error } = await supabase
      .from(STYLIST_TABLES.wardrobeItems)
      .update({
        category: metadata.category,
        colors: metadata.colors,
        description: metadata.description,
        formality: metadata.formality,
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

    const imageUrl = await signStoragePath(
      STORAGE_BUCKETS.uploads,
      processedImage.thumb_path ?? processedImage.storage_path
    );

    return NextResponse.json({ item: { ...updated, imageUrl } });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Confirm failed" },
      { status: 400 }
    );
  }
}
