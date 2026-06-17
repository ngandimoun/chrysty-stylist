"use client";

import { useState } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import { OUTFIT_RESPONSE_TEMPLATE } from "@/lib/chrysty/chat-intents";
import { LookSelectedPieces } from "@/components/masonry/look-selected-pieces";
import { LookImageActions } from "@/components/masonry/look-image-actions";
import { LookImageLightbox } from "@/components/masonry/look-image-lightbox";
import type { OutfitLookUI } from "@/store/ui";
import { cn } from "@/lib/utils";

type Props = {
  looks: OutfitLookUI[];
  compact?: boolean;
  onSelect?: (look: OutfitLookUI) => void;
};

function truncate(text: string, max = 56) {
  if (text.length <= max) return text;
  return `${text.slice(0, max).trim()}…`;
}

export function OutfitMasonryGrid({ looks, compact, onSelect }: Props) {
  const [previewLook, setPreviewLook] = useState<OutfitLookUI | null>(null);

  return (
    <>
      <div
        className={cn(
          "grid w-full min-w-0 gap-2",
          compact ? "grid-cols-2" : "grid-cols-2 md:grid-cols-3 xl:grid-cols-4"
        )}
      >
        {looks.map((look, i) => (
          <motion.div
            key={look.id}
            role={onSelect ? "button" : undefined}
            tabIndex={onSelect ? 0 : undefined}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            onClick={() => onSelect?.(look)}
            onKeyDown={(e) => {
              if (!onSelect) return;
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onSelect(look);
              }
            }}
            className={cn(
              "relative flex h-full min-h-0 min-w-0 w-full flex-col overflow-hidden rounded-2xl bg-card p-3 text-left shadow-md ring-1 ring-inset ring-border transition-shadow hover:shadow-lg",
              look.isStylistPick && "ring-2 ring-inset ring-primary shadow-lg",
              onSelect && "cursor-pointer"
            )}
          >
            <div className="mb-2 flex h-6 shrink-0 items-center">
              {look.isStylistPick && (
                <span className="inline-flex rounded-full bg-primary px-2 py-0.5 text-[10px] font-medium text-primary-foreground shadow-sm">
                  {OUTFIT_RESPONSE_TEMPLATE.heroLabel}
                </span>
              )}
            </div>
            {look.imageUrl ? (
              <div className="relative mb-2 aspect-[4/5] w-full shrink-0 overflow-hidden rounded-xl bg-muted">
                <Image
                  src={look.imageUrl}
                  alt=""
                  fill
                  className="object-cover"
                  unoptimized
                />
                <LookImageActions
                  look={look}
                  onViewFull={() => setPreviewLook(look)}
                  className="absolute right-2 top-2"
                />
              </div>
            ) : look.renderStatus === "pending" ? (
              <div className="relative mb-2 aspect-[4/5] w-full shrink-0 overflow-hidden rounded-xl bg-muted/50">
                <motion.div
                  className="absolute inset-0 animate-shimmer"
                  animate={{ opacity: [0.4, 0.7, 0.4] }}
                  transition={{ duration: 2, repeat: Infinity }}
                />
              </div>
            ) : (
              <div className="mb-2 aspect-[4/5] w-full shrink-0 rounded-xl bg-muted/30" />
            )}
            <p className="line-clamp-1 shrink-0 font-serif text-sm font-medium leading-snug">
              {look.styleDirection || look.vibe || "Stylist pick"}
            </p>
            <p className="mt-1 line-clamp-2 h-8 shrink-0 text-xs leading-snug text-muted-foreground">
              {truncate(look.rationale)}
            </p>
            <div className="mt-auto flex shrink-0 flex-wrap items-center gap-1.5 border-t border-border/60 pt-2">
              {look.occasionTag && (
                <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  {look.occasionTag}
                </span>
              )}
              {look.selectedItems?.length ? (
                <LookSelectedPieces items={look.selectedItems} compact className="ml-auto" />
              ) : look.wardrobeItemIds?.length ? (
                <span className="text-[10px] text-muted-foreground">
                  Pieces: {look.wardrobeItemIds.length}
                </span>
              ) : null}
            </div>
          </motion.div>
        ))}
      </div>

      <LookImageLightbox
        look={previewLook}
        open={!!previewLook}
        onClose={() => setPreviewLook(null)}
      />
    </>
  );
}
