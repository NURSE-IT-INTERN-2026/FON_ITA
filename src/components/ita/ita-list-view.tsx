import { ListChecks } from "lucide-react";
import { ItaCreateButton } from "@/components/ita/ita-manage";
import { ItaSortableList } from "@/components/ita/ita-sortable-list";
import { YearSelect } from "@/components/ita/year-select";
import { EmptyState } from "@/components/misc/empty-state";
import { PageHeader, type Crumb } from "@/components/shell/page-header";
import type { ItaWithOits } from "@/lib/ita/queries";

/**
 * ITA list, shared by /ita-list and /ita/by-year/[year] so both always look
 * the same.
 *
 * Server Component — the client parts are the year picker, the ADMIN+ dialogs
 * (`ItaCreateButton` / `ItaCardActions`), and the drag-and-drop reorder
 * (`ItaSortableList`). `canManage` only decides what is drawn; the Server
 * Actions behind those dialogs check the role for themselves.
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
        <ItaSortableList itas={itas} canManage={canManage} />
      )}
    </div>
  );
}
