"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { PanelLeftOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { OutfitGenerationsFeed } from "@/components/masonry/outfit-generations-feed";
import { CaptureSheet } from "@/components/wardrobe/capture-sheet";
import { OutfitDetailSheet } from "@/components/masonry/outfit-detail-sheet";
import { SettingsSheet } from "@/components/stylist/settings-sheet";
import { EmptyLooks } from "@/components/stylist/empty-looks";
import { FloatingPrompt } from "@/components/stylist/floating-prompt";
import { StylistSidebar } from "@/components/stylist/sidebar";
import type { UploadAsset } from "@/components/stylist/upload-types";
import { UI_COPY } from "@/lib/chrysty/ui-copy";
import { DEFAULT_LOOK_COUNT } from "@/lib/chrysty/look-count-constants";
import { readJsonResponse } from "@/lib/http/read-json-response";
import {
  useUIStore,
  type OutfitGenerationUI,
  type OutfitLookUI,
} from "@/store/ui";
import { GeneratingLooks } from "@/components/stylist/generating-looks";
import {
  isRenderPollFailed,
  pollOutfitGeneration,
  triggerOutfitRender,
  type OutfitPollCompleteMeta,
  type OutfitPollResponse,
} from "@/lib/hooks/use-outfit-render-poll";
import { runGenerationPhaseTimers } from "@/lib/hooks/generation-phase-timers";

type Workspace = {
  id: string;
  name: string;
  mission: string | null;
  displayName: string | null;
  onboardingComplete: boolean;
};

function prependGeneration(
  generations: OutfitGenerationUI[],
  batch: OutfitGenerationUI
): OutfitGenerationUI[] {
  return [batch, ...generations.filter((g) => g.generationId !== batch.generationId)];
}

function updateGeneration(
  generations: OutfitGenerationUI[],
  generationId: string,
  patch: Partial<OutfitGenerationUI>
): OutfitGenerationUI[] {
  return generations.map((g) =>
    g.generationId === generationId ? { ...g, ...patch } : g
  );
}

