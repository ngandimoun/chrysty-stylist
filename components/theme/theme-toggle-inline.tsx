"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { UI_COPY } from "@/lib/chrysty/ui-copy";
import { cn } from "@/lib/utils";

const options = [
  { id: "light", icon: Sun, label: UI_COPY.theme.light },
  { id: "dark", icon: Moon, label: UI_COPY.theme.dark },
  { id: "system", icon: Monitor, label: UI_COPY.theme.system },
] as const;

export function ThemeToggleInline() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) return null;

  return (
    <div
      className="inline-flex gap-0.5 rounded-full border border-border/70 bg-muted/40 p-0.5"
        role="group"
        aria-label={UI_COPY.theme.label}
      >
        {options.map(({ id, icon: Icon, label }) => {
          const active = theme === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => setTheme(id)}
              aria-label={label}
              aria-pressed={active}
              className={cn(
                "flex h-7 w-7 items-center justify-center rounded-full transition-colors",
                active
                  ? "bg-background text-primary shadow-sm ring-1 ring-border/60"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="h-3.5 w-3.5" strokeWidth={active ? 2.25 : 1.75} />
            </button>
          );
        })}
    </div>
  );
}
