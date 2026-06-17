"use client";

import { OutfitMasonryGrid } from "@/components/masonry/outfit-masonry-grid";
import type { OutfitGenerationUI, OutfitLookUI } from "@/store/ui";

type Props = {
  generations: OutfitGenerationUI[];
  onSelectLook: (batch: OutfitGenerationUI, look: OutfitLookUI) => void;
};

export function OutfitGenerationsFeed({ generations, onSelectLook }: Props) {
  return (
    <div className="min-w-0 space-y-8 pb-4">
      {generations.map((batch) => (
        <section key={batch.generationId} className="min-w-0">
          <p className="mb-3 text-sm font-medium text-foreground">{batch.userPrompt}</p>
          <OutfitMasonryGrid
            looks={batch.looks}
            onSelect={(look) => onSelectLook(batch, look)}
          />
        </section>
      ))}
    </div>
  );
}
