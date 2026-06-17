"use client";

import { Loader2, Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { UI_COPY } from "@/lib/chrysty/ui-copy";
import { MAX_LOOK_COUNT, MIN_LOOK_COUNT } from "@/lib/chrysty/look-count-constants";

type Props = {
  value: string;
  lookCount: number;
  disabled: boolean;
  loading: boolean;
  onChange: (value: string) => void;
  onLookCountChange: (count: number) => void;
  onSubmit: () => void;
};

export function FloatingPrompt({
  value,
  lookCount,
  disabled,
  loading,
  onChange,
  onLookCountChange,
  onSubmit,
}: Props) {
  return (
    <div className="mb-4 flex flex-col items-center gap-2">
      <form
        className="flex w-full max-w-xl items-center gap-2 rounded-full border border-border bg-background/90 p-2 pl-5 shadow-lg backdrop-blur-md"
        onSubmit={(e) => {
          e.preventDefault();
          if (!disabled && !loading && value.trim()) onSubmit();
        }}
      >
        <input
          type="text"
          value={value}
          disabled={disabled || loading}
          onChange={(e) => onChange(e.target.value)}
          placeholder={
            disabled ? UI_COPY.input.disabledHint : UI_COPY.input.placeholder
          }
          className="min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-60"
        />
        <div
          className="flex shrink-0 items-center gap-1 rounded-full border border-border/70 bg-muted/40 px-1 py-0.5"
          aria-label="Number of looks"
        >
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 rounded-full"
            disabled={disabled || loading || lookCount <= MIN_LOOK_COUNT}
            onClick={() => onLookCountChange(lookCount - 1)}
            aria-label="Fewer looks"
          >
            <Minus className="h-3.5 w-3.5" />
          </Button>
          <span className="min-w-[1.25rem] text-center text-sm font-medium tabular-nums">
            {lookCount}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 rounded-full"
            disabled={disabled || loading || lookCount >= MAX_LOOK_COUNT}
            onClick={() => onLookCountChange(lookCount + 1)}
            aria-label="More looks"
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>
        <Button
          type="submit"
          size="sm"
          className="shrink-0 rounded-full px-5"
          disabled={disabled || loading || !value.trim()}
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Style me"}
        </Button>
      </form>
    </div>
  );
}
