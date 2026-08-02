import { FileText, ListChecks } from "lucide-react";
import { ItaCardActions, ItaCreateButton } from "@/components/ita/ita-manage";
import { YearBadge } from "@/components/ita/year-badge";
import { YearSelect } from "@/components/ita/year-select";
import { EmptyState } from "@/components/misc/empty-state";
import { PageHeader, type Crumb } from "@/components/shell/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ItaWithOits } from "@/lib/ita/queries";

// How many OIT titles to show on a card before collapsing the rest into a count.
const OIT_PREVIEW = 3;

/**
 * ITA list, shared by /ita-list and /ita/by-year/[year] so both always look the
 * same.
 *
 * Server Component — the client parts are the year picker and the ADMIN+
 * dialogs. `canManage` only decides what is drawn; the Server Actions behind
 * those dialogs check the role for themselves.
 *
 * Opening an OIT is F15, so the OIT chips are still plain text rather than
 * links to pages that do not exist.
 */
export function ItaListView({
  year,
  years,
  itas,
  breadcrumb,
  canManage,
}: {
  year: string;
  years: string[];
  itas: ItaWithOits[];
  breadcrumb: Crumb[];
  canManage: boolean;
}) {
  return (
    <div>
      <PageHeader
        title="รายการ ITA"
        breadcrumb={breadcrumb}
        description={`หัวข้อการประเมิน ITA ประจำปี พ.ศ. ${year}`}
        actions={
          <>
            <YearSelect years={years} value={year} />
            {canManage && <ItaCreateButton year={year} />}
          </>
        }
      />

      {itas.length === 0 ? (
        <EmptyState
          icon={ListChecks}
          title={`ยังไม่มีหัวข้อในปี พ.ศ. ${year}`}
          description={
            canManage
              ? `เริ่มต้นด้วยการเพิ่มหัวข้อแรกของปี พ.ศ. ${year} หรือเลือกปีอื่นจากรายการด้านบน`
              : "เลือกปีอื่นจากรายการด้านบน เพื่อดูหัวข้อที่บันทึกไว้แล้ว"
          }
          action={canManage ? <ItaCreateButton year={year} /> : undefined}
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {itas.map((ita) => (
            <ItaCard key={ita.id} ita={ita} canManage={canManage} />
          ))}
        </div>
      )}
    </div>
  );
}

function ItaCard({ ita, canManage }: { ita: ItaWithOits; canManage: boolean }) {
  const extra = ita.oits.length - OIT_PREVIEW;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-2">
            <span className="mt-0.5 inline-flex h-7 min-w-7 shrink-0 items-center justify-center rounded-md bg-primary/10 px-1.5 font-mono text-xs font-semibold text-primary tabular-nums">
              {String(ita.order).padStart(2, "0")}
            </span>
            <div className="min-w-0">
              <CardTitle className="text-base leading-snug">{ita.title}</CardTitle>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <YearBadge year={ita.year} />
                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                  <FileText className="size-3.5" aria-hidden /> {ita.oits.length} OIT
                </span>
              </div>
            </div>
          </div>

          {canManage && (
            <ItaCardActions
              ita={{ id: ita.id, title: ita.title, year: ita.year, order: ita.order }}
            />
          )}
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        <div className="rounded-md border bg-muted/30 p-2">
          {ita.oits.length === 0 ? (
            <p className="px-1 py-1 text-xs italic text-muted-foreground">ยังไม่มี OIT ในหัวข้อนี้</p>
          ) : (
            <div className="flex flex-wrap items-center gap-1.5">
              {ita.oits.slice(0, OIT_PREVIEW).map((oit) => (
                <span
                  key={oit.id}
                  className="inline-flex max-w-[240px] items-center gap-1.5 rounded-md border bg-card px-2.5 py-1 text-xs font-medium"
                >
                  <FileText className="size-3 shrink-0 text-primary" aria-hidden />
                  <span className="truncate">{oit.title}</span>
                </span>
              ))}
              {extra > 0 && (
                <span className="px-1.5 py-1 text-xs text-muted-foreground">
                  +{extra} รายการ
                </span>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
