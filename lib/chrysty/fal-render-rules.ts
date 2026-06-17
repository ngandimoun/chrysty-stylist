/** Shared instructions appended to every Fal image-edit prompt. */

export const CHRYSTY_WATERMARK_TEXT = "Made on Chrysty";

export const FAL_FULL_BODY_RULES = [
  "Full-body head-to-toe framing — camera pulled back far enough to show the entire outfit.",
  "Entire outfit must be visible including shoes, trouser hem, and full silhouette.",
  "Not a portrait crop, not waist-up, not a close-up.",
  "Neutral boutique or studio background suitable for an editorial lookbook hero shot.",
].join(" ");

export const FAL_WATERMARK_HINT = `Leave a clean area in the bottom-right corner suitable for a subtle "${CHRYSTY_WATERMARK_TEXT}" watermark badge.`;

export function buildFalRenderPromptSuffix(): string {
  return FAL_FULL_BODY_RULES;
}
