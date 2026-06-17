"use client";

import Image from "next/image";
import type { LookWardrobePiece } from "@/lib/wardrobe/resolve-look-pieces";
import { pieceLabel } from "@/lib/wardrobe/resolve-look-pieces";
import { cn } from "@/lib/utils";

type Props = {
  items: LookWardrobePiece[];
  compact?: boolean;
  className?: string;
};

export function LookSelectedPieces({ items, compact, className }: Props) {
  if (!items.length) return null;

  const visible = compact ? items.slice(0, 3) : items;
  const overflow = compact ? Math.max(0, items.length - 3) : 0;

  return (
    <div className={cn("flex gap-2 overflow-x-auto", className)}>
      {visible.map((item) => (
        <div
          key={item.id}
          className={cn("shrink-0", compact ? "w-10" : "w-[4.5rem]")}
        >
          <div
            className={cn(
              "relative overflow-hidden rounded-2xl ring-1 ring-border shadow-sm",
              compact ? "h-10 w-10" : "h-14 w-14"
            )}
          >
            <Image
              src={item.imageUrl}
              alt={pieceLabel(item)}
              fill
              className="object-cover"
              unoptimized
            />
          </div>
          {!compact && (
            <p className="mt-1 line-clamp-2 text-center text-[10px] leading-tight text-muted-foreground">
              {pieceLabel(item)}
            </p>
          )}
        </div>
      ))}
      {overflow > 0 && (
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-muted text-xs font-medium text-muted-foreground ring-1 ring-border">
          +{overflow}
        </div>
      )}
    </div>
  );
}
