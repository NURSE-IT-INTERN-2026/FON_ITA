import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/shell/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireRole } from "@/lib/auth/guards";

export const metadata: Metadata = { title: "API ขาออก — FON-ITA" };

/**
 * Internal reference for ADMIN+ showing what the Public API exposes — endpoints,
 * rate limit, JSON shape. The contract itself is frozen (docs/chapters/05-public-api.md)
 * and this page is documentation only: nothing here is part of the public surface.
 */
export default async function PublicApiPage() {
  await requireRole("ADMIN", "SUPERADMIN");

  return (
    <div>
      <PageHeader
        title="API ขาออก"
        breadcrumb={[{ label: "หน้าแรก", href: "/" }, { label: "API ขาออก" }]}
        description=""
      />

      <div className="space-y-4 max-w-3xl">
        <Card>
          <CardHeader>
            <CardTitle>Endpoint สำหรับหน้าเว็บหลัก</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p>
              เว็บหลักของคณะดึงข้อมูล ITA และคลิป YouTube ล่าสุดผ่าน endpoint เหล่านี้ โดยเรียกภายใต้ basePath <code className="rounded bg-muted px-1 py-0.5">/fonita</code>
            </p>
            <ul className="space-y-1.5">
              <li>
                <code className="rounded bg-muted px-1 py-0.5">GET /api/v1/ita/&#123;year&#125;</code>
                <span className="ml-2 text-muted-foreground">— หัวข้อ ITA ของปีนั้นพร้อมรายการ OIT ใต้แต่ละหัวข้อ</span>
              </li>
              <li>
                <code className="rounded bg-muted px-1 py-0.5">GET /api/nurse/youtube-feed</code>
                <span className="ml-2 text-muted-foreground">— คลิป YouTube ล่าสุด 2 คลิปของช่องคณะ</span>
              </li>
            </ul>
            <p className="text-xs text-muted-foreground">
              ตัวอย่าง URL เต็มที่ consumer เรียก:{" "}
              <code className="rounded bg-muted px-1 py-0.5">
                https://service.nurse.cmu.ac.th/fonita/api/v1/ita/2569
              </code>
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>การเข้าถึงและ Rate Limit</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <ul className="ml-4 list-disc space-y-1.5">
              <li>
                <span className="font-medium">Public — ไม่ต้องล็อกอินหรือใช้ token</span>
                <span className="text-muted-foreground"> เพราะ consumer คือเซิร์ฟเวอร์ของเว็บคณะ ไม่ใช่ผู้ใช้ปลายทาง</span>
              </li>
              <li>
                <span className="font-medium">จำกัดอัตราการเรียก 60 ครั้ง/นาที</span>
                <span className="text-muted-foreground"> — รับช่วงจากระบบ Laravel เดิมที่ใช้ <code className="rounded bg-muted px-1">throttle:60,1</code> ส่ง header <code className="rounded bg-muted px-1">X-RateLimit-Limit: 60</code> และ <code className="rounded bg-muted px-1">X-RateLimit-Remaining</code></span>
              </li>
              <li>
                <span className="text-muted-foreground">นับ throttle รวมกันทั้งสอง endpoint — เกินโควตาจะคืน </span>
                <code className="rounded bg-muted px-1">429</code>
                <span className="text-muted-foreground"> พร้อม <code className="rounded bg-muted px-1">Retry-After</code></span>
              </li>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>รูปแบบข้อมูลตามสเปก</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p>
              ข้อมูลต้องคง <span className="font-medium">format ตาม spec.md และ Public API spec</span> โดยคืน <span className="font-medium">JSON array ที่ระดับบนสุด</span> ไม่ห่อใน object และแต่ละ ITA มี <code className="rounded bg-muted px-1 py-0.5">id, title, year, order, created_at, updated_at</code> และ <code className="rounded bg-muted px-1 py-0.5">oits</code>
            </p>
            <pre className="overflow-x-auto rounded-md bg-muted p-3 text-xs leading-relaxed"><code>{`[
  {
    "id": 38,
    "title": "ข้อมูลพื้นฐาน",
    "year": "2568",
    "order": "24",
    "created_at": "2025-03-13T02:51:21.000000Z",
    "updated_at": "2025-03-13T02:52:43.000000Z",
    "oits": [
      {
        "id": 84,
        "ita_id": "38",
        "title": "O1 - โครงสร้างและอำนาจหน้าที่",
        "link": null,
        "content": "<ul>…</ul>",
        "created_at": "2025-03-13T02:53:05.000000Z",
        "updated_at": "2025-04-30T10:07:45.000000Z"
      }
    ]
  }
]`}</code></pre>
            <p className="text-xs text-muted-foreground">
              ชื่อฟิลด์ทั้งหมดเป็น snake_case และชนิดข้อมูลบางฟิลด์เป็น string ที่ดูเหมือนจะเป็น number (<code className="rounded bg-muted px-1">order</code>, <code className="rounded bg-muted px-1">ita_id</code>) — คงตามระบบเดิมทุกประการ ห้ามเปลี่ยนแปลง
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>เอกสารอ้างอิง</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            <ul className="ml-4 list-disc space-y-1">
              <li>
                <Link
                  href="/docs/specs/spec.md"
                  target="_blank"
                  className="text-primary hover:underline"
                >
                  docs/specs/spec.md
                </Link>
                <span className="text-muted-foreground"> — ภาพรวมความต้องการและเงื่อนไขของระบบ</span>
              </li>
              <li>
                <Link
                  href="/docs/chapters/05-public-api.md"
                  target="_blank"
                  className="text-primary hover:underline"
                >
                  docs/chapters/05-public-api.md
                </Link>
                <span className="text-muted-foreground"> — สัญญาแช่แข็ง รายละเอียดครบทุก field</span>
              </li>
              <li>
                <Link
                  href="/docs/others/knowledge/api-explained.html"
                  target="_blank"
                  className="text-primary hover:underline"
                >
                  others/knowledge/api-explained.html
                </Link>
                <span className="text-muted-foreground"> — คำอธิบายเชิงระบบ สำหรับเจ้าหน้าที่</span>
              </li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
