import { NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { z } from "zod";
import {
  createAdminClient,
  isSupabaseConfigured,
  STORAGE_BUCKETS,
  stylistBodyPath,
} from "@/lib/supabase/admin";
import { assertBodyUploadAllowed } from "@/lib/body/service";
import { createPendingUpload } from "@/lib/images/service";
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
    await assertBodyUploadAllowed(workspace.id);

    const body = schema.parse(await request.json());
    const imageId = uuidv4();
    const ext = body.filename.split(".").pop() || "jpg";
    const storagePath = stylistBodyPath(workspace.id, imageId, ext);

    await createPendingUpload({
      workspaceId: workspace.id,
      imageId,
      storagePath,
      mimeType: body.mimeType,
      source: "body",
    });

    const supabase = createAdminClient();
    const { data, error } = await supabase.storage
      .from(STORAGE_BUCKETS.uploads)
      .createSignedUploadUrl(storagePath, { upsert: true });

    if (error) throw error;

    return NextResponse.json({
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
