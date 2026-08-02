import { LogIn } from "lucide-react";
import Link from "next/link";
import { StatusMessage } from "@/components/shell/status-message";
import { Button } from "@/components/ui/button";

/**
 * Rendered with HTTP 401 whenever `unauthorized()` is called (F12).
 *
 * Reached when a session cookie was sent but is no longer valid — expired,
 * revoked, or from a disabled account. Someone with no cookie at all never gets
 * here: proxy.ts redirects them straight to /login.
 *
 * Raised from the (app) layout, so the shell is gone and this page carries its
 * own <main>.
 */
export default function Unauthorized() {
  return (
    <main className="flex flex-1 flex-col">
      <StatusMessage
        icon={LogIn}
        code="401"
        title="เซสชันหมดอายุ"
        description="เซสชันของคุณหมดอายุหรือถูกยกเลิกแล้ว โปรดเข้าสู่ระบบอีกครั้ง"
      >
        {/* <Link> adds the basePath itself — no /fonita here. */}
        <Button asChild>
          <Link href="/login">เข้าสู่ระบบ</Link>
        </Button>
      </StatusMessage>
    </main>
  );
}
