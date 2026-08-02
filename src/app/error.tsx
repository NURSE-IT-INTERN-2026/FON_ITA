"use client";

import { TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";
import { StatusMessage } from "@/components/shell/status-message";
import { Button } from "@/components/ui/button";

/**
 * หน้าแสดงข้อผิดพลาดที่ไม่ได้ดักไว้ (F31)
 *
 * Must be a Client Component — that is how React error boundaries work, and
 * `reset()` re-renders the segment so a transient failure (a dropped database
 * connection, say) can be retried without a full reload.
 *
 * `error.message` is deliberately NOT shown. In production Next.js replaces it
 * with a digest anyway, and a raw message can carry a query or a path that the
 * visitor has no business reading.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // The server log is where the real detail lives; this covers errors thrown
    // while rendering on the client.
    console.error("[error]", error);
  }, [error]);

  return (
    <StatusMessage
      icon={TriangleAlert}
      code={error.digest ? `ข้อผิดพลาด · ${error.digest}` : "ข้อผิดพลาด"}
      title="ระบบขัดข้องชั่วคราว"
      description="ลองใหม่อีกครั้ง หากยังไม่ได้ โปรดแจ้งผู้ดูแลระบบพร้อมรหัสข้อผิดพลาดด้านบน"
    >
      <Button onClick={reset}>ลองใหม่อีกครั้ง</Button>
      <Button asChild variant="outline">
        <Link href="/">กลับหน้าแรก</Link>
      </Button>
    </StatusMessage>
  );
}
