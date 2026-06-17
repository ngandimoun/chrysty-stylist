import type { OutfitLookUI } from "@/store/ui";

export async function downloadLookImage(look: OutfitLookUI) {
  const endpoint = look.downloadUrl ?? `/api/outfits/${look.id}/download`;
  const res = await fetch(endpoint);
  if (!res.ok) throw new Error("Download failed");

  const blob = await res.blob();
  const ext = blob.type.includes("png") ? "png" : "jpg";
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `chrysty-look.${ext}`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
