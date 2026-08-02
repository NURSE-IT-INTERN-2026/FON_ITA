"use client";

import { Search, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/** Wait this long after the last keystroke before navigating. */
const DEBOUNCE_MS = 350;

/**
 * Name filter for the file library (F21).
 *
 * Puts the term in the URL rather than filtering in place: the search survives
 * a reload, can be shared, and the list itself stays a Server Component. Typing
 * is debounced so a five-letter word is one request, not five.
 */
export function FileSearchInput({ defaultValue }: { defaultValue: string }) {
  const router = useRouter();
  const [value, setValue] = useState(defaultValue);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function navigate(term: string) {
    const trimmed = term.trim();
    // Drops `page` on purpose: results for a new term start at page 1, and
    // keeping the old page number would often land on an empty page.
    router.push(trimmed ? `/ita-file?q=${encodeURIComponent(trimmed)}` : "/ita-file");
  }

  function onChange(next: string) {
    setValue(next);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => navigate(next), DEBOUNCE_MS);
  }

  function clear() {
    if (timer.current) clearTimeout(timer.current);
    setValue("");
    navigate("");
  }

  return (
    <div className="relative w-full sm:w-64">
      <Search
        className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden
      />
      <Input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key !== "Enter") return;
          // Skip the wait when the user says they are done.
          e.preventDefault();
          if (timer.current) clearTimeout(timer.current);
          navigate(value);
        }}
        placeholder="ค้นหาชื่อไฟล์"
        aria-label="ค้นหาชื่อไฟล์"
        className="pl-8 pr-8"
      />
      {value && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="ล้างคำค้นหา"
          onClick={clear}
          className="absolute right-0.5 top-1/2 size-8 -translate-y-1/2"
        >
          <X className="size-4" aria-hidden />
        </Button>
      )}
    </div>
  );
}