export function StylistApp({ workspace }: { workspace: Workspace }) {
  const [prompt, setPrompt] = useState("");
  const [lookCount, setLookCount] = useState(DEFAULT_LOOK_COUNT);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activePrompt, setActivePrompt] = useState("");
  const [bodyCount, setBodyCount] = useState(0);
  const [wardrobeCount, setWardrobeCount] = useState(0);
  const [bodyItems, setBodyItems] = useState<UploadAsset[]>([]);
  const [wardrobeItems, setWardrobeItems] = useState<UploadAsset[]>([]);
  const [generations, setGenerations] = useState<OutfitGenerationUI[]>([]);
  const resumePollRef = useRef<(() => void) | null>(null);

  const {
    openBodyCapture,
    openWardrobeCapture,
    openOutfitDetail,
    setGenerationLooks,
    generationLooks,
    isGenerating,
    statusMessage,
    setGenerating,
    setGenerationPhase,
    setRequestedLookCount,
    setActiveGenerationId,
    activeGenerationId,
    captureMode,
  } = useUIStore();

  const loadUploads = useCallback(async () => {
    const [bodyRes, wardrobeRes] = await Promise.all([
      fetch("/api/body"),
      fetch("/api/wardrobe"),
    ]);

    const bodyData = await readJsonResponse<{ count?: number; items?: UploadAsset[] }>(bodyRes);
    const wardrobeData = await readJsonResponse<{ count?: number; items?: UploadAsset[] }>(
      wardrobeRes
    );

    const nextBodyItems = bodyData.items ?? [];
    const nextWardrobeItems = wardrobeData.items ?? [];

    return {
      bodyCount: bodyData.count ?? nextBodyItems.length,
      wardrobeCount: wardrobeData.count ?? nextWardrobeItems.length,
      bodyItems: nextBodyItems,
      wardrobeItems: nextWardrobeItems,
    };
  }, []);

  const applyUploads = useCallback(
    (data: {
      bodyCount: number;
      wardrobeCount: number;
      bodyItems: UploadAsset[];
      wardrobeItems: UploadAsset[];
    }) => {
      setBodyCount(data.bodyCount);
      setWardrobeCount(data.wardrobeCount);
      setBodyItems(data.bodyItems);
      setWardrobeItems(data.wardrobeItems);
    },
    []
  );

  const refreshUploads = useCallback(async () => {
    const data = await loadUploads();
    applyUploads(data);
    return data;
  }, [applyUploads, loadUploads]);

  const deleteUpload = useCallback(
    async (id: string) => {
      const mode = captureMode ?? "wardrobe";
      const endpoint = mode === "body" ? `/api/body/${id}` : `/api/wardrobe/${id}`;
      const res = await fetch(endpoint, { method: "DELETE" });
      const data = await readJsonResponse<{ error?: string }>(res);
      if (!res.ok) throw new Error(data.error ?? "Delete failed");
      await refreshUploads();
    },
    [captureMode, refreshUploads]
  );

  const loadGenerations = useCallback(async () => {
    const res = await fetch("/api/outfits");
    const data = await readJsonResponse<{ generations?: OutfitGenerationUI[] }>(res);
    return (data.generations ?? []) as OutfitGenerationUI[];
  }, []);

  const applyGenerations = useCallback((nextGenerations: OutfitGenerationUI[]) => {
    setGenerations(nextGenerations);
  }, []);

  const finishRenderingPoll = useCallback(
    (generationId: string, pollData: OutfitPollResponse, meta: OutfitPollCompleteMeta) => {
      setGenerations((prev) =>
        updateGeneration(prev, generationId, {
          looks: pollData.looks,
          generationStatus: pollData.generationStatus,
        })
      );
      setGenerationLooks(pollData.looks);
      const renderFailed = isRenderPollFailed(pollData, meta);
      setGenerationPhase(null);
      setGenerating(false, renderFailed ? UI_COPY.generation.renderFailed : null);
      setActiveGenerationId(null);
      setActivePrompt("");
    },
    [setGenerationLooks, setGenerating, setGenerationPhase, setActiveGenerationId]
  );

  const beginRenderingPoll = useCallback(
    (generationId: string, userPrompt?: string) => {
      resumePollRef.current?.();
      if (userPrompt) setActivePrompt(userPrompt);
      setActiveGenerationId(generationId);
      setGenerationPhase("rendering");
      setGenerating(true, UI_COPY.generation.phases.rendering);

      void triggerOutfitRender(generationId);

      resumePollRef.current = pollOutfitGeneration({
        generationId,
        timeoutMs: 320_000,
        onUpdate: (pollData) => {
          setGenerations((prev) =>
            updateGeneration(prev, generationId, {
              looks: pollData.looks,
              generationStatus: pollData.generationStatus,
            })
          );
          setGenerationLooks(pollData.looks);
        },
        onComplete: (pollData, meta) => {
          finishRenderingPoll(generationId, pollData, meta);
          resumePollRef.current = null;
        },
      });
    },
    [finishRenderingPoll, setActiveGenerationId, setGenerationLooks, setGenerating, setGenerationPhase]
  );

  useEffect(() => {
    let active = true;

    setBodyItems([]);
    setWardrobeItems([]);
    setBodyCount(0);
    setWardrobeCount(0);
    setGenerations([]);
    setPrompt("");
    setActivePrompt("");
    setGenerationLooks([]);

    void (async () => {
      const [uploads, nextGenerations] = await Promise.all([loadUploads(), loadGenerations()]);
      if (!active) return;
      applyUploads(uploads);
      applyGenerations(nextGenerations);

      const stuck = nextGenerations.find((g) => g.generationStatus === "rendering");
      if (stuck) {
        beginRenderingPoll(stuck.generationId, stuck.userPrompt);
      }
    })();

    return () => {
      active = false;
      resumePollRef.current?.();
      resumePollRef.current = null;
    };
  }, [
    workspace.id,
    loadUploads,
    loadGenerations,
    applyUploads,
    applyGenerations,
    setGenerationLooks,
    beginRenderingPoll,
  ]);

  async function completeOnboarding() {
    if (workspace.onboardingComplete) return;

    await fetch("/api/workspace", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ onboardingComplete: true }),
    });
  }

  async function generateLooks(message: string) {
    const trimmed = message.trim();
    setActivePrompt(trimmed);
    setRequestedLookCount(lookCount);

    const clearPhaseTimers = runGenerationPhaseTimers({
      setGenerationPhase,
      setGenerating,
    });

    try {
      const res = await fetch("/api/outfits/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: trimmed, lookCount }),
      });

      const data = await readJsonResponse<{
        error?: string;
        looks?: OutfitLookUI[];
        generationId?: string;
        rendering?: boolean;
        generationStatus?: string | null;
      }>(res);

      if (!res.ok) throw new Error(data.error ?? "Generation failed");

      const nextLooks = (data.looks ?? []) as OutfitLookUI[];
      const generationId = data.generationId;

      if (generationId) {
        const newBatch: OutfitGenerationUI = {
          generationId,
          userPrompt: trimmed,
          looks: nextLooks,
          generationStatus: data.rendering ? "rendering" : data.generationStatus ?? "complete",
        };
        setGenerations((prev) => prependGeneration(prev, newBatch));
        setGenerationLooks(nextLooks);
      }

      setPrompt("");
      await completeOnboarding();

      if (data.rendering && generationId) {
        clearPhaseTimers();
        beginRenderingPoll(generationId, trimmed);
        return;
      }
    } catch (e) {
      resumePollRef.current?.();
      resumePollRef.current = null;
      setGenerating(false, e instanceof Error ? e.message : "Something went wrong");
      setGenerationPhase(null);
      setActiveGenerationId(null);
      setActivePrompt("");
      clearPhaseTimers();
      return;
    }

    clearPhaseTimers();
    setGenerationPhase(null);
    setGenerating(false, null);
    setActiveGenerationId(null);
    setActivePrompt("");
  }

  const canGenerate = wardrobeCount >= 1;
  const activeGeneration = activeGenerationId
    ? generations.find((g) => g.generationId === activeGenerationId)
    : null;
  const completedGenerations =
    isGenerating && activeGenerationId
      ? generations.filter((g) => g.generationId !== activeGenerationId)
      : generations;
  const showEmpty = generations.length === 0 && !isGenerating;

  function handleSelectLook(batch: OutfitGenerationUI, look: OutfitLookUI) {
    setGenerationLooks(batch.looks);
    openOutfitDetail(look.id);
  }

  return (
    <div className="gallery-shell flex h-full min-h-0 flex-1 flex-col overflow-hidden lg:flex-row">
      {sidebarOpen && (
        <StylistSidebar
          workspaceId={workspace.id}
          workspaceName={workspace.name}
          workspaceMission={workspace.mission}
          bodyCount={bodyCount}
          wardrobeCount={wardrobeCount}
          bodyItems={bodyItems}
          wardrobeItems={wardrobeItems}
          onBodyUpload={openBodyCapture}
          onWardrobeUpload={openWardrobeCapture}
          onClose={() => setSidebarOpen(false)}
        />
      )}

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <main className="relative min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-4 pt-4 pb-[max(2rem,env(safe-area-inset-bottom))] lg:px-8 lg:pt-6 lg:pb-[max(2.5rem,env(safe-area-inset-bottom))]">
          {!sidebarOpen && (
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="absolute left-4 top-4 z-50 h-9 w-9 rounded-full lg:left-8 lg:top-6"
              aria-label={UI_COPY.sidebar.openLabel}
              onClick={() => setSidebarOpen(true)}
            >
              <PanelLeftOpen className="h-4 w-4" />
            </Button>
          )}
          <FloatingPrompt
            value={prompt}
            lookCount={lookCount}
            disabled={!canGenerate}
            loading={isGenerating}
            onChange={setPrompt}
            onLookCountChange={setLookCount}
            onSubmit={() => void generateLooks(prompt.trim())}
          />

          {statusMessage && (
            <p className="mb-4 text-center text-sm text-muted-foreground">{statusMessage}</p>
          )}

          {isGenerating && (
            <section className="mb-8">
              <p className="mb-3 text-sm font-medium text-foreground">
                {activeGeneration?.userPrompt ?? activePrompt}
              </p>
              <GeneratingLooks
                wardrobeItems={wardrobeItems}
                bodyItems={bodyItems}
                looks={
                  activeGeneration?.looks?.length
                    ? activeGeneration.looks
                    : generationLooks.length
                      ? generationLooks
                      : []
                }
              />
            </section>
          )}

          {completedGenerations.length > 0 && (
            <OutfitGenerationsFeed
              generations={completedGenerations}
              onSelectLook={handleSelectLook}
            />
          )}

          {showEmpty && <EmptyLooks hasWardrobeItems={wardrobeCount >= 1} />}

          <footer className="mt-8 mb-16 border-t border-border/70 bg-background py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            <div className="mx-auto flex max-w-6xl items-center justify-center">
              <a
                href="https://www.chrysty.dev/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-card px-4 py-1.5 shadow-sm transition-colors hover:border-primary/40 hover:bg-accent/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                aria-label="Made in Chrysty — visit chrysty.dev"
              >
                <span className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
                  Made in
                </span>
                <span className="text-sm font-semibold text-primary">Chrysty</span>
              </a>
            </div>
          </footer>
        </main>
      </div>

      <CaptureSheet
        bodyCount={bodyCount}
        wardrobeCount={wardrobeCount}
        bodyItems={bodyItems}
        wardrobeItems={wardrobeItems}
        onUploadConfirmed={() => {
          void refreshUploads();
        }}
        onDelete={deleteUpload}
      />

      <SettingsSheet />
      <OutfitDetailSheet />
    </div>
  );
}
