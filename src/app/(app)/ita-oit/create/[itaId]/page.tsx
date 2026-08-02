import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { OitForm } from "@/components/ita/oit-form";
import { YearBadge } from "@/components/ita/year-badge";
import { PageHeader } from "@/components/shell/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { requireRole } from "@/lib/auth/guards";
import { getIta } from "@/lib/ita/queries";

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
      />

      {/* The parent is shown read-only so the editor can see what they are
          filing under without being able to reassign it here. */}
      <Card className="mb-6 bg-muted/30">
        <CardContent className="flex flex-wrap items-center gap-3 py-4">
          <span className="text-sm text-muted-foreground">หัวข้อ ITA</span>
          <span className="font-medium">{ita.title}</span>
          <YearBadge year={ita.year} />
        </CardContent>
      </Card>

      <OitForm itaId={ita.id} year={ita.year} />
    </div>
  );
}
