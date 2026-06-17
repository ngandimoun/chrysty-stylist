import sharp from "sharp";

export async function createThumbnail(imageBuffer: Buffer): Promise<Buffer> {
  return sharp(imageBuffer).resize(400, 400, { fit: "inside" }).jpeg({ quality: 85 }).toBuffer();
}
