"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";

export function ThemeToggle() {
  const { setTheme, resolvedTheme } = useTheme();

  // `resolvedTheme` is undefined during SSR and the first client render, so it is
  // never read while rendering — reading it here would cause a hydration mismatch.
  // Which icon shows is decided purely in CSS by the `.dark` class on <html>, and
  // the label stays theme-independent for the same reason.
  return (
    <Button
      variant="ghost"
      size="icon"
      className="relative"
      aria-label="สลับธีมสว่าง/มืด"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
    >
      <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" aria-hidden />
      <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" aria-hidden />
    </Button>
  );
}
