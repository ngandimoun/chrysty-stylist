"use client";

import { UI_COPY } from "@/lib/chrysty/ui-copy";

type Props = {
  hasWardrobeItems: boolean;
};

export function EmptyLooks({ hasWardrobeItems }: Props) {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center px-6 text-center">
      <div className="stylist-mark mb-4 h-14 w-14 text-2xl">C</div>
      <p className="max-w-sm text-base leading-relaxed text-muted-foreground">
        {hasWardrobeItems ? UI_COPY.grid.emptyLooks : UI_COPY.grid.emptyWardrobe}
      </p>
    </div>
  );
}
