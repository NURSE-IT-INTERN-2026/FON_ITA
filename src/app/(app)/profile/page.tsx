import type { Metadata } from "next";
import { ProfileForms } from "@/components/profile/profile-forms";
import { RoleBadge } from "@/components/misc/role-badge";
import { PageHeader } from "@/components/shell/page-header";
import { Card } from "@/components/ui/card";
import { requireRole } from "@/lib/auth/guards";
import { formatBEShort } from "@/lib/date";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = { title: "บัญชีของฉัน — FON-ITA" };

/**
 * Own account page (F25) — ADMIN+ per docs/rules/route-map.md.
 *
 * The role gate is about who has an account at all: visitors read ITA/OIT
 * without one (decisions.md D12), so there is no profile for them to open. The
 * actions behind the forms only ever touch the caller's own row, so they need
 * nothing stricter than "signed in".
 */
export default async function ProfilePage() {
  const user = await requireRole("ADMIN", "SUPERADMIN");

  // Fields the session does not carry: whether a password exists at all, and
  // when the account was created.
  const account = await prisma.user.findUnique({
    where: { id: user.id },
    select: { password: true, createdAt: true },
  });

  return (
    <div>
      <PageHeader
        title="บัญชีของฉัน"
        breadcrumb={[{ label: "หน้าแรก", href: "/" }, { label: "บัญชีของฉัน" }]}
        description="แก้ไขชื่อที่แสดงในระบบ และตั้งรหัสผ่านสำหรับเข้าสู่ระบบด้วยอีเมล"
      />

      <Card className="mb-6 max-w-2xl p-6">
        <dl className="grid gap-4 sm:grid-cols-2">
          <Detail label="อีเมล">{user.email}</Detail>
          <Detail label="บัญชี CMU">{user.cmuAccount}</Detail>
          <Detail label="บทบาท">
            <RoleBadge role={user.role} />
          </Detail>
          {/* พ.ศ. via lib/date.ts — never inline +543 */}
          <Detail label="สร้างบัญชีเมื่อ">
            {account ? formatBEShort(account.createdAt) : "—"}
          </Detail>
        </dl>
        <p className="mt-4 text-xs text-muted-foreground">
          อีเมลและบัญชี CMU แก้ไขเองไม่ได้ เพราะเป็นตัวระบุตัวตนที่ใช้เข้าสู่ระบบ
          หากต้องเปลี่ยน โปรดติดต่อผู้ดูแลสูงสุด
        </p>
      </Card>

      <ProfileForms
        prefix={user.prefix}
        firstname={user.firstname}
        lastname={user.lastname}
        hasPassword={account?.password != null}
      />
    </div>
  );
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium">{children}</dd>
    </div>
  );
}
