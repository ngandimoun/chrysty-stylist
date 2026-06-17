"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { Download, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { UI_COPY } from "@/lib/chrysty/ui-copy";
import { downloadLookImage } from "@/lib/outfits/download-look-image";
import type { OutfitLookUI } from "@/store/ui";

type Props = {
  look: OutfitLookUI | null;
  open: boolean;
  onClose: () => void;
};

export function LookImageLightbox({ look, open, onClose }: Props) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open || !look?.imageUrl || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex flex-col bg-black/95"
      role="dialog"
      aria-modal="true"
      aria-label={UI_COPY.masonry.viewFull}
      onClick={onClose}
    >
      <div
        className="flex shrink-0 items-center justify-between gap-2 px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))]"
        onClick={(e) => e.stopPropagation()}
      >
        <Button type="button" variant="ghost" size="sm" className="text-white hover:bg-white/10" onClick={onClose}>
          <X className="h-4 w-4" />
          {UI_COPY.masonry.closePreview}
        </Button>
        <p className="truncate px-2 text-sm font-medium text-white/90">
          {look.styleDirection || look.vibe || "Your look"}
        </p>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => void downloadLookImage(look)}
        >
          <Download className="h-4 w-4" />
          {UI_COPY.masonry.download}
        </Button>
      </div>

      <div
        className="relative min-h-0 flex-1 px-4 pb-[max(1rem,env(safe-area-inset-bottom))]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative mx-auto h-full w-full max-w-3xl">
          <Image
            src={look.imageUrl}
            alt=""
            fill
            className="object-contain"
            unoptimized
            sizes="100vw"
            priority
          />
        </div>
      </div>
    </div>,
    document.body
  );
}
