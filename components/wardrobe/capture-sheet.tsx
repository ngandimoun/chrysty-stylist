"use client";

import { useCallback, useRef, useState } from "react";
import { Loader2, Upload } from "lucide-react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { UploadItemTile } from "@/components/stylist/upload-item-tile";
import { UploadPreviewLightbox } from "@/components/stylist/upload-preview-lightbox";
import type { UploadAsset } from "@/components/stylist/upload-types";
import { UI_COPY } from "@/lib/chrysty/ui-copy";
import { BODY_UPLOAD_MAX, WARDROBE_UPLOAD_MAX } from "@/lib/uploads/limits";
import { readJsonResponse } from "@/lib/http/read-json-response";
import { useUIStore } from "@/store/ui";
import { cn } from "@/lib/utils";

type Props = {
  bodyCount: number;
  wardrobeCount: number;
  bodyItems: UploadAsset[];
  wardrobeItems: UploadAsset[];
  onUploadConfirmed?: () => void;
  onDelete: (id: string) => Promise<void>;
};

export function CaptureSheet({
  bodyCount,
  wardrobeCount,
  bodyItems,
  wardrobeItems,
  onUploadConfirmed,
  onDelete,
}: Props) {
  const { activeSheet, captureMode, closeSheet } = useUIStore();
  const fileRef = useRef<HTMLInputElement>(null);
  const inFlightRef = useRef(0);
  const [inFlight, setInFlight] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const isBody = captureMode === "body";
  const copy = isBody ? UI_COPY.uploads.body : UI_COPY.uploads.wardrobe;
  const items = isBody ? bodyItems : wardrobeItems;
  const currentCount = isBody ? bodyCount : wardrobeCount;
  const maxCount = isBody ? BODY_UPLOAD_MAX : WARDROBE_UPLOAD_MAX;
  const uploading = inFlight > 0;
  const atLimit = currentCount + inFlight >= maxCount;

  const resetSheetState = useCallback(() => {
    setError(null);
    setPreviewId(null);
    setDeletingId(null);
  }, []);

  const handleDelete = useCallback(
    async (id: string) => {
      if (deletingId) return;
      setDeletingId(id);
      setError(null);
      try {
        await onDelete(id);
        const remaining = items.filter((item) => item.id !== id);
        if (previewId === id) {
          if (remaining.length === 0) {
            setPreviewId(null);
          } else {
            const deletedIndex = items.findIndex((item) => item.id === id);
            const nextItem = remaining[Math.min(deletedIndex, remaining.length - 1)];
            setPreviewId(nextItem.id);
          }
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Delete failed");
      } finally {
        setDeletingId(null);
      }
    },
    [deletingId, items, onDelete, previewId]
  );

  const uploadFile = useCallback(
    async (file: File) => {
      if (!captureMode) return;
      if (currentCount + inFlightRef.current >= maxCount) return;

      inFlightRef.current += 1;
      setInFlight(inFlightRef.current);
      setError(null);
      try {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("filename", file.name);

        const endpoint = captureMode === "body" ? "/api/body/upload" : "/api/wardrobe/upload";
        const res = await fetch(endpoint, { method: "POST", body: formData });
        const data = await readJsonResponse<{ error?: string }>(res);
        if (!res.ok) throw new Error(data.error ?? "Upload failed");

        onUploadConfirmed?.();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Upload failed");
      } finally {
        inFlightRef.current = Math.max(0, inFlightRef.current - 1);
        setInFlight(inFlightRef.current);
      }
    },
    [captureMode, currentCount, maxCount, onUploadConfirmed]
  );

  return (
    <Sheet
      open={activeSheet === "capture"}
      onOpenChange={(o) => {
        if (!o) {
          closeSheet();
          resetSheetState();
        }
      }}
    >
      <SheetContent
        side="bottom"
        className="mx-auto flex h-[90vh] w-full max-w-lg flex-col overflow-hidden p-0"
      >
        <div className="relative flex min-h-0 flex-1 flex-col">
          {previewId && (
            <UploadPreviewLightbox
              items={items}
              activeId={previewId}
              deleting={deletingId === previewId}
              onClose={() => setPreviewId(null)}
              onDelete={(id) => void handleDelete(id)}
              onNavigate={setPreviewId}
            />
          )}

          <div className="flex min-h-0 flex-1 flex-col px-6 pb-6 pt-6">
          <div className="flex items-center justify-between pr-10">
            <h2 className="stylist-heading text-lg font-semibold">{copy.sheetTitle}</h2>
            <Button variant="ghost" size="sm" onClick={closeSheet}>
              Done
            </Button>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">{copy.sheetHint}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {currentCount + inFlight} / {maxCount}
          </p>

          <div
            className={cn(
              "mt-4 flex flex-col items-center justify-center rounded-3xl border border-dashed border-border bg-muted/30 p-6",
              atLimit && "opacity-60"
            )}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              if (atLimit) return;
              const files = Array.from(e.dataTransfer.files ?? []);
              files.forEach((file) => void uploadFile(file));
            }}
          >
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              multiple
              onChange={(e) => {
                const files = Array.from(e.target.files ?? []);
                files.forEach((f) => void uploadFile(f));
                e.target.value = "";
              }}
            />
            <Button
              variant="outline"
              disabled={uploading || atLimit}
              onClick={() => fileRef.current?.click()}
            >
              {uploading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Upload className="h-4 w-4" />
              )}
              {uploading ? copy.uploading : atLimit ? copy.limitReached : copy.uploadCta}
            </Button>
            {!atLimit && (
              <p className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                <Upload className="h-3 w-3" /> or drag and drop
              </p>
            )}
          </div>

          <div className="mt-5 min-h-0 flex-1">
            <p className="mb-2 text-xs font-medium text-muted-foreground">
              {UI_COPY.uploads.yourPhotos}
            </p>
            {items.length === 0 ? (
              <p className="text-sm text-muted-foreground">{UI_COPY.uploads.noPhotosYet}</p>
            ) : (
              <ScrollArea className="h-[min(40vh,320px)] pr-3">
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {items.map((item) => (
                    <UploadItemTile
                      key={item.id}
                      item={item}
                      deleting={deletingId === item.id}
                      disabled={uploading || deletingId !== null}
                      onPreview={() => setPreviewId(item.id)}
                      onDelete={() => void handleDelete(item.id)}
                    />
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>

          {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
