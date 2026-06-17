"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import {
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@/components/ui/dropdown-menu";
import { UI_COPY } from "@/lib/chrysty/ui-copy";

export function ThemeToggleMenu() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) return null;

  return (
    <>
      <DropdownMenuSeparator />
      <DropdownMenuSub>
        <DropdownMenuSubTrigger>{UI_COPY.theme.label}</DropdownMenuSubTrigger>
        <DropdownMenuSubContent>
          <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
            {UI_COPY.theme.label}
          </DropdownMenuLabel>
          <DropdownMenuItem onClick={() => setTheme("light")}>
            <Sun className="h-4 w-4" />
            {UI_COPY.theme.light}
            {theme === "light" && <span className="ml-auto text-xs text-primary">✓</span>}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setTheme("dark")}>
            <Moon className="h-4 w-4" />
            {UI_COPY.theme.dark}
            {theme === "dark" && <span className="ml-auto text-xs text-primary">✓</span>}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setTheme("system")}>
            <Monitor className="h-4 w-4" />
            {UI_COPY.theme.system}
            {theme === "system" && <span className="ml-auto text-xs text-primary">✓</span>}
          </DropdownMenuItem>
        </DropdownMenuSubContent>
      </DropdownMenuSub>
    </>
  );
}
