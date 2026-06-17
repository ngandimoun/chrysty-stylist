import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient, isSupabaseConfigured, signStoragePath, STORAGE_BUCKETS } from "@/lib/supabase/admin";
import { STYLIST_TABLES } from "@/lib/supabase/tables";
import { processBodyReference } from "@/lib/images/service";
import type { UploadedImage } from "@/types/database";
import { requireWorkspace } from "@/lib/workspace/session";

const schema = z.object({
  imageId: z.string().uuid(),
  referenceType: z.enum(["body", "face", "mannequin"]).optional(),
});

export async function POST(request: Request) {
  try {
    if (!isSupabaseConfigured()) {
      return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
    }

    const workspace = await requireWorkspace();
    const { imageId, referenceType } = schema.parse(await request.json());
    const supabase = createAdminClient();

    const { data: image, error: fetchError } = await supabase
      .from(STYLIST_TABLES.uploadedImages)
      .select("*")
      .eq("id", imageId)
      .eq("workspace_id", workspace.id)
      .eq("source", "body")
      .single();

    if (fetchError || !image) {
      return NextResponse.json({ error: "Image not found" }, { status: 404 });
    }

    const processed = await processBodyReference({
      image: image as UploadedImage,
      referenceType,
    });

    const imageUrl = await signStoragePath(
      STORAGE_BUCKETS.uploads,
      processed.thumb_path ?? processed.storage_path
    );

    const refType =
      referenceType ??
      ((processed.vision as { referenceType?: string } | null)?.referenceType ?? "body");

    return NextResponse.json({
      item: {
        id: processed.id,
        imageUrl,
        referenceType: refType,
      },
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Confirm failed" },
      { status: 400 }
    );
  }
}
