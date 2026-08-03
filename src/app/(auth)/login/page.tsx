import type { Metadata } from "next";
import Image from "next/image";
import { redirect } from "next/navigation";
import cmuLogo from "@/../public/cmu_logo.png";
import nurseLogo from "@/../public/nurse-th.png";
import { LoginForm } from "@/app/(auth)/login/login-form";
import { Card, CardContent } from "@/components/ui/card";
import { LOGIN_ERROR_MESSAGES, type LoginErrorCode } from "@/lib/auth/errors";
import { getSafeRedirectPath } from "@/lib/auth/roles";
import { getSessionUser } from "@/lib/auth/session";
import { withBasePath } from "@/lib/base-path";

export const metadata: Metadata = { title: "เข้าสู่ระบบ — FON-ITA" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const { error, next } = await searchParams;

  // Already signed in — no reason to show the form again. `next` is validated
  // against the role's own paths, so it cannot be used as an open redirect.
  const user = await getSessionUser();
  if (user) redirect(getSafeRedirectPath(user.role, next));

  // Only render codes we recognise; an arbitrary ?error= value must not be
  // reflected back into the page.
  const message = error ? LOGIN_ERROR_MESSAGES[error as LoginErrorCode] : undefined;

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
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
            <h1 className="text-xl font-bold tracking-tight">ระบบจัดการข้อมูลสาธารณะ</h1>
            <p className="text-sm text-muted-foreground">คณะพยาบาลศาสตร์ มหาวิทยาลัยเชียงใหม่</p>
          </div>
        </div>

        {message && (
          <p
            role="alert"
            className="rounded-md bg-destructive/10 px-3 py-2 text-center text-sm text-destructive"
          >
            {message}
          </p>
        )}

        <Card>
          <CardContent className="space-y-5 pt-6">
            {/* CMU first, and styled as the primary action: every account here
                belongs to faculty staff who already have one, and a SUPERADMIN
                normally creates their row without any password at all (D18).
                Leading with the email form asked people for a credential nobody
                had ever given them. The form stays below as the fallback the
                PRD describes — "สำรองเมื่อ OAuth ขัดข้อง".

                Route handler, not a page — a plain <a> keeps <Link> from
                prefetching and starting the OAuth redirect on hover. Built in F8. */}
            <a
              href={withBasePath("/api/auth/cmu")}
              className="inline-flex h-11 w-full items-center justify-center gap-2.5 rounded-md bg-cmu px-4 text-sm font-medium text-cmu-foreground shadow-sm transition-colors hover:bg-cmu/90"
            >
              {/* On a white disc, not straight on the purple: the seal's inner
                  field is itself purple and would sink into the button. */}
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-white">
                <Image
                  src={cmuLogo}
                  alt=""
                  width={32}
                  height={32}
                  className="size-7 object-contain"
                />
              </span>
              เข้าสู่ระบบด้วยบัญชี CMU
            </a>

            <div className="flex items-center gap-3">
              <span className="h-px flex-1 bg-border" />
              <span className="text-xs text-muted-foreground">หรือ</span>
              <span className="h-px flex-1 bg-border" />
            </div>

            <div className="space-y-3">
              <p className="text-center text-xs text-muted-foreground">
                เข้าสู่ระบบด้วยอีเมลและรหัสผ่าน — สำหรับกรณีบัญชี CMU ใช้งานไม่ได้
              </p>
              <LoginForm next={next} />
            </div>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground">
          หากเข้าใช้งานไม่ได้ โปรดติดต่อผู้ดูแลระบบ
        </p>
      </div>
    </main>
  );
}
