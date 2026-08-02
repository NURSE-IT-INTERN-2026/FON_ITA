import { History } from "lucide-react";
import type { Metadata } from "next";
import { ActivityFilter } from "@/components/activity/activity-filter";
import { EmptyState } from "@/components/misc/empty-state";
import { PaginationNav } from "@/components/misc/pagination-nav";
import { RoleBadge } from "@/components/misc/role-badge";
import { PageHeader } from "@/components/shell/page-header";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { actionLabel } from "@/lib/activity/actions";
import { countByAction, listActivities, normalizeActionFilter } from "@/lib/activity/queries";
import { requireRole } from "@/lib/auth/guards";
import { formatBEDateTime } from "@/lib/date";

export const metadata: Metadata = { title: "บันทึกกิจกรรม — FON-ITA" };

type Props = { searchParams: Promise<{ page?: string; action?: string }> };

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

  const { page: rawPage, action: rawAction } = await searchParams;
  const requested = Number(rawPage);
  // An unknown action becomes "no filter" rather than an empty table.
  const action = normalizeActionFilter(rawAction);

  const [{ activities, page, totalPages, total }, counts] = await Promise.all([
    listActivities(Number.isInteger(requested) && requested > 0 ? requested : 1, action),
    countByAction(),
  ]);

  const grandTotal = counts.reduce((sum, c) => sum + c.count, 0);
  const filtered = action !== undefined;

  return (
    <div>
      <PageHeader
        title="บันทึกกิจกรรม"
        breadcrumb={[{ label: "หน้าแรก", href: "/" }, { label: "บันทึกกิจกรรม" }]}
        description="ประวัติการเข้าสู่ระบบและการแก้ไขข้อมูลทั้งหมด · เห็นได้เฉพาะผู้ดูแลสูงสุด"
      />

      {grandTotal > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <ActivityFilter value={action} counts={counts} total={grandTotal} />
          <span className="text-xs text-muted-foreground">
            {filtered ? `แสดง ${total} จาก ${grandTotal} รายการ` : `ทั้งหมด ${grandTotal} รายการ`}
          </span>
        </div>
      )}

      {activities.length === 0 ? (
        <EmptyState
          icon={History}
          title={filtered ? "ไม่พบกิจกรรมตามตัวกรอง" : "ยังไม่มีบันทึกกิจกรรม"}
          description={
            filtered
              ? "ลองเปลี่ยนประเภทกิจกรรมด้านบน"
              : "การเข้าสู่ระบบและการแก้ไขข้อมูลจะถูกบันทึกไว้ที่นี่โดยอัตโนมัติ"
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-48">เวลา</TableHead>
                <TableHead className="w-56">ผู้กระทำ</TableHead>
                <TableHead className="w-44">กิจกรรม</TableHead>
                <TableHead>เป้าหมาย</TableHead>
                <TableHead>รายละเอียด</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {activities.map((entry) => (
                <TableRow key={entry.id}>
                  {/* พ.ศ. via lib/date.ts — never inline +543 */}
                  <TableCell className="whitespace-nowrap text-xs text-muted-foreground tabular-nums">
                    {formatBEDateTime(entry.createdAt)}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col items-start gap-1">
                      <span className="text-sm font-medium">{entry.actorName}</span>
                      <RoleBadge role={entry.actorRole} />
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">{actionLabel(entry.action)}</TableCell>
                  <TableCell className="text-sm">{entry.target ?? "—"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {entry.detail ?? "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <PaginationNav
        page={page}
        totalPages={totalPages}
        hrefFor={(n) =>
          action ? `/activity-log?action=${action}&page=${n}` : `/activity-log?page=${n}`
        }
      />
    </div>
  );
}
