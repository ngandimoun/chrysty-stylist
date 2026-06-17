import sharp from "sharp";
import type { StyledImageCropZone, StyledImageLayout } from "@/lib/ai/fal-edit-prompt-schema";
import { CHRYSTY_WATERMARK_TEXT } from "@/lib/chrysty/fal-render-rules";
import { generateLog } from "@/lib/chrysty/generate-debug";

const CANVAS_W = 1080;
const CANVAS_H = 1440;
const INSET_SIZE = 128;
const INSET_GAP = 8;
const INSET_MARGIN = 20;
const PANEL_BG = { r: 245, g: 243, b: 240 };

const CROP_ZONES: Record<
  StyledImageCropZone,
  { topRatio: number; heightRatio: number; widthRatio: number }
> = {
  upper_torso: { topRatio: 0.06, heightRatio: 0.22, widthRatio: 0.42 },
  mid_outfit: { topRatio: 0.34, heightRatio: 0.22, widthRatio: 0.42 },
  lower_legs: { topRatio: 0.56, heightRatio: 0.22, widthRatio: 0.42 },
  feet: { topRatio: 0.74, heightRatio: 0.22, widthRatio: 0.42 },
};

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function buildWatermarkSvg(): Buffer {
  const svg = `<svg width="200" height="36" xmlns="http://www.w3.org/2000/svg">
  <rect width="100%" height="100%" rx="18" fill="rgba(0,0,0,0.42)"/>
  <text x="100" y="23" font-family="Arial, sans-serif" font-size="12" font-weight="600" fill="#ffffff" text-anchor="middle" letter-spacing="0.04em">${escapeXml(CHRYSTY_WATERMARK_TEXT)}</text>
</svg>`;
  return Buffer.from(svg);
}

async function extractInsetCrop(
  heroBuffer: Buffer,
  srcW: number,
  srcH: number,
  zone: StyledImageCropZone
): Promise<Buffer> {
  const spec = CROP_ZONES[zone];
  const cropW = Math.min(srcW, Math.max(1, Math.round(srcW * spec.widthRatio)));
  const cropX = Math.max(0, Math.round((srcW - cropW) / 2));
  const top = Math.min(Math.round(srcH * spec.topRatio), srcH - 1);
  const height = Math.min(Math.round(srcH * spec.heightRatio), srcH - top);

  return sharp(heroBuffer)
    .extract({ left: cropX, top, width: cropW, height: Math.max(1, height) })
    .resize(INSET_SIZE, INSET_SIZE, { fit: "cover", position: "centre" })
    .png()
    .toBuffer();
}

export async function buildStyledLookImage(params: {
  heroBuffer: Buffer;
  layout: StyledImageLayout;
}): Promise<Buffer> {
  const { heroBuffer, layout } = params;
  const heroMeta = await sharp(heroBuffer).metadata();
  const srcW = heroMeta.width ?? 1024;
  const srcH = heroMeta.height ?? 1536;

  const heroPanel = await sharp(heroBuffer)
    .resize(CANVAS_W, CANVAS_H, { fit: "contain", background: PANEL_BG })
    .png()
    .toBuffer();

  const overlays: sharp.OverlayOptions[] = [];

  if (layout.mode === "detail_insets" && layout.insets.length > 0) {
    const insetBuffers = await Promise.all(
      layout.insets.map((inset) => extractInsetCrop(heroBuffer, srcW, srcH, inset.cropZone))
    );

    const stackHeight =
      layout.insets.length * INSET_SIZE + (layout.insets.length - 1) * INSET_GAP;
    const stackTop = CANVAS_H - INSET_MARGIN - stackHeight - 48;

    layout.insets.forEach((_inset, index) => {
      overlays.push({
        input: insetBuffers[index]!,
        left: CANVAS_W - INSET_MARGIN - INSET_SIZE,
        top: stackTop + index * (INSET_SIZE + INSET_GAP),
      });
    });
  }

  const watermarkSvg = buildWatermarkSvg();
  const watermarkPng = await sharp(watermarkSvg, { density: 120 })
    .resize(200, 36, { fit: "fill" })
    .png()
    .toBuffer()
    .catch(() =>
      sharp({
        create: {
          width: 200,
          height: 36,
          channels: 4,
          background: { r: 0, g: 0, b: 0, alpha: 110 },
        },
      })
        .png()
        .toBuffer()
    );

  overlays.push({
    input: watermarkPng,
    left: CANVAS_W - 220,
    top: CANVAS_H - 52,
  });

  const composite = await sharp(heroPanel).composite(overlays).png().toBuffer();

  generateLog("styled_image_done", {
    canvasW: CANVAS_W,
    canvasH: CANVAS_H,
    layoutMode: layout.mode,
    insetCount: layout.insets.length,
    insetZones: layout.insets.map((i) => i.cropZone),
  });

  return composite;
}

/** @deprecated use buildStyledLookImage */
export const buildLookbookComposite = buildStyledLookImage;
