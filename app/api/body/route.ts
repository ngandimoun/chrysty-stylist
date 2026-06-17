import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/supabase/admin";
import {
  BODY_UPLOAD_MAX,
  countBodyReferences,
  listBodyReferences,
} from "@/lib/body/service";
import { bodyReferenceToUploadAsset } from "@/lib/uploads/asset";
import { requireWorkspace } from "@/lib/workspace/session";

export async function GET() {
  try {
    if (!isSupabaseConfigured()) {
      return NextResponse.json({ items: [], count: 0, max: BODY_UPLOAD_MAX });
    }

    const workspace = await requireWorkspace();
    const refs = await listBodyReferences(workspace.id);
    const items = refs.map(bodyReferenceToUploadAsset);
    const count = await countBodyReferences(workspace.id);

    return NextResponse.json({ items, count, max: BODY_UPLOAD_MAX });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed" },
      { status: 400 }
    );
  }
}
