"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, MoreHorizontal, Send } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  MessageBubble,
  SuggestionChips,
  ThinkingIndicator,
  WardrobeStrip,
  type ChatMessageUI,
} from "@/components/chat/message-bubble";
import type { UploadAsset } from "@/components/stylist/upload-types";
import { CaptureSheet } from "@/components/wardrobe/capture-sheet";
import { MasonrySheet } from "@/components/masonry/masonry-sheet";
import { OutfitDetailSheet } from "@/components/masonry/outfit-detail-sheet";
import { CHRYSTY_PERSONA } from "@/lib/chrysty/persona";
import { ThemeToggleMenu } from "@/components/theme/theme-toggle";
import { UI_COPY } from "@/lib/chrysty/ui-copy";
import { getDefaultChips, getTimeGreeting } from "@/lib/chrysty/chat-intents";
import { DEFAULT_LOOK_COUNT } from "@/lib/chrysty/look-count-constants";
import {
  ONBOARDING_COPY,
  ONBOARDING_MIN_PHOTOS,
  type OnboardingPhase,
} from "@/lib/chrysty/onboarding";
import { useUIStore, type OutfitLookUI } from "@/store/ui";
import { pollOutfitGeneration, renderPollTimeoutMs } from "@/lib/hooks/use-outfit-render-poll";
import { runGenerationPhaseTimers } from "@/lib/hooks/generation-phase-timers";

type Workspace = {
  name: string;
  displayName: string | null;
  onboardingComplete: boolean;
};

