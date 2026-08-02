import type { Metadata } from "next";
import Image from "next/image";
import { redirect } from "next/navigation";
import nurseLogo from "@/../public/nurse-th.png";
import { LoginForm } from "@/app/(auth)/login/login-form";
import { Card, CardContent } from "@/components/ui/card";
import { LOGIN_ERROR_MESSAGES, type LoginErrorCode } from "@/lib/auth/errors";
import { getSessionUser } from "@/lib/auth/session";
import { withBasePath } from "@/lib/base-path";

export const metadata: Metadata = { title: "เข้าสู่ระบบ — FON-ITA" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  // Already signed in — no reason to show the form again.
  // TODO(F13): send them to "/ita-list" once it exists.
  if (await getSessionUser()) redirect("/");

  const { error } = await searchParams;
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
            <LoginForm />

            <div className="flex items-center gap-3">
              <span className="h-px flex-1 bg-border" />
              <span className="text-xs text-muted-foreground">หรือ</span>
              <span className="h-px flex-1 bg-border" />
            </div>

            {/* Route handler, not a page — a plain <a> keeps <Link> from
                prefetching and starting the OAuth redirect on hover. Built in F8. */}
            <a
              href={withBasePath("/api/auth/cmu")}
              className="inline-flex h-9 w-full items-center justify-center rounded-md border border-input bg-background px-4 text-sm font-medium shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              เข้าสู่ระบบด้วยบัญชี CMU
            </a>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground">
          หากเข้าใช้งานไม่ได้ โปรดติดต่อผู้ดูแลระบบ
        </p>
      </div>
    </main>
  );
}
