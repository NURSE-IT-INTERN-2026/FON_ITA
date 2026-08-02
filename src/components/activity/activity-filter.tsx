"use client";

import { useRouter } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { actionLabel } from "@/lib/activity/actions";

/** Sentinel for "no filter" — Radix's Select cannot hold an empty string value. */
const ALL = "ALL";

/**
 * Action filter for the activity log (F26).
 *
 * Navigates instead of filtering in place, like the ITA year picker: the filter
 * lives in the URL, so a particular view can be linked to, and the table itself
 * stays a Server Component. Changing the filter drops back to page 1 — page 4
 * of "all" says nothing about where the same rows sit once filtered.
 */
export function ActivityFilter({
  value,
  counts,
  total,
}: {
  value?: string;
  counts: { action: string; count: number }[];
  total: number;
}) {
  const router = useRouter();

  return (
    <Select
      value={value ?? ALL}
      onValueChange={(next) => {
        // No basePath — router.push() prepends it.
        router.push(next === ALL ? "/activity-log" : `/activity-log?action=${next}`);
      }}
    >
      <SelectTrigger className="w-64" aria-label="กรองตามประเภทกิจกรรม">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>ทุกกิจกรรม ({total})</SelectItem>
        {counts.map(({ action, count }) => (
          <SelectItem key={action} value={action}>
            {actionLabel(action)} ({count})
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
