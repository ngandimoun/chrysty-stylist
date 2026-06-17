import Image from "next/image";
import { cn } from "@/lib/utils";
import type { UploadAsset } from "@/components/stylist/upload-types";

type Props = {
  items: UploadAsset[];
  maxVisible?: number;
  className?: string;
};

export function UploadPreviewStack({ items, maxVisible = 3, className }: Props) {
  if (!items.length) return null;

  const visible = items.slice(-maxVisible).reverse();

  return (
    <div className={cn("mt-3 flex items-center", className)}>
      <div className="flex items-center">
        {visible.map((item, index) => (
          <div
            key={item.id}
            className="relative h-8 w-8 overflow-hidden rounded-full border-2 border-background bg-muted shadow-sm"
            style={{ marginLeft: index === 0 ? 0 : -10, zIndex: visible.length - index }}
            data-upload-id={item.id}
            data-image-id={item.imageId}
            data-storage-path={item.storagePath}
          >
            <Image
              src={item.imageUrl}
              alt=""
              fill
              className="object-cover"
              unoptimized
              sizes="32px"
            />
          </div>
        ))}
      </div>
      {items.length > maxVisible && (
        <span className="ml-2 text-[11px] font-medium text-muted-foreground">
          +{items.length - maxVisible}
        </span>
      )}
    </div>
  );
}
