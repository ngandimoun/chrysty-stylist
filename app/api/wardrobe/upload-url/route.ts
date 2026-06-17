import { NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { z } from "zod";
import {
  createAdminClient,
  isSupabaseConfigured,
  STORAGE_BUCKETS,
  stylistWardrobePath,
} from "@/lib/supabase/admin";
import { STYLIST_TABLES } from "@/lib/supabase/tables";
import { createPendingUpload } from "@/lib/images/service";
import { assertWardrobeUploadAllowed, getDefaultWardrobeId } from "@/lib/wardrobe/service";
import { requireWorkspace } from "@/lib/workspace/session";

const schema = z.object({
  filename: z.string(),
  mimeType: z.string().default("image/jpeg"),
});

export async function POST(request: Request) {
  try {
    if (!isSupabaseConfigured()) {
      return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
    }

    const workspace = await requireWorkspace();
    await assertWardrobeUploadAllowed(workspace.id);
    const body = schema.parse(await request.json());
    const imageId = uuidv4();
    const itemId = uuidv4();
    const wardrobeId = await getDefaultWardrobeId(workspace.id);
    const ext = body.filename.split(".").pop() || "jpg";
    const storagePath = stylistWardrobePath(workspace.id, imageId, ext);

    const supabase = createAdminClient();

    await createPendingUpload({
      workspaceId: workspace.id,
      imageId,
      storagePath,
      mimeType: body.mimeType,
      source: "wardrobe",
    });

    await supabase.from(STYLIST_TABLES.wardrobeItems).insert({
      id: itemId,
      workspace_id: workspace.id,
      wardrobe_id: wardrobeId,
      image_id: imageId,
      storage_path: storagePath,
      status: "pending",
      description: "",
    });

    const { data, error } = await supabase.storage
      .from(STORAGE_BUCKETS.uploads)
      .createSignedUploadUrl(storagePath, { upsert: true });

    if (error) throw error;

    return NextResponse.json({
      itemId,
      imageId,
      storagePath,
      uploadUrl: data.signedUrl,
      token: data.token,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Upload URL failed" },
      { status: 400 }
    );
  }
}
