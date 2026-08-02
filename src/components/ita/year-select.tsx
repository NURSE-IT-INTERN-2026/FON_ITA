"use client";

import { useRouter } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/**
 * Year picker for the ITA list. Client Component only because a <Select>
 * needs an onChange handler — the list itself stays on the server.
 *
 * Navigating (rather than filtering in place) keeps the year in the URL, so a
 * staff member can bookmark or share a specific year, as they could in the
 * Laravel system.
 */
export function YearSelect({ years, value }: { years: string[]; value: string }) {
  const router = useRouter();

  return (
    <Select
      value={value}
      onValueChange={(year) => {
        // No basePath — router.push() prepends it.
        router.push(`/ita/by-year/${year}`);
      }}
    >
      <SelectTrigger className="w-36" aria-label="เลือกปี พ.ศ.">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {years.map((y) => (
          <SelectItem key={y} value={y}>
            ปี พ.ศ. {y}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
