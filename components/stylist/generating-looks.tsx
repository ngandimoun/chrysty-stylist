"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import { UI_COPY } from "@/lib/chrysty/ui-copy";
import type { UploadAsset } from "@/components/stylist/upload-types";
import { useUIStore, type GenerationPhase, type OutfitLookUI } from "@/store/ui";
import { cn } from "@/lib/utils";
import { clampLookCount } from "@/lib/chrysty/look-count-constants";

type Props = {
  className?: string;
  wardrobeItems?: UploadAsset[];
  bodyItems?: UploadAsset[];
  looks?: OutfitLookUI[];
};

const PHASE_STEP: Record<NonNullable<GenerationPhase>, number> = {
  analyzing: 0,
  selecting: 1,
  finishing: 2,
  rendering: 3,
};

function GeneratingPieceShuffle({ items }: { items: UploadAsset[] }) {
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    if (items.length <= 1) return;
    const id = window.setInterval(() => {
      setActiveIndex((index) => (index + 1) % items.length);
    }, 1200);
    return () => window.clearInterval(id);
  }, [items.length]);

  if (!items.length) return null;

  return (
    <div className="flex justify-center gap-2 overflow-x-auto px-2 py-1">
      {items.map((item, index) => (
        <motion.div
          key={item.id}
          animate={{
            scale:
              items.length === 1
                ? [1, 1.06, 1]
                : index === activeIndex
                  ? 1.08
                  : 0.92,
            opacity: items.length === 1 ? 1 : index === activeIndex ? 1 : 0.45,
          }}
          transition={{
            duration: items.length === 1 ? 1.4 : 0.35,
            ease: "easeOut",
            repeat: items.length === 1 ? Infinity : 0,
          }}
          className={cn(
            "relative h-12 w-12 shrink-0 overflow-hidden rounded-2xl shadow-sm ring-1",
            index === activeIndex ? "ring-2 ring-primary" : "ring-border"
          )}
        >
          <Image src={item.imageUrl} alt="" fill className="object-cover" unoptimized />
        </motion.div>
      ))}
    </div>
  );
}

function GeneratingMark({ showOrbit }: { showOrbit: boolean }) {
  return (
    <div className="relative flex h-16 w-16 items-center justify-center">
      <motion.div
        className="absolute inset-0 rounded-2xl bg-gradient-to-tr from-primary/25 via-primary/5 to-transparent"
        animate={{ rotate: 360 }}
        transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
      />
      {showOrbit && (
        <motion.div
          className="absolute inset-0"
          animate={{ rotate: 360 }}
          transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
        >
          {[0, 120, 240].map((deg) => (
            <span
              key={deg}
              className="absolute h-1.5 w-1.5 rounded-full bg-primary/70"
              style={{
                top: "50%",
                left: "50%",
                transform: `rotate(${deg}deg) translateY(-30px)`,
              }}
            />
          ))}
        </motion.div>
      )}
      <motion.div
        className="stylist-mark relative z-10 h-12 w-12 text-2xl"
        animate={{ scale: [1, 1.06, 1] }}
        transition={{ duration: 1.4, repeat: Infinity }}
      >
        C
      </motion.div>
    </div>
  );
}

function PhaseStepper({ activeStep }: { activeStep: number }) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
      {UI_COPY.generation.steps.map((step, index) => {
        const isActive = index === activeStep;
        const isComplete = index < activeStep;

        return (
          <div key={step} className="flex items-center gap-2">
            <motion.span
              className={cn(
                "h-2 w-2 rounded-full",
                isComplete && "bg-primary",
                isActive && "bg-primary",
                !isComplete && !isActive && "bg-muted"
              )}
              animate={isActive ? { scale: [1, 1.25, 1], opacity: [0.7, 1, 0.7] } : {}}
              transition={{ duration: 1.2, repeat: isActive ? Infinity : 0 }}
            />
            <span
              className={cn(
                "text-xs",
                isActive ? "font-medium text-foreground" : "text-muted-foreground"
              )}
            >
              {step}
            </span>
          </div>
        );
      })}
    </div>
  );
}

type CardState = "pending" | "active" | "ready";

function getCardState(look: OutfitLookUI | undefined, index: number, looks: OutfitLookUI[]): CardState {
  if (look?.imageUrl || look?.renderStatus === "ready") return "ready";
  const firstPending = looks.findIndex((l) => !l.imageUrl && l.renderStatus !== "ready");
  if (firstPending === index) return "active";
  return "pending";
}

