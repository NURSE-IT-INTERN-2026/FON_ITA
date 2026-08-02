import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { OitForm } from "@/components/ita/oit-form";
import { YearBadge } from "@/components/ita/year-badge";
import { PageHeader } from "@/components/shell/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { requireRole } from "@/lib/auth/guards";
import { formatBELong } from "@/lib/date";
import { getOit } from "@/lib/ita/queries";

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
      />

      <Card className="mb-6 bg-muted/30">
        <CardContent className="flex flex-wrap items-center gap-3 py-4">
          <span className="text-sm text-muted-foreground">หัวข้อ ITA</span>
          <span className="font-medium">{oit.ita.title}</span>
          <YearBadge year={oit.ita.year} />
        </CardContent>
      </Card>

      <OitForm
        itaId={oit.ita.id}
        year={oit.ita.year}
        oit={{ id: oit.id, title: oit.title, link: oit.link, content: oit.content }}
      />
    </div>
  );
}
