import { NextResponse } from "next/server";

import {
  isSupabaseConfigured,
  signStoragePathWithFallback,
  STORAGE_BUCKETS,
} from "@/lib/supabase/admin";

import { requireWorkspace } from "@/lib/workspace/session";

import {
  getItemImagePath,
  listConfirmedWardrobeItems,
  WARDROBE_UPLOAD_MAX,
  countConfirmedWardrobeItems,
} from "@/lib/wardrobe/service";
import { wardrobeItemToUploadAsset } from "@/lib/uploads/asset";



export async function GET() {

  try {

    if (!isSupabaseConfigured()) {

      return NextResponse.json({ items: [], count: 0, max: WARDROBE_UPLOAD_MAX });

    }



    const workspace = await requireWorkspace();

    const rows = await listConfirmedWardrobeItems(workspace.id);

    const count = await countConfirmedWardrobeItems(workspace.id);



    const items = await Promise.all(
      rows.map(async (row) => {
        const primaryPath = getItemImagePath(row);
        const fallbackPath = row.image?.storage_path ?? row.storage_path;
        const imageUrl = await signStoragePathWithFallback(
          STORAGE_BUCKETS.uploads,
          primaryPath,
          fallbackPath
        );
        return wardrobeItemToUploadAsset(row, imageUrl);
      })
    );



    return NextResponse.json({ items, count, max: WARDROBE_UPLOAD_MAX });

  } catch (e) {

    return NextResponse.json(

      { error: e instanceof Error ? e.message : "Failed" },

      { status: 400 }

    );

  }

}

