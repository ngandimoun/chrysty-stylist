import { fal } from "@fal-ai/client";
import { getFalConfig } from "@/lib/config/fal";
import { createAdminClient, STORAGE_BUCKETS } from "@/lib/supabase/admin";
import { generateLog } from "@/lib/chrysty/generate-debug";

let configured = false;

function ensureFalConfigured() {
  const cfg = getFalConfig();
  if (!cfg.apiKey) throw new Error("FAL_KEY is not configured");
  if (!configured) {
    fal.config({ credentials: cfg.apiKey });
    configured = true;
  }
  return cfg;
}

async function downloadStorageBuffer(storagePath: string): Promise<Buffer> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.storage
    .from(STORAGE_BUCKETS.uploads)
    .download(storagePath);
  if (error || !data) throw error ?? new Error(`Failed to download ${storagePath}`);
  return Buffer.from(await data.arrayBuffer());
}

function mimeFromPath(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase();
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  return "image/jpeg";
}

export async function uploadStoragePathToFal(storagePath: string): Promise<string> {
  ensureFalConfigured();
  const buffer = await downloadStorageBuffer(storagePath);
  const mime = mimeFromPath(storagePath);
  const name = storagePath.split("/").pop() ?? "image.jpg";
  const file = new File([new Uint8Array(buffer)], name, { type: mime });
  const url = await fal.storage.upload(file);
  generateLog("fal_storage_upload", { storagePath, falUrl: url.slice(0, 80) });
  return url;
}

export async function uploadStoragePathsToFal(storagePaths: string[]): Promise<string[]> {
  const urls: string[] = [];
  for (const path of storagePaths) {
    urls.push(await uploadStoragePathToFal(path));
  }
  return urls;
}

export type FalRenderResult = {
  url: string;
  width?: number;
  height?: number;
  requestId: string;
};

export async function renderLookWithFal(params: {
  prompt: string;
  imageUrls: string[];
}): Promise<FalRenderResult> {
  const cfg = ensureFalConfigured();
  if (!params.imageUrls.length) {
    throw new Error("At least one reference image is required");
  }

  generateLog("fal_render_start", {
    model: cfg.imageModel,
    imageCount: params.imageUrls.length,
    promptLength: params.prompt.length,
  });

  const result = await fal.subscribe(cfg.imageModel, {
    input: {
      prompt: params.prompt,
      image_urls: params.imageUrls,
      image_size: cfg.imageSize,
      quality: cfg.imageQuality,
      num_images: 1,
      output_format: cfg.outputFormat,
    },
    logs: true,
    onQueueUpdate: (update) => {
      if (update.status === "IN_PROGRESS") {
        update.logs?.map((l) => l.message).forEach((msg) => {
          generateLog("fal_progress", { msg });
        });
      }
    },
  });

  const image = result.data?.images?.[0];
  if (!image?.url) throw new Error("Fal returned no image");

  generateLog("fal_render_done", {
    requestId: result.requestId,
    width: image.width,
    height: image.height,
  });

  return {
    url: image.url,
    width: image.width,
    height: image.height,
    requestId: result.requestId,
  };
}

export async function fetchFalImageBuffer(url: string): Promise<Buffer> {
  const res = await fetch(url, { signal: AbortSignal.timeout(60_000) });
  if (!res.ok) throw new Error(`Failed to fetch rendered image (${res.status})`);
  return Buffer.from(await res.arrayBuffer());
}
