import sharp from "sharp";

const BUCKET_SAFE_TYPES = new Set(["image/jpeg", "image/png", "image/gif"]);
const CONVERT_TO_JPEG_TYPES = new Set([
  "image/webp",
  "image/heic",
  "image/heif",
  "image/avif",
  "application/octet-stream",
]);

export async function normalizeImageUpload(
  buffer: Buffer,
  mimeType: string
): Promise<{ buffer: Buffer; mimeType: string; ext: string }> {
  const normalizedType = mimeType === "image/jpg" ? "image/jpeg" : mimeType;

  if (CONVERT_TO_JPEG_TYPES.has(normalizedType) || !BUCKET_SAFE_TYPES.has(normalizedType)) {
    const converted = await sharp(buffer).jpeg({ quality: 92 }).toBuffer();
    return { buffer: converted, mimeType: "image/jpeg", ext: "jpg" };
  }

  if (normalizedType === "image/png") {
    return { buffer, mimeType: "image/png", ext: "png" };
  }

  if (normalizedType === "image/gif") {
    return { buffer, mimeType: "image/gif", ext: "gif" };
  }

  return { buffer, mimeType: "image/jpeg", ext: "jpg" };
}
