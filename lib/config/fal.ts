export type FalImageQuality = "low" | "medium" | "high";
export type FalOutputFormat = "png" | "jpeg" | "webp";

export function getFalConfig() {
  const lookbookCompositeEnabled =
    process.env.LOOKBOOK_COMPOSITE !== "false" &&
    process.env.USE_SHARP_COLLAGE_FALLBACK !== "false";

  return {
    apiKey: process.env.FAL_KEY ?? "",
    imageModel: process.env.FAL_IMAGE_MODEL ?? "openai/gpt-image-2/edit",
    imageQuality: (process.env.FAL_IMAGE_QUALITY ?? "medium") as FalImageQuality,
    imageSize: "auto" as const,
    outputFormat: (process.env.FAL_OUTPUT_FORMAT ?? "png") as FalOutputFormat,
    lookbookCompositeEnabled,
    /** @deprecated use lookbookCompositeEnabled */
    collageFallback: lookbookCompositeEnabled,
  };
}

export function isFalConfigured() {
  const c = getFalConfig();
  return Boolean(c.apiKey && c.imageModel);
}
