import { FileQuestion } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { StatusMessage } from "@/components/shell/status-message";
import { Button } from "@/components/ui/button";

/**
 * หน้า 404 (F31)
 *
 * Without this file Next.js serves its own built-in page, which reads
 * "This page could not be found." — the one English screen left in a system
 * whose UI is entirely Thai, and not a rare one: `notFound()` is raised from
 * seven places (an OIT id that does not exist, a malformed year, …).
 */
export const metadata: Metadata = { title: "ไม่พบหน้า — FON-ITA" };

export default function NotFound() {
  return (
    <StatusMessage
      icon={FileQuestion}
      code="404"
      title="ไม่พบหน้าที่คุณเรียก"
      description="หน้านี้อาจถูกลบไปแล้ว หรือที่อยู่เว็บอาจพิมพ์ไม่ถูกต้อง"
    >
      {/* Only the landing page: 404 is reachable signed out, and "/ita-list" is
          ADMIN+ (decisions.md D12 amendment) — offering it here would answer a
          missing page with a login redirect. Reading ITA lives on "/" anyway. */}
      <Button asChild>
        <Link href="/">กลับหน้าแรก</Link>
      </Button>
    </StatusMessage>
  );
}
