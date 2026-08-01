import { PageHeader } from "@/components/shell/page-header";
import { currentBEYear } from "@/lib/date";

// Placeholder so the shell has something to render. The real dashboard /
// public ITA browser is a later feature — see docs/rules/route-map.md.
export default function HomePage() {
  return (
    <>
      <PageHeader
        title="ระบบจัดการข้อมูลสาธารณะ"
        description={`ข้อมูลการประเมินคุณธรรมและความโปร่งใส ประจำปี พ.ศ. ${currentBEYear()}`}
      />
      <p className="text-sm text-muted-foreground">ยังไม่มีเนื้อหาในหน้านี้</p>
    </>
  );
}
