import { ExternalLink, Pencil } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { OitDeleteButton } from "@/components/ita/oit-delete-button";
import { YearBadge } from "@/components/ita/year-badge";
import { PageHeader } from "@/components/shell/page-header";
import { WarmSurfaceCard, WarmTitleText } from "@/components/shell/surfaces";
import { Button } from "@/components/ui/button";
import { hasRole } from "@/lib/auth/roles";
import { getSessionUser } from "@/lib/auth/session";
import { formatBELong } from "@/lib/date";
import { getOit } from "@/lib/ita/queries";
import { sanitizeHtml } from "@/lib/sanitize";

type Props = { params: Promise<{ id: string }> };

function parseId(raw: string): number {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : 0;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const oit = parseId(id) ? await getOit(parseId(id)) : null;
  return { title: oit ? `${oit.title} — FON-ITA` : "ไม่พบหน้า — FON-ITA" };
}

/**
 * OIT detail — public (decisions.md D12). The old Laravel page was empty; this
 * one actually shows the content (route-map).
 */
export default async function OitDetailPage({ params }: Props) {
  const user = await getSessionUser();

  const { id: raw } = await params;
  const id = parseId(raw);
  if (!id) notFound();

  const oit = await getOit(id);
  if (!oit) notFound();

  const canManage = hasRole(user, "ADMIN", "SUPERADMIN");
  // Sanitised on save AND again here (decisions.md D3): rows written before a
  // rule changed — or by any future import path — are cleaned before rendering.
  const content = sanitizeHtml(oit.content);

  return (
    <div>
      <PageHeader
        title={oit.title}
        // This page stays public, but "/ita-list" is ADMIN+ (decisions.md D12
        // amendment) — a visitor following that crumb would hit the login page,
        // so they get the trail they can actually walk.
        breadcrumb={[
          { label: "หน้าแรก", href: "/" },
          ...(canManage ? [{ label: "รายการ ITA", href: "/ita-list" }] : []),
          { label: oit.title },
        ]}
        actions={
          canManage ? (
            <>
              <Button asChild>
                <Link href={`/ita-oit/edit/${oit.id}`}>
                  <Pencil className="mr-1 size-4" aria-hidden /> แก้ไข
                </Link>
              </Button>
              <OitDeleteButton oitId={oit.id} title={oit.title} year={oit.ita.year} />
            </>
          ) : undefined
        }
        variant="featured"
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <YearBadge year={oit.ita.year} />
        <span className="text-sm text-muted-foreground">
          แก้ไขล่าสุด: {formatBELong(oit.updatedAt)}
        </span>
        {oit.link && (
          <Button asChild variant="secondary" size="sm">
            <a href={oit.link} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="mr-1 size-4" aria-hidden /> เปิดลิงก์ภายนอก
            </a>
          </Button>
        )}
      </div>

      <WarmSurfaceCard className="p-6">
          {content ? (
            <div className="prose-oit" dangerouslySetInnerHTML={{ __html: content }} />
          ) : (
            <p className="text-sm italic text-muted-foreground">
              <WarmTitleText>
              {canManage
                ? "ยังไม่มีเนื้อหา — กด “แก้ไข” เพื่อเพิ่มเนื้อหาของ OIT นี้"
                : "ยังไม่มีเนื้อหาสำหรับ OIT นี้"}
              </WarmTitleText>
            </p>
          )}
      </WarmSurfaceCard>
    </div>
  );
}
