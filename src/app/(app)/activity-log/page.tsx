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
import { formatBEDateTime } from "@/lib/date";

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
  } = await searchParams;
  const requested = Number(rawPage);
  const action = normalizeActionFilter(rawAction);
  const actorId = parsePositiveInt(rawActor);
  const category = normalizeCategoryFilter(rawCategory);
  const query = rawQuery?.trim() ? rawQuery.trim() : undefined;
  const from = normalizeDate(rawFrom);
  const to = normalizeDate(rawTo);

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
