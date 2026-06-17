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

const RENDER_POLL_MS_PER_LOOK = 180_000;
const RENDER_POLL_MIN_MS = 320_000;
const RENDER_CHAIN_STALE_MS = 45_000;

export function renderPollTimeoutMs(totalCount: number): number {
  const count = Math.max(1, totalCount);
  return Math.max(RENDER_POLL_MIN_MS, count * RENDER_POLL_MS_PER_LOOK);
}

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

function shouldChainRender(
  data: OutfitPollResponse,
  chainState: { lastTriggeredForCount: number; lastTriggerAt: number }
): boolean {
  if (data.totalCount <= 0 || data.renderedCount >= data.totalCount) return false;
  if (data.generationStatus !== "rendering" && data.generationStatus !== "pending") {
    return false;
  }

  const progressMade = data.renderedCount > chainState.lastTriggeredForCount;
  const initialTrigger = chainState.lastTriggeredForCount < 0;
  const retryStale = Date.now() - chainState.lastTriggerAt >= RENDER_CHAIN_STALE_MS;

  return progressMade || initialTrigger || retryStale;
}

export function pollOutfitGeneration(params: {
  generationId: string;
  onUpdate: (data: OutfitPollResponse) => void;
  onComplete: (data: OutfitPollResponse, meta: OutfitPollCompleteMeta) => void;
  intervalMs?: number;
  timeoutMs?: number;
  totalCount?: number;
}): () => void {
  const {
    generationId,
    onUpdate,
    onComplete,
    intervalMs = 2000,
    totalCount: initialTotalCount = 1,
    timeoutMs = renderPollTimeoutMs(initialTotalCount),
  } = params;
  const startedAt = Date.now();
  let stopped = false;
  const chainState = { lastTriggeredForCount: -1, lastTriggerAt: 0 };

  const tick = async () => {
    if (stopped) return;
    const data = await fetchOutfitGeneration(generationId);
    if (!data || stopped) return;

    onUpdate(data);

    if (shouldChainRender(data, chainState)) {
      chainState.lastTriggeredForCount = data.renderedCount;
      chainState.lastTriggerAt = Date.now();
      void triggerOutfitRender(generationId);
    }

    const effectiveTimeout = renderPollTimeoutMs(
      Math.max(data.totalCount, initialTotalCount, 1)
    );
    const { done, timedOut } = isPollComplete(data, startedAt, effectiveTimeout);

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
