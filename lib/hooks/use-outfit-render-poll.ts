import type { OutfitLookUI } from "@/store/ui";

export type OutfitPollResponse = {
  looks: OutfitLookUI[];
  generationId: string;
  generationStatus: string | null;
  renderedCount: number;
  totalCount: number;
};

export type OutfitPollCompleteMeta = {
  timedOut: boolean;
};

export async function triggerOutfitRender(generationId: string) {
  try {
    await fetch(`/api/outfits/render/${encodeURIComponent(generationId)}`, {
      method: "POST",
    });
  } catch {
    // Polling will surface failures if the render request errors.
  }
}

export async function fetchOutfitGeneration(
  generationId: string
): Promise<OutfitPollResponse | null> {
  const res = await fetch(`/api/outfits?generationId=${encodeURIComponent(generationId)}`);
  if (!res.ok) return null;
  const data = await res.json();
  return {
    looks: (data.looks ?? []) as OutfitLookUI[],
    generationId: data.generationId ?? generationId,
    generationStatus: data.generationStatus ?? null,
    renderedCount: data.renderedCount ?? 0,
    totalCount: data.totalCount ?? 0,
  };
}

export function isRenderPollFailed(
  data: OutfitPollResponse,
  meta: OutfitPollCompleteMeta
): boolean {
  if (data.renderedCount > 0) return false;
  return (
    meta.timedOut ||
    data.generationStatus === "failed" ||
    (data.generationStatus === "rendering" && meta.timedOut)
  );
}

function isPollComplete(
  data: OutfitPollResponse,
  startedAt: number,
  timeoutMs: number
): { done: boolean; timedOut: boolean } {
  const timedOut = Date.now() - startedAt > timeoutMs;
  if (timedOut) return { done: true, timedOut: true };
  if (data.totalCount > 0 && data.renderedCount >= data.totalCount) {
    return { done: true, timedOut: false };
  }
  if (data.generationStatus === "failed") return { done: true, timedOut: false };
  if (data.generationStatus === "complete" && data.totalCount > 0 && data.renderedCount > 0) {
    return { done: true, timedOut: false };
  }
  return { done: false, timedOut: false };
}

export function pollOutfitGeneration(params: {
  generationId: string;
  onUpdate: (data: OutfitPollResponse) => void;
  onComplete: (data: OutfitPollResponse, meta: OutfitPollCompleteMeta) => void;
  intervalMs?: number;
  timeoutMs?: number;
}): () => void {
  const { generationId, onUpdate, onComplete, intervalMs = 2000, timeoutMs = 320_000 } = params;
  const startedAt = Date.now();
  let stopped = false;

  const tick = async () => {
    if (stopped) return;
    const data = await fetchOutfitGeneration(generationId);
    if (!data || stopped) return;

    onUpdate(data);

    const { done, timedOut } = isPollComplete(data, startedAt, timeoutMs);

    if (done) {
      stopped = true;
      onComplete(data, { timedOut });
    }
  };

  void tick();
  const id = window.setInterval(() => void tick(), intervalMs);

  return () => {
    stopped = true;
    window.clearInterval(id);
  };
}
