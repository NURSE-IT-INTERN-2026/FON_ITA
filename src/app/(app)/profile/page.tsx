import type { Metadata } from "next";
import { ProfileForms } from "@/components/profile/profile-forms";
import { PageHeader } from "@/components/shell/page-header";
import { requireRole } from "@/lib/auth/guards";
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

  // Whether a password exists at all decides the second tab's label and the
  // "current password" field — a CMU-only account is setting its first one.
  const account = await prisma.user.findUnique({
    where: { id: user.id },
    select: { password: true },
  });

  return (
    <div>
      <PageHeader
        title="บัญชีของฉัน"
        breadcrumb={[{ label: "หน้าแรก", href: "/" }, { label: "บัญชีของฉัน" }]}
        description="ตรวจสอบข้อมูลส่วนตัวและจัดการรหัสผ่านของบัญชีที่ใช้เข้าสู่ระบบ"
        variant="featured"
      />

      <ProfileForms
        prefix={user.prefix}
        firstname={user.firstname}
        lastname={user.lastname}
        hasPassword={account?.password != null}
      />
    </div>
  );
}
