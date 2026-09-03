import type { AppRole } from "@/generated/prisma/enums";
import type { ActivityCategory } from "@/lib/activity/meta";
import { categoryForAction } from "@/lib/activity/meta";
import { escapeLike, prisma } from "@/lib/prisma";
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

export type ActivityActorOption = {
  actorId: number;
  actorName: string;
  actorRole: AppRole;
};

export type ActivityFilters = {
  action?: string;
  actorId?: number;
  category?: ActivityCategory;
  search?: string;
  from?: Date;
  to?: Date;
};

/**
 * Only a known action is allowed through to the query. An unknown value from
 * the query string becomes "no filter" rather than an empty table with no
 * explanation.
 */
export function normalizeActionFilter(value?: string): string | undefined {
  return value && isActivityAction(value) ? value : undefined;
}

export function normalizeCategoryFilter(value?: string): ActivityCategory | undefined {
  if (
    value === "auth" ||
    value === "ita_oit" ||
    value === "file" ||
    value === "user" ||
    value === "profile"
  ) {
    return value;
  }

  return undefined;
}

function categoryWhere(category?: ActivityCategory) {
  switch (category) {
    case "auth":
      return { action: { in: ["login", "logout"] } };
    case "ita_oit":
      return { OR: [{ action: { startsWith: "ita." } }, { action: { startsWith: "oit." } }] };
    case "file":
      return { action: { startsWith: "file." } };
    case "user":
      return { action: { startsWith: "user." } };
    case "profile":
      return { action: { startsWith: "profile." } };
    default:
      return undefined;
  }
}

function activityWhere(filters: ActivityFilters) {
  const and: object[] = [];

  if (filters.action) and.push({ action: filters.action });
  if (filters.actorId) and.push({ actorId: filters.actorId });

  const search = filters.search?.trim();
  if (search) {
    const term = escapeLike(search);
    and.push({
      OR: [
        { actorName: { contains: term, mode: "insensitive" as const } },
        { target: { contains: term, mode: "insensitive" as const } },
        { detail: { contains: term, mode: "insensitive" as const } },
      ],
    });
  }

  const category = categoryWhere(filters.category);
  if (category) and.push(category);

  if (filters.from || filters.to) {
    and.push({
      createdAt: {
        ...(filters.from ? { gte: filters.from } : {}),
        ...(filters.to ? { lt: filters.to } : {}),
      },
    });
  }

  return and.length > 0 ? { AND: and } : {};
}

/**
 * One page of the log, newest first.
 *
 * `page` is clamped, like the file library: the number comes from the URL, and
 * a value past the end would otherwise strand the reader on a blank page.
 */
export async function listActivities(page: number, filters: ActivityFilters = {}): Promise<ActivityPage> {
  const where = activityWhere(filters);

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

export async function listActivityActors(): Promise<ActivityActorOption[]> {
  const rows = await prisma.activityLog.findMany({
    where: { actorId: { not: null } },
    distinct: ["actorId"],
    orderBy: [{ actorId: "asc" }, { createdAt: "desc" }],
    select: {
      actorId: true,
      actorName: true,
      actorRole: true,
    },
  });

  return rows
    .filter((row): row is { actorId: number; actorName: string; actorRole: AppRole } => row.actorId !== null)
    .sort((a, b) => a.actorName.localeCompare(b.actorName, "th"));
}

export function categoryCountSummary(counts: { action: string; count: number }[]) {
  const totals = new Map<ActivityCategory, number>();

  for (const { action, count } of counts) {
    const category = categoryForAction(action);
    if (!category) continue;
    totals.set(category, (totals.get(category) ?? 0) + count);
  }

  return totals;
}
