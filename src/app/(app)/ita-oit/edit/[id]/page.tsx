import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { OitForm } from "@/components/ita/oit-form";
import { YearBadge } from "@/components/ita/year-badge";
import { PageHeader } from "@/components/shell/page-header";
import { WarmSurfaceCard, WarmTitleText } from "@/components/shell/surfaces";
import { requireRole } from "@/lib/auth/guards";
import { formatBELong } from "@/lib/date";
import { getOit } from "@/lib/ita/queries";
import { searchFilesByName } from "@/lib/files/queries";
import { MAX_FILE_SIZE_BYTES, allowedExtensions } from "@/lib/files/storage";

export const metadata: Metadata = { title: "แก้ไข OIT — FON-ITA" };

type Props = { params: Promise<{ id: string }> };

/** Edit an OIT. ADMIN+ only (route-map). */
export default async function EditOitPage({ params }: Props) {
  await requireRole("ADMIN", "SUPERADMIN");

  const { id: raw } = await params;
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) notFound();

  const oit = await getOit(id);
  if (!oit) notFound();

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
        title="แก้ไข OIT"
        breadcrumb={[
          { label: "หน้าแรก", href: "/" },
          { label: "รายการ ITA", href: "/ita-list" },
          { label: `ปี พ.ศ. ${oit.ita.year}`, href: `/ita/by-year/${oit.ita.year}` },
          { label: oit.title },
        ]}
        // Buddhist era via lib/date.ts — CLAUDE.md forbids inlining +543.
        description={`แก้ไขล่าสุด ${formatBELong(oit.updatedAt)}`}
        variant="featured"
      />

      <WarmSurfaceCard className="mb-6 flex flex-wrap items-center gap-3 bg-warm-soft/45 px-6 py-4 dark:bg-warm/10">
          <span className="text-sm text-muted-foreground">หัวข้อ ITA</span>
          <WarmTitleText className="font-medium">{oit.ita.title}</WarmTitleText>
          <YearBadge year={oit.ita.year} />
      </WarmSurfaceCard>

      <OitForm
        itaId={oit.ita.id}
        year={oit.ita.year}
        oit={{ id: oit.id, title: oit.title, link: oit.link, content: oit.content }}
        recentFiles={recent.files}
        totalFiles={recent.total}
        fileAccept={fileAccept}
        fileMaxSizeMb={fileMaxSizeMb}
      />
    </div>
  );
}
