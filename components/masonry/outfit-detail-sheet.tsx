"use client";

import { useState } from "react";
import Image from "next/image";
import { ChrystyHostContext } from "@chrysty/live-embed";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { LookSelectedPieces } from "@/components/masonry/look-selected-pieces";
import { LookImageActions } from "@/components/masonry/look-image-actions";
import { LookImageLightbox } from "@/components/masonry/look-image-lightbox";
import { FEEDBACK_OPTIONS } from "@/lib/chrysty/onboarding";
import { useUIStore } from "@/store/ui";
import { useMediaQuery } from "@/hooks/use-media-query";

export function OutfitDetailSheet() {
  const { activeSheet, selectedLookId, generationLooks, closeSheet } = useUIStore();
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const [submitting, setSubmitting] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const look = generationLooks.find((l) => l.id === selectedLookId);

  async function submitFeedback(feedback: string) {
    if (!look) return;
    setSubmitting(true);
    try {
      await fetch("/api/outfits/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lookId: look.id, feedback }),
      });
      closeSheet();
    } finally {
      setSubmitting(false);
    }
  }

  const lookTitle = look
    ? `${look.occasionTag} · ${look.styleDirection || look.vibe}`
    : "Look";

  return (
    <>
      <Sheet
        open={activeSheet === "outfit-detail" && !!look}
        onOpenChange={(o) => {
          if (!o) {
            setPreviewOpen(false);
            closeSheet();
          }
        }}
      >
        <SheetContent
          side={isDesktop ? "right" : "bottom"}
          className="flex flex-col overflow-y-auto pb-[max(1rem,env(safe-area-inset-bottom))]"
        >
          {look && (
            <ChrystyHostContext
              source="stylist_look"
              entityId={look.id}
              title={lookTitle}
              captureTarget="#look-content"
              worker="stylist"
            >
              <div id="look-content" data-chrysty-capture>
                {look.imageUrl && (
                  <div className="relative mt-4 aspect-[4/5] w-full overflow-hidden rounded-2xl bg-muted">
                    <Image src={look.imageUrl} alt="" fill className="object-cover" unoptimized />
                    <LookImageActions
                      look={look}
                      onViewFull={() => setPreviewOpen(true)}
                      className="absolute right-3 top-3"
                      showLabels
                    />
                  </div>
                )}

                <div className="mt-6 space-y-4 rounded-3xl bg-muted/30 p-5 ring-1 ring-border">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    {look.occasionTag}
                  </p>
                  <p className="stylist-heading text-lg font-medium">
                    {look.styleDirection || look.vibe}
                  </p>
                  <p className="text-sm leading-relaxed text-foreground/90">{look.rationale}</p>
                  {look.stylingReasoning && (
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Why this works
                      </p>
                      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                        {look.stylingReasoning}
                      </p>
                    </div>
                  )}
                  {(look.selectedItems?.length || look.wardrobeItemIds?.length) && (
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Your pieces
                      </p>
                      {look.selectedItems?.length ? (
                        <LookSelectedPieces items={look.selectedItems} className="mt-2 py-1" />
                      ) : (
                        <p className="mt-1 text-sm text-muted-foreground">
                          Pieces selected — refresh wardrobe to preview
                        </p>
                      )}
                    </div>
                  )}
                  {look.itemReasoning && (
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Piece choices
                      </p>
                      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                        {look.itemReasoning}
                      </p>
                    </div>
                  )}
                </div>
                <div className="mt-6 flex flex-wrap gap-2">
                  {FEEDBACK_OPTIONS.map((opt) => (
                    <Button
                      key={opt.id}
                      variant="secondary"
                      size="sm"
                      disabled={submitting}
                      onClick={() => submitFeedback(opt.value)}
                    >
                      {opt.label}
                    </Button>
                  ))}
                </div>
              </div>
            </ChrystyHostContext>
          )}
        </SheetContent>
      </Sheet>

      <LookImageLightbox look={look ?? null} open={previewOpen} onClose={() => setPreviewOpen(false)} />
    </>
  );
}
