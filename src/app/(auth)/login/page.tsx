import { ArrowLeft, ChevronDown } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
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
        {/* The seal and the system name are the first thing anyone looks at, so
            they double as the way home — the same habit as clicking a site's
            logo. The text link at the bottom stays for anyone who scrolls past. */}
        <Link
          href="/"
          title="กลับหน้าแรก"
          className="flex cursor-pointer flex-col items-center gap-3 rounded-lg px-4 py-2 text-center transition-colors hover:bg-accent/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
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
        </Link>

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

            {/* The fallback channel stays folded away: nobody should reach for
                it unless CMU OAuth is down, and an open form invites people to
                type credentials they were never given (D7). Native <details>
                keeps this a Server Component — same pattern as D22. */}
            <details className="group">
              <summary className="flex cursor-pointer list-none flex-col items-center gap-0.5 text-center text-xs text-muted-foreground hover:text-foreground [&::-webkit-details-marker]:hidden">
                เข้าสู่ระบบด้วยอีเมลและรหัสผ่าน — สำหรับกรณีบัญชี CMU ใช้งานไม่ได้
                <ChevronDown
                  className="size-3.5 shrink-0 transition-transform group-open:rotate-180"
                  aria-hidden
                />
              </summary>
              <div className="space-y-3 pt-3">
                <LoginForm next={next} />
              </div>
            </details>
          </CardContent>
        </Card>

        {/* The login page is its own full-screen `<main>` with no shell header,
            so without this there is no way back other than the browser button.
            Anyone who lands here from a staff-only link but only wanted to read
            ITA data can get to the public landing page instead of being stuck. */}
        <div className="space-y-3 text-center text-xs text-muted-foreground">
          <p>หากเข้าใช้งานไม่ได้ โปรดติดต่อผู้ดูแลระบบ</p>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 font-medium text-foreground underline-offset-4 hover:underline"
          >
            <ArrowLeft className="size-3.5" aria-hidden />
            กลับหน้าแรก
          </Link>
        </div>
      </div>
    </main>
  );
}
