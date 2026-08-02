import { ShieldX } from "lucide-react";
import Link from "next/link";
import { StatusMessage } from "@/components/shell/status-message";
import { Button } from "@/components/ui/button";
import { FORBIDDEN_MESSAGE } from "@/lib/auth/errors";

/**
 * Rendered with HTTP 403 whenever `forbidden()` is called (F12).
 *
 * The user is signed in; their role is not allowed here. Deliberately says so
 * instead of redirecting elsewhere — silently bouncing a เจ้าหน้าที่ who clicked
 * a bookmarked SUPERADMIN page looks like a broken link.
 */
export default function Forbidden() {
  return (
    <StatusMessage
      icon={ShieldX}
      code="403"
      title={FORBIDDEN_MESSAGE}
      description="บัญชีของคุณไม่ได้รับสิทธิ์สำหรับหน้านี้ หากคิดว่าเป็นข้อผิดพลาด โปรดติดต่อผู้ดูแลระบบ"
    >
      <Button asChild variant="outline">
        <Link href="/">กลับหน้าแรก</Link>
      </Button>
    </StatusMessage>
  );
}
