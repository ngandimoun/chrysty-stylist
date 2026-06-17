import { shortAssetId } from "@/lib/uploads/asset";
import type { WardrobeItemWithImage } from "@/lib/wardrobe/service";

export type LookWardrobePiece = {
  id: string;
  imageUrl: string;
  description?: string | null;
  category?: string | null;
};

export function pieceLabel(
  piece: Pick<LookWardrobePiece, "id" | "description" | "category">
): string {
  if (piece.description?.trim()) return piece.description.trim();
  if (piece.category?.trim()) return piece.category.trim();
  return shortAssetId(piece.id);
}

export function resolveLookWardrobePieces(
  wardrobeItemIds: string[],
  rows: WardrobeItemWithImage[],
  imageUrlById: Map<string, string>
): LookWardrobePiece[] {
  const rowById = new Map(rows.map((row) => [row.id, row]));
  const pieces: LookWardrobePiece[] = [];

  for (const id of wardrobeItemIds) {
    const row = rowById.get(id);
    const imageUrl = imageUrlById.get(id);
    if (!row || !imageUrl) continue;

    pieces.push({
      id,
      imageUrl,
      description: row.description || null,
      category: row.category,
    });
  }

  return pieces;
}
