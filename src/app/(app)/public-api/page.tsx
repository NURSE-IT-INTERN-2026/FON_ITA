import type { Metadata } from "next";
import { headers } from "next/headers";
import { PageHeader } from "@/components/shell/page-header";
import { requireRole } from "@/lib/auth/guards";
import { BASE_PATH } from "@/lib/base-path";
import { ScalarReference } from "./scalar-reference";

export const metadata: Metadata = { title: "API สาธารณะ — FON-ITA" };

/**
 * Internal interactive reference (Scalar / OpenAPI) for the Public API —
 * SUPERADMIN only. The contract itself is frozen (docs/chapters/05-public-api.md):
 * every type and example in the document is transcribed from the real route
 * handlers, and this page changes nothing about the public surface.
 */
export default async function PublicApiPage() {
  await requireRole("SUPERADMIN");

  // Built from the actual request so "Test Request" hits the right host —
  // localhost in dev, the faculty host in production — with no host hardcode
  // to remember to update on deploy.
  const headerStore = await headers();
  const host = headerStore.get("x-forwarded-host") ?? headerStore.get("host") ?? "localhost:3000";
  const proto = headerStore.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const serverUrl = `${proto}://${host}${BASE_PATH}`;

  return (
    <div className="space-y-6">
      <PageHeader
        title="API สาธารณะ"
        breadcrumb={[{ label: "หน้าแรก", href: "/" }, { label: "API สาธารณะ" }]}
        description="เอกสาร API แบบโต้ตอบ (OpenAPI) — ดูโครงสร้างข้อมูล สถานะที่เป็นไปได้ และกดทดสอบยิง request จริงจากหน้านี้ได้ทันที"
        variant="featured"
      />

      <div className="overflow-hidden rounded-xl border bg-card text-card-foreground shadow">
        <ScalarReference serverUrl={serverUrl} />
      </div>
    </div>
  );
}