function LookRenderCard({
  state,
  look,
  bodyItems,
  wardrobeItems,
  index,
}: {
  state: CardState;
  look?: OutfitLookUI;
  bodyItems: UploadAsset[];
  wardrobeItems: UploadAsset[];
  index: number;
}) {
  const ghostItems = bodyItems.length > 0 ? bodyItems : wardrobeItems.slice(0, 2);

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06 }}
      className="relative min-h-[200px] w-full overflow-hidden rounded-3xl ring-1 ring-border/60"
    >
      <AnimatePresence mode="wait">
        {state === "ready" && look?.imageUrl ? (
          <motion.div
            key="image"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.45, ease: "easeOut" }}
            className="relative h-full min-h-[200px] w-full"
          >
            <Image
              src={look.imageUrl}
              alt=""
              fill
              className="object-cover"
              unoptimized
            />
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/50 to-transparent p-3">
              <p className="text-sm font-medium text-white line-clamp-2">
                {look.styleDirection || look.vibe || look.rationale}
              </p>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="skeleton"
            className={cn(
              "relative flex min-h-[200px] w-full flex-col items-center justify-center gap-3 overflow-hidden bg-muted/40 p-4",
              state === "active" && "bg-muted/60"
            )}
            animate={
              state === "active"
                ? { opacity: [0.65, 0.95, 0.65], scale: [1, 1.015, 1] }
                : { opacity: [0.4, 0.55, 0.4] }
            }
            transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
          >
            <div className="animate-shimmer absolute inset-0 opacity-40" />
            {state === "active" && (
              <div className="relative z-10 flex flex-col items-center gap-2">
                {ghostItems.length > 0 && (
                  <div className="flex gap-2">
                    {ghostItems.slice(0, 3).map((item) => (
                      <motion.div
                        key={item.id}
                        className="relative h-14 w-14 overflow-hidden rounded-2xl ring-2 ring-primary/40"
                        style={{ filter: "blur(6px)" }}
                        animate={{ scale: [1, 1.08, 1], opacity: [0.55, 0.95, 0.55] }}
                        transition={{ duration: 2, repeat: Infinity }}
                      >
                        <Image src={item.imageUrl} alt="" fill className="object-cover" unoptimized />
                      </motion.div>
                    ))}
                  </div>
                )}
                <motion.p
                  className="text-xs font-medium text-primary"
                  animate={{ opacity: [0.6, 1, 0.6] }}
                  transition={{ duration: 1.6, repeat: Infinity }}
                >
                  Styling on your look…
                </motion.p>
              </div>
            )}
            {state === "pending" && (
              <div className="relative z-10 h-24 w-full max-w-[140px] rounded-2xl bg-muted/80" />
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export function GeneratingLooks({
  className,
  wardrobeItems = [],
  bodyItems = [],
  looks = [],
}: Props) {
  const { generationPhase, requestedLookCount, statusMessage } = useUIStore();
  const [hintIndex, setHintIndex] = useState(0);

  const count = Math.max(clampLookCount(requestedLookCount), looks.length || 0);
  const isRendering = generationPhase === "rendering";
  const activeStep = generationPhase ? PHASE_STEP[generationPhase] : 0;
  const showOrbit =
    generationPhase === "selecting" ||
    generationPhase === "finishing" ||
    generationPhase === "rendering";

  const displayLooks = looks.length > 0 ? looks : Array.from({ length: count }, (_, i) => ({
    id: `placeholder-${i}`,
    rationale: "",
    isStylistPick: false,
  }));

  const displayMessage = useMemo(() => {
    if (generationPhase === "rendering") {
      return UI_COPY.generation.renderingHints[hintIndex % UI_COPY.generation.renderingHints.length];
    }
    if (generationPhase === "selecting") {
      return UI_COPY.generation.selectingHints[hintIndex];
    }
    if (generationPhase === "finishing") {
      return statusMessage ?? UI_COPY.generation.phases.finishing;
    }
    if (generationPhase === "analyzing") {
      return statusMessage ?? UI_COPY.generation.phases.analyzing;
    }
    return statusMessage ?? UI_COPY.grid.generating;
  }, [generationPhase, hintIndex, statusMessage]);

  useEffect(() => {
    if (generationPhase !== "selecting" && generationPhase !== "rendering") {
      setHintIndex(0);
      return;
    }

    const hints =
      generationPhase === "rendering"
        ? UI_COPY.generation.renderingHints
        : UI_COPY.generation.selectingHints;

    const id = window.setInterval(() => {
      setHintIndex((index) => (index + 1) % hints.length);
    }, 3500);

    return () => window.clearInterval(id);
  }, [generationPhase]);

  const renderedCount = looks.filter((l) => l.imageUrl || l.renderStatus === "ready").length;

  return (
    <div className={cn("space-y-5", className)}>
      <div className="flex flex-col items-center gap-4 text-center">
        <GeneratingMark showOrbit={showOrbit} />
        <PhaseStepper activeStep={activeStep} />
        <div className="min-h-[1.25rem]">
          <AnimatePresence mode="wait">
            <motion.p
              key={displayMessage}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.25 }}
              className="text-sm text-muted-foreground"
            >
              {displayMessage}
            </motion.p>
          </AnimatePresence>
        </div>
        {isRendering && count >= 1 && (
          <p className="text-xs font-medium text-primary">
            Look {Math.min(renderedCount + 1, count)} of {count}
          </p>
        )}
        {isRendering ? (
          <GeneratingPieceShuffle
            items={bodyItems.length > 0 ? bodyItems : wardrobeItems}
          />
        ) : (
          <GeneratingPieceShuffle items={wardrobeItems} />
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        {displayLooks.map((look, index) => (
          <LookRenderCard
            key={look.id}
            look={look.id.startsWith("placeholder") ? undefined : look}
            state={getCardState(
              look.id.startsWith("placeholder") ? undefined : look,
              index,
              displayLooks
            )}
            bodyItems={bodyItems}
            wardrobeItems={wardrobeItems}
            index={index}
          />
        ))}
      </div>
    </div>
  );
}
