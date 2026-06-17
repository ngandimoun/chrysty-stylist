"use client";

import Image from "next/image";
import { ChevronLeft, ChevronRight, Loader2, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { UI_COPY } from "@/lib/chrysty/ui-copy";
import type { UploadAsset } from "@/components/stylist/upload-types";

type Props = {
  items: UploadAsset[];
  activeId: string;
  deleting?: boolean;
  onClose: () => void;
  onDelete: (id: string) => void;
  onNavigate: (id: string) => void;
};

function TraceRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="truncate font-mono text-xs text-foreground" title={value}>
        {value}
      </dd>
    </div>
  );
}

export function UploadPreviewLightbox({
  items,
  activeId,
  deleting = false,
  onClose,
  onDelete,
  onNavigate,
}: Props) {
  const activeIndex = items.findIndex((item) => item.id === activeId);
  const activeItem = activeIndex >= 0 ? items[activeIndex] : null;
  const hasPrev = activeIndex > 0;
  const hasNext = activeIndex >= 0 && activeIndex < items.length - 1;

  if (!activeItem) return null;

  return (
    <div className="absolute inset-0 z-10 flex flex-col bg-background">
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border/60 px-1 py-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onClose}
          aria-label={UI_COPY.uploads.closePreview}
        >
          <X className="h-4 w-4" />
          {UI_COPY.uploads.closePreview}
        </Button>
        <span className="text-xs text-muted-foreground">
          {activeIndex + 1} / {items.length}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          disabled={deleting}
          onClick={() => onDelete(activeItem.id)}
          aria-label={UI_COPY.uploads.deletePhoto}
        >
          {deleting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Trash2 className="h-4 w-4 text-destructive" />
          )}
        </Button>
      </div>

      <div className="relative flex min-h-0 flex-1 items-center justify-center p-4">
        {hasPrev && (
          <Button
            type="button"
            variant="secondary"
            size="icon"
            className="absolute left-2 z-10 h-9 w-9 rounded-full shadow-md"
            onClick={() => onNavigate(items[activeIndex - 1].id)}
            aria-label={UI_COPY.uploads.previousPhoto}
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
        )}

        <div className="relative h-full w-full max-h-[min(70vh,520px)] overflow-hidden rounded-2xl bg-muted">
          <Image
            src={activeItem.imageUrl}
            alt={UI_COPY.uploads.previewPhoto}
            fill
            className="object-contain"
            unoptimized
            sizes="100vw"
            priority
          />
        </div>

        {hasNext && (
          <Button
            type="button"
            variant="secondary"
            size="icon"
            className="absolute right-2 z-10 h-9 w-9 rounded-full shadow-md"
            onClick={() => onNavigate(items[activeIndex + 1].id)}
            aria-label={UI_COPY.uploads.nextPhoto}
          >
            <ChevronRight className="h-5 w-5" />
          </Button>
        )}
      </div>

      <dl className="grid shrink-0 gap-2 border-t border-border/60 px-4 py-3 sm:grid-cols-3">
        <TraceRow label={UI_COPY.uploads.fileId} value={activeItem.id} />
        <TraceRow label={UI_COPY.uploads.imageId} value={activeItem.imageId} />
        <TraceRow label={UI_COPY.uploads.storagePath} value={activeItem.storagePath} />
      </dl>
    </div>
  );
}