export function ChatApp({ workspace }: { workspace: Workspace }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [messages, setMessages] = useState<ChatMessageUI[]>([]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState<string | null>(null);
  const [wardrobe, setWardrobe] = useState<UploadAsset[]>([]);
  const [phase, setPhase] = useState<OnboardingPhase>(
    workspace.onboardingComplete ? "complete" : "intro"
  );
  const {
    openWardrobeCapture,
    openMasonry,
    setGenerationLooks,
    setGenerationPhase,
    setRequestedLookCount,
    setGenerating,
    setActiveGenerationId,
  } = useUIStore();

  const loadWardrobe = useCallback(async () => {
    const res = await fetch("/api/wardrobe");
    const data = await res.json();
    setWardrobe(data.items ?? []);
    return data.items ?? [];
  }, []);

  const deleteWardrobeItem = useCallback(
    async (id: string) => {
      const res = await fetch(`/api/wardrobe/${id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Delete failed");
      await loadWardrobe();
    },
    [loadWardrobe]
  );

  useEffect(() => {
    void loadWardrobe();
    fetch("/api/messages")
      .then((r) => r.json())
      .then((d) => {
        if (d.messages?.length) {
          setMessages(
            d.messages.map(
              (m: {
                id: string;
                role: string;
                content: string;
                metadata: Record<string, unknown>;
              }) => ({
                id: m.id,
                role: m.role as "user" | "assistant",
                content: m.content,
                metadata: m.metadata as ChatMessageUI["metadata"],
              })
            )
          );
          setPhase("complete");
        } else if (!workspace.onboardingComplete) {
          setMessages([
            { id: "intro", role: "assistant", content: ONBOARDING_COPY.intro.message },
          ]);
        }
      });
  }, [loadWardrobe, workspace.onboardingComplete]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, thinking]);

  function pushAssistant(content: string, metadata?: ChatMessageUI["metadata"]) {
    setMessages((m) => [
      ...m,
      { id: crypto.randomUUID(), role: "assistant", content, metadata },
    ]);
  }

  function pushUser(content: string) {
    setMessages((m) => [...m, { id: crypto.randomUUID(), role: "user", content }]);
  }

  async function generateOutfits(userMessage: string) {
    setThinking(CHRYSTY_PERSONA.thinkingPhrases[2]!);
    setRequestedLookCount(DEFAULT_LOOK_COUNT);

    const clearPhaseTimers = runGenerationPhaseTimers({
      setGenerationPhase,
      setGenerating,
    });

    let stopPoll: (() => void) | null = null;

    try {
      const res = await fetch("/api/outfits/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMessage.trim(), lookCount: DEFAULT_LOOK_COUNT }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      const looks: OutfitLookUI[] = data.looks;
      setGenerationLooks(looks);
      pushAssistant(data.message, { type: "outfit_generation", looks, generationId: data.generationId });

      if (phase === "context" || phase === "generating") {
        setPhase("feedback");
        pushAssistant(ONBOARDING_COPY.feedback.message);
      }

      if (data.rendering && data.generationId) {
        clearPhaseTimers();
        setGenerationPhase("rendering");
        setGenerating(true, UI_COPY.generation.phases.rendering);
        setActiveGenerationId(data.generationId);

        stopPoll = pollOutfitGeneration({
          generationId: data.generationId,
          totalCount: looks.length,
          timeoutMs: renderPollTimeoutMs(looks.length),
          onUpdate: (pollData) => {
            setGenerationLooks(pollData.looks);
            setMessages((prev) =>
              prev.map((m) =>
                m.metadata?.type === "outfit_generation" &&
                m.metadata?.generationId === data.generationId
                  ? { ...m, metadata: { ...m.metadata, looks: pollData.looks } }
                  : m
              )
            );
          },
          onComplete: (pollData, _meta) => {
            setGenerationLooks(pollData.looks);
            setMessages((prev) =>
              prev.map((m) =>
                m.metadata?.type === "outfit_generation" &&
                m.metadata?.generationId === data.generationId
                  ? { ...m, metadata: { ...m.metadata, looks: pollData.looks } }
                  : m
              )
            );
            setGenerationPhase(null);
            setGenerating(false, null);
            setActiveGenerationId(null);
          },
        });
        return;
      }
    } catch (e) {
      stopPoll?.();
      clearPhaseTimers();
      pushAssistant(
        e instanceof Error ? e.message : "I couldn't put a look together yet."
      );
    } finally {
      setThinking(null);
      if (!stopPoll) {
        clearPhaseTimers();
        setGenerationPhase(null);
        setGenerating(false, null);
      }
    }
  }

  async function handleSend(text?: string) {
    const content = (text ?? input).trim();
    if (!content) return;
    setInput("");
    pushUser(content);

    if (phase === "intro") {
      if (/how does/i.test(content)) {
        pushAssistant(ONBOARDING_COPY.intro.helpReply);
        return;
      }
      setPhase("name");
      pushAssistant(ONBOARDING_COPY.name.message);
      return;
    }

    if (phase === "name") {
      await fetch("/api/workspace", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName: content }),
      });
      setPhase("workspace_name");
      pushAssistant(ONBOARDING_COPY.workspaceName.message);
      return;
    }

    if (phase === "workspace_name") {
      await fetch("/api/workspace", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceName: content || ONBOARDING_COPY.workspaceName.defaultName,
        }),
      });
      setPhase("wardrobe");
      pushAssistant(ONBOARDING_COPY.wardrobe.message);
      openWardrobeCapture();
      return;
    }

    if (phase === "wardrobe") {
      pushAssistant("Tap the camera to add your pieces — I'll wait.");
      openWardrobeCapture();
      return;
    }

    if (phase === "context") {
      setPhase("generating");
      await generateOutfits(content);
      return;
    }

    if (/add more|add clothes|closet/i.test(content)) {
      openWardrobeCapture();
      return;
    }

    const wantsOutfit =
      /wear today|outfit|dress for|what should i wear|help me for|tonight|tomorrow|interview|wedding|date/i.test(
        content
      );

    if (wantsOutfit) {
      const items = await loadWardrobe();
      if (items.length < ONBOARDING_MIN_PHOTOS) {
        pushAssistant("I don't have enough yet — show me a few more pieces?");
        openWardrobeCapture();
        return;
      }
      await generateOutfits(content);
      return;
    }

    setThinking(CHRYSTY_PERSONA.thinkingPhrases[0]!);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: content }),
      });

      if (res.status === 202) {
        await generateOutfits(content);
        return;
      }

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let full = "";
      const id = crypto.randomUUID();
      setMessages((m) => [...m, { id, role: "assistant", content: "" }]);

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value);
          for (const line of chunk.split("\n")) {
            if (line.startsWith("data: ") && line !== "data: [DONE]") {
              try {
                const parsed = JSON.parse(line.slice(6));
                full += parsed.text ?? "";
                setMessages((m) =>
                  m.map((msg) => (msg.id === id ? { ...msg, content: full } : msg))
                );
              } catch {
                /* ignore parse errors */
              }
            }
          }
        }
      }
    } finally {
      setThinking(null);
    }
  }

  async function onWardrobeConfirmed() {
    const items = await loadWardrobe();
    if (phase === "wardrobe" && items.length >= ONBOARDING_MIN_PHOTOS) {
      setPhase("context");
      pushAssistant(ONBOARDING_COPY.context.message);
    }
  }

  async function onFeedback(lookId: string, feedback: string) {
    const res = await fetch("/api/outfits/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lookId, feedback }),
    });
    const data = await res.json();
    if (data.message) pushAssistant(data.message);
    if (phase === "feedback") {
      setPhase("complete");
      await fetch("/api/messages", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ onboardingComplete: true }),
      });
    }
  }

  const chips =
    phase === "intro"
      ? [...ONBOARDING_COPY.intro.chips]
      : phase === "context"
        ? [...ONBOARDING_COPY.context.chips]
        : phase === "complete"
          ? getDefaultChips(wardrobe.length > 0)
          : [];

  return (
    <div className="mx-auto flex h-[100dvh] w-full max-w-[560px] flex-col">
      <header className="flex shrink-0 items-center justify-between border-b border-border/80 bg-background/95 px-4 py-3 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="stylist-mark">C</div>
          <div>
            <h1 className="stylist-heading text-base font-semibold">{workspace.name}</h1>
            <p className="text-xs text-muted-foreground">{UI_COPY.header.subline}</p>
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon">
              <MoreHorizontal className="h-5 w-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={openWardrobeCapture}>{UI_COPY.menu.addClothes}</DropdownMenuItem>
            <ThemeToggleMenu />
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      <ScrollArea className="min-h-0 flex-1 px-4">
        <div className="space-y-4 py-4">
          {phase === "complete" && messages.length <= 1 && (
            <p className="text-center text-sm text-muted-foreground">
              {getTimeGreeting()}. {UI_COPY.greeting.empty}
            </p>
          )}
          {messages.map((msg) => (
            <MessageBubble
              key={msg.id}
              message={msg}
              onOpenMasonry={(looks) => {
                setGenerationLooks(looks);
                openMasonry(looks);
              }}
              onFeedback={onFeedback}
            />
          ))}
          {thinking && <ThinkingIndicator phrase={thinking} />}
          <div ref={scrollRef} />
        </div>
      </ScrollArea>

      <WardrobeStrip items={wardrobe} />

      {phase === "wardrobe" && wardrobe.length < ONBOARDING_MIN_PHOTOS && (
        <p className="px-4 text-center text-xs text-muted-foreground">
          {ONBOARDING_COPY.wardrobe.progressLabel(wardrobe.length)}
        </p>
      )}

      <div className="shrink-0 border-t border-border bg-background p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        {chips.length > 0 && (
          <SuggestionChips chips={chips.slice(0, 3)} onSelect={(c) => void handleSend(c)} />
        )}
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={openWardrobeCapture} aria-label="Add photo">
            <Camera className="h-5 w-5" />
          </Button>
          <Input
            placeholder={UI_COPY.input.placeholder}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void handleSend();
              }
            }}
          />
          <Button size="icon" onClick={() => void handleSend()} aria-label="Send">
            <Send className="h-5 w-5" />
          </Button>
        </div>
      </div>

      <CaptureSheet
        bodyCount={0}
        wardrobeCount={wardrobe.length}
        bodyItems={[]}
        wardrobeItems={wardrobe}
        onUploadConfirmed={() => void onWardrobeConfirmed()}
        onDelete={deleteWardrobeItem}
      />
      <MasonrySheet />
      <OutfitDetailSheet />
    </div>
  );
}
