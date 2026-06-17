import { createAdminClient } from "@/lib/supabase/admin";
import { STYLIST_TABLES } from "@/lib/supabase/tables";
import { WARDROBE_UPLOAD_MAX } from "@/lib/uploads/limits";
import { mergeWorkspaceSettings } from "@/lib/workspace/settings";
import type { WardrobeItem, UploadedImage } from "@/types/database";

export async function ensureDefaultWardrobe(workspaceId: string) {
  const supabase = createAdminClient();

  const { data: existing } = await supabase
    .from(STYLIST_TABLES.wardrobes)
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("is_default", true)
    .maybeSingle();

  if (existing) return existing;

  const { data, error } = await supabase
    .from(STYLIST_TABLES.wardrobes)
    .insert({
      workspace_id: workspaceId,
      name: "Everyday",
      slug: "everyday",
      is_default: true,
    })
    .select("*")
    .single();

  if (error) throw error;

  const { data: workspace } = await supabase
    .from(STYLIST_TABLES.workspaces)
    .select("settings")
    .eq("id", workspaceId)
    .single();

  await supabase
    .from(STYLIST_TABLES.workspaces)
    .update({
      settings: mergeWorkspaceSettings(workspace?.settings, {
        default_wardrobe_id: data.id,
      }),
      updated_at: new Date().toISOString(),
    })
    .eq("id", workspaceId);

  return data;
}

export async function getDefaultWardrobeId(workspaceId: string) {
  const wardrobe = await ensureDefaultWardrobe(workspaceId);
  return wardrobe.id;
}

export async function countConfirmedWardrobeItems(workspaceId: string): Promise<number> {
  const supabase = createAdminClient();
  const { count, error } = await supabase
    .from(STYLIST_TABLES.wardrobeItems)
    .select("*", { count: "exact", head: true })
    .eq("workspace_id", workspaceId)
    .eq("status", "confirmed");

  if (error) throw error;
  return count ?? 0;
}

export async function assertWardrobeUploadAllowed(workspaceId: string) {
  const count = await countConfirmedWardrobeItems(workspaceId);
  if (count >= WARDROBE_UPLOAD_MAX) {
    throw new Error(`Wardrobe item limit reached (${WARDROBE_UPLOAD_MAX})`);
  }
}

export { WARDROBE_UPLOAD_MAX };

export type WardrobeItemWithImage = WardrobeItem & {
  image: UploadedImage | null;
};

export async function listConfirmedWardrobeItems(
  workspaceId: string,
  wardrobeId?: string
): Promise<WardrobeItemWithImage[]> {
  const supabase = createAdminClient();
  const targetWardrobeId = wardrobeId ?? (await getDefaultWardrobeId(workspaceId));

  const { data: items, error } = await supabase
    .from(STYLIST_TABLES.wardrobeItems)
    .select("*")
    .eq("workspace_id", workspaceId)
    .or(`wardrobe_id.eq.${targetWardrobeId},wardrobe_id.is.null`)
    .eq("status", "confirmed")
    .order("created_at", { ascending: true });

  if (error) throw error;
  if (!items?.length) return [];

  const imageIds = items
    .map((item) => item.image_id)
    .filter((id): id is string => Boolean(id));

  const imagesById = new Map<string, UploadedImage>();
  if (imageIds.length) {
    const { data: images } = await supabase
      .from(STYLIST_TABLES.uploadedImages)
      .select("*")
      .in("id", imageIds);
    for (const image of images ?? []) {
      imagesById.set(image.id, image as UploadedImage);
    }
  }

  return items.map((item) => ({
    ...(item as WardrobeItem),
    image: item.image_id ? imagesById.get(item.image_id) ?? null : null,
  }));
}

export function getItemImagePath(item: WardrobeItemWithImage): string {
  if (item.image?.thumb_path) return item.image.thumb_path;
  if (item.image?.storage_path) return item.image.storage_path;
  if (item.thumb_path) return item.thumb_path;
  return item.storage_path;
}

export async function deleteWardrobeItem(workspaceId: string, itemId: string) {
  const supabase = createAdminClient();
  const { data: item, error } = await supabase
    .from(STYLIST_TABLES.wardrobeItems)
    .select("id, image_id")
    .eq("id", itemId)
    .eq("workspace_id", workspaceId)
    .eq("status", "confirmed")
    .maybeSingle();

  if (error) throw error;
  if (!item) throw new Error("Wardrobe item not found");

  const { error: deleteError } = await supabase
    .from(STYLIST_TABLES.wardrobeItems)
    .delete()
    .eq("id", itemId);

  if (deleteError) throw deleteError;

  if (item.image_id) {
    const { error: imageError } = await supabase
      .from(STYLIST_TABLES.uploadedImages)
      .update({
        status: "deleted",
        deleted_at: new Date().toISOString(),
      })
      .eq("id", item.image_id)
      .eq("workspace_id", workspaceId);

    if (imageError) throw imageError;
  }
}
