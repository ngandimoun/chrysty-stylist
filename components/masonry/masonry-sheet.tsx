"use client";

import { Sheet, SheetContent } from "@/components/ui/sheet";
import { OutfitMasonryGrid } from "@/components/masonry/outfit-masonry-grid";
import { useUIStore } from "@/store/ui";
import { useMediaQuery } from "@/hooks/use-media-query";
import { UI_COPY } from "@/lib/chrysty/ui-copy";

export function MasonrySheet() {
  const { activeSheet, generationLooks, openOutfitDetail, closeSheet } = useUIStore();
  const isDesktop = useMediaQuery("(min-width: 1024px)");

  return (
    <Sheet open={activeSheet === "masonry"} onOpenChange={(o) => !o && closeSheet()}>
      <SheetContent side={isDesktop ? "right" : "bottom"} className="flex flex-col">
        <h2 className="stylist-heading pr-10 text-lg font-semibold">{UI_COPY.masonry.title}</h2>
        <div className="mt-4 flex-1 overflow-y-auto pb-8">
          <OutfitMasonryGrid
            looks={generationLooks}
            onSelect={(look) => openOutfitDetail(look.id)}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}
