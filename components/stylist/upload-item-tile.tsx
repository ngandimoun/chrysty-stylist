import Image from "next/image";
import { Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { UI_COPY } from "@/lib/chrysty/ui-copy";
import { shortAssetId } from "@/lib/uploads/asset";
import { cn } from "@/lib/utils";
import type { UploadAsset } from "@/components/stylist/upload-types";

type Props = {
  item: UploadAsset;
  deleting?: boolean;
  disabled?: boolean;
  onPreview: () => void;
  onDelete: () => void;
};

export function UploadItemTile({
  item,
  deleting = false,
  disabled = false,
  onPreview,
  onDelete,
}: Props) {
  const traceTitle = `${UI_COPY.uploads.fileId}: ${item.id}\n${UI_COPY.uploads.imageId}: ${item.imageId}\n${UI_COPY.uploads.storagePath}: ${item.storagePath}`;

  return (
    <div className="group/tile flex flex-col gap-1">
      <div className="relative aspect-square overflow-hidden rounded-xl border border-border/60 bg-muted shadow-sm">
        <button
          type="button"
          onClick={onPreview}
          disabled={deleting || disabled}
          className="absolute inset-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={UI_COPY.uploads.previewPhoto}
        >
          <Image
            src={item.imageUrl}
            alt=""
            fill
            className="object-cover transition-transform group-hover/tile:scale-[1.02]"
            unoptimized
            sizes="(max-width: 1024px) 33vw, 25vw"
          />
        </button>
        <Button
          type="button"
          variant="secondary"
          size="icon"
          disabled={deleting || disabled}
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className={cn(
            "absolute right-1.5 top-1.5 h-7 w-7 rounded-full bg-background/90 opacity-100 shadow-sm backdrop-blur-sm lg:opacity-0 lg:group-hover/tile:opacity-100",
            deleting && "opacity-100"
          )}
          aria-label={UI_COPY.uploads.deletePhoto}
        >
          {deleting ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Trash2 className="h-3.5 w-3.5 text-destructive" />
          )}
        </Button>
      </div>
      <p
        className="truncate px-0.5 text-center font-mono text-[10px] text-muted-foreground"
        title={traceTitle}
      >
        {shortAssetId(item.id)}
      </p>
    </div>
  );
}
