"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { OutfitMasonryGrid } from "@/components/masonry/outfit-masonry-grid";
import type { UploadAsset } from "@/components/stylist/upload-types";
import { FEEDBACK_OPTIONS } from "@/lib/chrysty/onboarding";
import { shortAssetId } from "@/lib/uploads/asset";
import { Button } from "@/components/ui/button";
import type { OutfitLookUI } from "@/store/ui";
import { cn } from "@/lib/utils";

export type ChatMessageUI = {
  id: string;
  role: "user" | "assistant";
  content: string;
  metadata?: {
    type?: string;
    looks?: OutfitLookUI[];
    generationId?: string;
  };
};

export function MessageBubble({
  message,
  onOpenMasonry,
  onFeedback,
}: {
  message: ChatMessageUI;
  onOpenMasonry?: (looks: OutfitLookUI[]) => void;
  onFeedback?: (lookId: string, feedback: string) => void;
}) {
  const isUser = message.role === "user";
  const looks = message.metadata?.looks;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn("flex", isUser ? "justify-end" : "justify-start")}
    >
      <div
        className={cn(
          "max-w-[88%] rounded-3xl px-4 py-3 text-[17px] leading-relaxed",
          isUser
            ? "bg-primary text-primary-foreground shadow-sm"
            : "stylist-card py-3 shadow-md"
        )}
      >
        <p className="whitespace-pre-wrap">{message.content}</p>
        {looks && looks.length > 0 && (
          <div className="mt-3">
            <OutfitMasonryGrid
              looks={looks}
              compact
              onSelect={() => onOpenMasonry?.(looks)}
            />
            <Button
              variant="secondary"
              size="sm"
              className="mt-3 w-full"
              onClick={() => onOpenMasonry?.(looks)}
            >
              View all looks
            </Button>
            {looks.find((l) => l.isStylistPick) && onFeedback && (
              <div className="mt-2 flex flex-wrap gap-2">
                {FEEDBACK_OPTIONS.slice(0, 3).map((opt) => (
                  <Button
                    key={opt.id}
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      onFeedback(looks.find((l) => l.isStylistPick)!.id, opt.value)
                    }
                  >
                    {opt.label}
                  </Button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}

export function ThinkingIndicator({ phrase }: { phrase: string }) {
  return (
    <div className="flex justify-start">
      <div className="stylist-card py-3 text-sm text-muted-foreground">
        {phrase}
        <span className="animate-pulse">…</span>
      </div>
    </div>
  );
}

export function SuggestionChips({
  chips,
  onSelect,
}: {
  chips: string[];
  onSelect: (chip: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2 px-1 pb-2">
      {chips.map((chip) => (
        <button
          key={chip}
          type="button"
          onClick={() => onSelect(chip)}
          className="stylist-chip"
        >
          {chip}
        </button>
      ))}
    </div>
  );
}

export function WardrobeStrip({ items }: { items: UploadAsset[] }) {
  if (!items.length) return null;
  return (
    <div className="flex gap-2 overflow-x-auto px-1 py-2">
      {items.map((item) => (
        <div
          key={item.id}
          className="relative h-14 w-14 shrink-0 overflow-hidden rounded-2xl ring-1 ring-border shadow-sm"
          title={item.id}
        >
          <Image
            src={item.imageUrl}
            alt={shortAssetId(item.id)}
            fill
            className="object-cover"
            unoptimized
          />
        </div>
      ))}
    </div>
  );
}
