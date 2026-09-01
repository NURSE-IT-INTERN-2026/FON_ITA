import type { Metadata } from "next";
import { ActivityLogClient } from "@/components/activity/activity-log-client";
import { PageHeader } from "@/components/shell/page-header";
import {
  countByAction,
  listActivities,
  listActivityActors,
  normalizeActionFilter,
  normalizeCategoryFilter,
} from "@/lib/activity/queries";
import { requireRole } from "@/lib/auth/guards";
import { currentBangkokMonth, formatBEDateTime } from "@/lib/date";

export const metadata: Metadata = { title: "บันทึกกิจกรรม — FON-ITA" };

type Props = {
  searchParams: Promise<{
    page?: string;
    action?: string;
    actor?: string;
    category?: string;
    q?: string;
    from?: string;
    to?: string;
    all?: string;
  }>;
};

function parsePositiveInt(value?: string): number | undefined {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

function normalizeDate(value?: string): string | undefined {
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : undefined;
}

function dateAtStart(value?: string): Date | undefined {
  return value ? new Date(`${value}T00:00:00+07:00`) : undefined;
}

function dateAfterEnd(value?: string): Date | undefined {
  if (!value) return undefined;

  const date = new Date(`${value}T00:00:00+07:00`);
  date.setDate(date.getDate() + 1);
  return date;
}

/**
 * Audit trail (F26) — SUPERADMIN only (role matrix in docs/specs/_features.md).
 *
 * Read-only by design: nothing in the app writes to this page, and there is no
 * delete. An audit trail that its subjects can edit is not one.
 */
export default async function ActivityLogPage({ searchParams }: Props) {
  // requireRole raises forbidden() → the 403 page (F12). An ADMIN following the
  // link from an old bookmark should be told why, not bounced to login.
  await requireRole("SUPERADMIN");

  const {
    page: rawPage,
    action: rawAction,
    actor: rawActor,
    category: rawCategory,
    q: rawQuery,
    from: rawFrom,
    to: rawTo,
    all: rawAll,
  } = await searchParams;
  const requested = Number(rawPage);
  const action = normalizeActionFilter(rawAction);
  const actorId = parsePositiveInt(rawActor);
  const category = normalizeCategoryFilter(rawCategory);
  const query = rawQuery?.trim() ? rawQuery.trim() : undefined;

  // Default window = the current Bangkok month. The log grows without bound
  // and "recent" is what anyone opening the page wants; `?all=1` opts out and
  // explicit from/to replace it (datesAreDefault tells the client which case
  // it is showing, so the "กรองอยู่" copy stays honest).
  const showAll = rawAll === "1";
  const fromParam = normalizeDate(rawFrom);
  const toParam = normalizeDate(rawTo);
  const monthDefault = !showAll && !fromParam && !toParam ? currentBangkokMonth() : undefined;
  const from = fromParam ?? monthDefault?.from;
  const to = toParam ?? monthDefault?.to;

  const [{ activities, page, totalPages, total }, counts, actors] = await Promise.all([
    listActivities(Number.isInteger(requested) && requested > 0 ? requested : 1, {
      action,
      actorId,
      category,
      search: query,
      from: dateAtStart(from),
      to: dateAfterEnd(to),
    }),
    countByAction(),
    listActivityActors(),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="บันทึกกิจกรรม"
        breadcrumb={[{ label: "หน้าแรก", href: "/" }, { label: "บันทึกกิจกรรม" }]}
        description="ติดตามการกระทำสำคัญของผู้ใช้ในระบบเพื่อใช้ตรวจสอบย้อนหลัง"
        variant="featured"
      />

      <ActivityLogClient
        action={action}
        actorId={actorId}
        category={category}
        counts={counts}
        actors={actors}
        query={query}
        from={from}
        to={to}
        datesAreDefault={Boolean(monthDefault)}
        allActive={showAll}
        page={page}
        totalPages={totalPages}
        total={total}
        activities={activities.map((entry) => ({
          ...entry,
          createdAtLabel: formatBEDateTime(entry.createdAt),
        }))}
      />
    </div>
  );
}
