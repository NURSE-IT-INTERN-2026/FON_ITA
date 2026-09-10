import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { OitForm } from "@/components/ita/oit-form";
import { YearBadge } from "@/components/ita/year-badge";
import { PageHeader } from "@/components/shell/page-header";
import { WarmSurfaceCard, WarmTitleText } from "@/components/shell/surfaces";
import { requireRole } from "@/lib/auth/guards";
import { getIta } from "@/lib/ita/queries";
import { searchFilesByName } from "@/lib/files/queries";
import { MAX_FILE_SIZE_BYTES, allowedExtensions } from "@/lib/files/storage";

export const metadata: Metadata = { title: "เพิ่ม OIT — FON-ITA" };

type Props = { params: Promise<{ itaId: string }> };

/** Add an OIT under an ITA topic. ADMIN+ only (route-map). */
export default async function CreateOitPage({ params }: Props) {
  // requireRole raises Next.js forbidden() → the 403 page from F12.
  await requireRole("ADMIN", "SUPERADMIN");

  const { itaId } = await params;
  const id = Number(itaId);
  if (!Number.isInteger(id) || id <= 0) notFound();

  const ita = await getIta(id);
  if (!ita) notFound();

  // Seeds the "แนบไฟล์" picker in the editor (F21).
  const recent = await searchFilesByName("");
  // Built from the same env the Server Action validates against, so the
  // picker's inline upload and the rule behind it cannot drift apart.
  const fileAccept = allowedExtensions()
    .map((ext) => `.${ext}`)
    .join(",");
  const fileMaxSizeMb = Math.round(MAX_FILE_SIZE_BYTES / (1024 * 1024));

  return (
    <div>
      <PageHeader
        title="เพิ่ม OIT"
        breadcrumb={[
          { label: "หน้าแรก", href: "/" },
          { label: "รายการ ITA", href: "/ita-list" },
          { label: `ปี พ.ศ. ${ita.year}`, href: `/ita/by-year/${ita.year}` },
          { label: "เพิ่ม OIT" },
        ]}
        description="เพิ่มรายการ OIT ใหม่ภายใต้หัวข้อ ITA ที่เลือก พร้อมแนบไฟล์จากคลังกลางได้ทันที"
        variant="featured"
      />

      {/* The parent is shown read-only so the editor can see what they are
          filing under without being able to reassign it here. */}
      <WarmSurfaceCard className="mb-6 flex flex-wrap items-center gap-3 bg-warm-soft/45 px-6 py-4 dark:bg-warm/10">
          <span className="text-sm text-muted-foreground">หัวข้อ ITA</span>
          <WarmTitleText className="font-medium">{ita.title}</WarmTitleText>
          <YearBadge year={ita.year} />
      </WarmSurfaceCard>

      <OitForm
        itaId={ita.id}
        year={ita.year}
        recentFiles={recent.files}
        totalFiles={recent.total}
        totalPages={recent.totalPages}
        fileAccept={fileAccept}
        fileMaxSizeMb={fileMaxSizeMb}
      />
    </div>
  );
}
