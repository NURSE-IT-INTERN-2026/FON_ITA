import type { AppRole } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { isActivityAction } from "@/lib/activity/actions";

// Read side of the activity log (F26). SUPERADMIN only — enforced by the page
// that calls this, since nothing else has a reason to read it.

/** Rows per page. Matches the file library so the two lists feel the same. */
export const ACTIVITIES_PER_PAGE = 20;

export type ActivityRow = {
  id: number;
  actorName: string;
  actorRole: AppRole;
  action: string;
  target: string | null;
  detail: string | null;
  createdAt: Date;
};

export type ActivityPage = {
  activities: ActivityRow[];
  page: number;
  totalPages: number;
  total: number;
};

/**
 * Only a known action is allowed through to the query. An unknown value from
 * the query string becomes "no filter" rather than an empty table with no
 * explanation.
 */
export function normalizeActionFilter(value?: string): string | undefined {
  return value && isActivityAction(value) ? value : undefined;
}

/**
 * One page of the log, newest first.
 *
 * `page` is clamped, like the file library: the number comes from the URL, and
 * a value past the end would otherwise strand the reader on a blank page.
 */
export async function listActivities(page: number, action?: string): Promise<ActivityPage> {
  const where = action ? { action } : {};

  const total = await prisma.activityLog.count({ where });
  const totalPages = Math.max(1, Math.ceil(total / ACTIVITIES_PER_PAGE));
  const current = Math.min(Math.max(1, page), totalPages);

  const activities = await prisma.activityLog.findMany({
    where,
    // id breaks ties: two rows written in the same millisecond would otherwise
    // be free to swap places between pages and hide one of themselves.
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    skip: (current - 1) * ACTIVITIES_PER_PAGE,
    take: ACTIVITIES_PER_PAGE,
    select: {
      id: true,
      actorName: true,
      actorRole: true,
      action: true,
      target: true,
      detail: true,
      createdAt: true,
    },
  });

  return { activities, page: current, totalPages, total };
}

/** How many entries each action has, for the filter dropdown. */
export async function countByAction(): Promise<{ action: string; count: number }[]> {
  const groups = await prisma.activityLog.groupBy({
    by: ["action"],
    _count: { action: true },
  });

  return groups
    .map((g) => ({ action: g.action, count: g._count.action }))
    .sort((a, b) => b.count - a.count || a.action.localeCompare(b.action));
}
