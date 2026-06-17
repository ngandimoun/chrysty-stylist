"use client";

import Image from "next/image";
import { Download, Maximize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { UI_COPY } from "@/lib/chrysty/ui-copy";
import { downloadLookImage } from "@/lib/outfits/download-look-image";
import type { OutfitLookUI } from "@/store/ui";
import { cn } from "@/lib/utils";

type Props = {
  look: OutfitLookUI;
  onViewFull: () => void;
  className?: string;
  showLabels?: boolean;
};

export function LookImageActions({ look, onViewFull, className, showLabels = false }: Props) {
  if (!look.imageUrl) return null;

  return (
    <div
      className={cn("flex gap-1", className)}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      <Button
        type="button"
        size={showLabels ? "sm" : "icon"}
        variant="secondary"
        className={cn(!showLabels && "h-8 w-8 rounded-full shadow-md")}
        aria-label={UI_COPY.masonry.viewFull}
        onClick={onViewFull}
      >
        <Maximize2 className="h-4 w-4" />
        {showLabels ? UI_COPY.masonry.viewFull : null}
      </Button>
      <Button
        type="button"
        size={showLabels ? "sm" : "icon"}
        variant="secondary"
        className={cn(!showLabels && "h-8 w-8 rounded-full shadow-md")}
        aria-label={UI_COPY.masonry.download}
        onClick={() => void downloadLookImage(look)}
      >
        <Download className="h-4 w-4" />
        {showLabels ? UI_COPY.masonry.download : null}
      </Button>
    </div>
  );
}
