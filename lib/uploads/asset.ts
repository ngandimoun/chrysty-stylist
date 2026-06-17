import type { BodyReference } from "@/lib/body/service";
import type { WardrobeItemWithImage } from "@/lib/wardrobe/service";

export type UploadAsset = {
  id: string;
  imageId: string;
  storagePath: string;
  imageUrl: string;
};

export function wardrobeItemToUploadAsset(
  row: WardrobeItemWithImage,
  imageUrl: string
): UploadAsset {
  const imageId = row.image_id ?? row.image?.id ?? row.id;
  return {
    id: row.id,
    imageId,
    storagePath: row.storage_path,
    imageUrl,
  };
}

export function bodyReferenceToUploadAsset(ref: BodyReference): UploadAsset {
  return {
    id: ref.id,
    imageId: ref.id,
    storagePath: ref.storagePath,
    imageUrl: ref.imageUrl,
  };
}

export function shortAssetId(id: string): string {
  return id.slice(0, 8);
}
