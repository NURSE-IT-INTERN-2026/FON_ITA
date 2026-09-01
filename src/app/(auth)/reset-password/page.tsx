import type { Metadata } from "next";
import Image from "next/image";
import { redirect } from "next/navigation";
import nurseLogo from "@/../public/nurse-th.png";
import { ResetPasswordForm } from "@/app/(auth)/reset-password/reset-password-form";
import { Card, CardContent } from "@/components/ui/card";
import { needsPasswordReset, requireSession } from "@/lib/auth/guards";
import { ROLE_HOME } from "@/lib/auth/roles";
import { withBasePath } from "@/lib/base-path";

export const metadata: Metadata = { title: "ตั้งรหัสผ่านใหม่ — FON-ITA" };

/**
 * The forced password reset (F34).
 *
 * Outside `(app)` on purpose: it shares the login page's bare layout, with no
 * sidebar or header, because none of the navigation behind them is reachable
 * yet. It is also the one signed-in page that `requireUser()` must not guard —
 * that guard is what sends people here.
 */
export default async function ResetPasswordPage() {
  const user = await requireSession();

  // Nothing to reset. Reaching this by hand is harmless, but leaving the form up
  // would invite someone to change a password they never had to.
  if (!needsPasswordReset(user)) redirect(ROLE_HOME[user.role]);

  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <Image
            src={nurseLogo}
            alt="ตราสัญลักษณ์คณะพยาบาลศาสตร์ มหาวิทยาลัยเชียงใหม่"
            width={72}
            height={72}
            priority
            className="size-16 object-contain"
          />
          <div>
            <h1 className="text-xl font-bold tracking-tight">ตั้งรหัสผ่านใหม่</h1>
            <p className="text-sm text-muted-foreground">
              {user.prefix ?? ""}
              {user.firstname} {user.lastname}
            </p>
          </div>
        </div>

        <p className="rounded-md bg-muted px-3 py-2 text-center text-sm text-muted-foreground">
          บัญชีนี้ใช้รหัสผ่านชั่วคราวอยู่ โปรดตั้งรหัสผ่านใหม่ของคุณเองก่อนใช้งานระบบ
        </p>

        <Card>
          <CardContent className="pt-6">
            <ResetPasswordForm />
          </CardContent>
        </Card>

        {/* The way out for someone who opened this on a machine that is not
            theirs, or who wants to come back later. Without it the only escape
            from a flagged session is clearing cookies by hand. */}
        <div className="text-center text-xs text-muted-foreground">
          <span>ไม่ใช่บัญชีของคุณ? </span>
          <form action={withBasePath("/api/auth/logout")} method="post" className="inline">
            <button type="submit" className="underline underline-offset-4">
              ออกจากระบบ
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
