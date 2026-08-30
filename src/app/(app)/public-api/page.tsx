import type { Metadata } from "next";
import { headers } from "next/headers";
import { PageHeader } from "@/components/shell/page-header";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireRole } from "@/lib/auth/guards";
import { BASE_PATH } from "@/lib/base-path";
import { prisma } from "@/lib/prisma";
import { ResponsePreview } from "./response-preview";

export const metadata: Metadata = { title: "API สาธารณะ — FON-ITA" };

// Every row below is transcribed from src/lib/api/legacy-ita.ts and the route
// handler — the frozen contract (docs/chapters/05-public-api.md), not prose we
// invented. When a route changes, this page has to follow.
const ITA_FIELDS: Array<[name: string, type: string, note: string]> = [
  ["id", "integer", "รหัสหัวข้อ ITA"],
  ["title", "string", "ชื่อหัวข้อ"],
  ["year", "string", "ปี พ.ศ. เช่น \"2569\""],
  ["order", "string", "ลำดับการแสดงผล — เป็น string ตามระบบเดิม (สัญญาที่ freeze ไว้)"],
  ["created_at", "string", "เวลาที่สร้าง · ISO 8601 เช่น \"2026-08-27T10:00:00.000Z\""],
  ["updated_at", "string", "เวลาที่แก้ไขล่าสุด · รูปแบบเดียวกับ created_at"],
  ["oits", "array<object>", "รายการ OIT ของหัวข้อนี้ — ดูโครงสร้างด้านล่าง"],
];

const OIT_FIELDS: Array<[name: string, type: string, note: string]> = [
  ["id", "integer", "รหัสรายการ OIT"],
  ["ita_id", "string", "รหัสของหัวข้อ ITA ที่รายการนี้สังกัด — string ตามระบบเดิม"],
  ["title", "string", "ชื่อรายการ"],
  ["link", "string | null", "ลิงก์ภายนอก · ไม่มีเป็น null"],
  ["content", "string | null", "เนื้อหา HTML จากตัวแก้ไข · ไม่มีเป็น null"],
  ["created_at", "string", "เวลาที่สร้าง"],
  ["updated_at", "string", "เวลาที่แก้ไขล่าสุด"],
];

function FieldTable({ rows }: { rows: Array<[string, string, string]> }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-32 font-mono text-xs">ฟิลด์</TableHead>
          <TableHead className="w-32 font-mono text-xs">ชนิด</TableHead>
          <TableHead className="text-xs font-medium">คำอธิบาย</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map(([name, type, note]) => (
          <TableRow key={name}>
            <TableCell className="font-mono text-xs font-semibold">{name}</TableCell>
            <TableCell className="font-mono text-xs text-muted-foreground">{type}</TableCell>
            <TableCell className="text-xs">{note}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{children}</h3>;
}

/**
 * Internal API reference, Swagger-styled but hand-rolled (no Scalar / no
 * OpenAPI tooling) — SUPERADMIN only. Documents the one endpoint the outside
 * consumes; the contract itself is frozen and this page changes nothing about
 * the public surface.
 */
export default async function PublicApiPage() {
  await requireRole("SUPERADMIN");

  // Built from the actual request so examples point at the right host —
  // localhost in dev, the faculty host in production — with nothing hardcoded
  // to remember on deploy.
  const headerStore = await headers();
  const host = headerStore.get("x-forwarded-host") ?? headerStore.get("host") ?? "localhost:3000";
  const proto = headerStore.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const serverUrl = `${proto}://${host}${BASE_PATH}`;

  const defaultYear =
    (await prisma.ita.findFirst({ orderBy: { year: "desc" }, select: { year: true } }))?.year ?? "2569";

  return (
    <div className="space-y-6">
      <PageHeader
        title="API สาธารณะ"
        breadcrumb={[{ label: "หน้าแรก", href: "/" }, { label: "API สาธารณะ" }]}
        description="เอกสาร API ที่เว็บไซต์คณะดึงข้อมูลไปแสดง — เปิดเผยแบบสาธารณะ ไม่ต้องยืนยันตัวตน"
        variant="featured"
      />

      {/* Swagger-style document header */}
      <div className="overflow-hidden rounded-xl border bg-card shadow">
        <div className="flex flex-wrap items-center gap-3 border-b border-stone-200 bg-linear-to-b from-warm-surface to-warm-soft/70 px-5 py-4 dark:border-border/70 dark:from-background dark:to-accent/30">
          <span className="text-base font-bold tracking-tight text-warm-strong dark:text-warm">FON-ITA Public API</span>
          <span className="rounded-full bg-warm/15 px-2 py-0.5 text-xs font-semibold text-warm-strong dark:text-warm">v1</span>
          <span className="ml-auto break-all font-mono text-xs text-muted-foreground">{serverUrl}</span>
        </div>

        <div className="space-y-4 px-5 py-4 text-sm">
          <p className="text-muted-foreground">
            จุดเชื่อมต่อสำหรับเว็บไซต์คณะดึงข้อมูล ITA/OIT ไปแสดงผล — อ่านอย่างเดียว (GET) ·
            ไม่ต้องยืนยันตัวตน · จำกัด <span className="font-medium text-foreground">60 คำขอต่อนาที</span> ต่อ IP
            (เกินได้รับ 429) · อนุญาต CORS ทุกต้นทาง
          </p>
        </div>

        {/* The one operation block */}
        <div className="border-t px-5 py-5">
          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded bg-warm/15 px-2 py-0.5 font-mono text-xs font-bold text-warm-strong dark:bg-warm/20 dark:text-warm">
              GET
            </span>
            <code className="font-mono text-sm font-semibold">/api/v1/ita/&#123;year&#125;</code>
            <span className="text-xs text-muted-foreground">— หัวข้อ ITA พร้อมรายการ OIT ทั้งหมดของปีที่ระบุ</span>
          </div>
          <p className="mt-2 break-all rounded-md bg-muted/50 px-3 py-2 font-mono text-xs text-muted-foreground">
            {serverUrl}/api/v1/ita/2569
          </p>

          <div className="mt-6 space-y-6">
            <section className="space-y-2">
              <SectionTitle>พารามิเตอร์</SectionTitle>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-24 font-mono text-xs">ชื่อ</TableHead>
                    <TableHead className="w-24 text-xs font-medium">ตำแหน่ง</TableHead>
                    <TableHead className="w-24 font-mono text-xs">ชนิด</TableHead>
                    <TableHead className="w-20 text-xs font-medium">จำเป็น</TableHead>
                    <TableHead className="text-xs font-medium">คำอธิบาย</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell className="font-mono text-xs font-semibold">year</TableCell>
                    <TableCell className="text-xs">path</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">string</TableCell>
                    <TableCell className="text-xs">ใช่</TableCell>
                    <TableCell className="text-xs">
                      ปี พ.ศ. 4 หลัก เช่น 2569 · ปีที่ไม่ถูกต้องหรือไม่มีข้อมูล ได้รับ{" "}
                      <code className="font-mono">[]</code> พร้อมสถานะ 200 เสมอ — ไม่มี 404
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </section>

            <section className="space-y-2">
              <SectionTitle>การตอบกลับ — 200 · application/json</SectionTitle>
              <p className="text-xs text-muted-foreground">
                อาเรย์ของหัวข้อ ITA เรียงตามลำดับ (order น้อยไปมาก) — หัวข้อหนึ่งมีรายการ OIT ของตัวเองฝังอยู่ใน{" "}
                <code className="font-mono">oits</code>
              </p>
              <div className="overflow-hidden rounded-lg border">
                <FieldTable rows={ITA_FIELDS} />
              </div>

              <p className="pt-2 font-mono text-xs font-semibold text-muted-foreground">oits[] — รายการ OIT ในหัวข้อ</p>
              <div className="overflow-hidden rounded-lg border">
                <FieldTable rows={OIT_FIELDS} />
              </div>
            </section>

            <section className="space-y-2">
              <SectionTitle>ส่วนหัวของการตอบกลับ (Response Headers)</SectionTitle>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-56 font-mono text-xs">ชื่อ</TableHead>
                    <TableHead className="text-xs font-medium">คำอธิบาย</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell className="font-mono text-xs font-semibold">X-RateLimit-Limit</TableCell>
                    <TableCell className="text-xs">จำนวนคำขอสูงสุดต่อนาที (60)</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-mono text-xs font-semibold">X-RateLimit-Remaining</TableCell>
                    <TableCell className="text-xs">โควตาที่เหลือในนาทีปัจจุบัน</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
              <p className="text-xs text-muted-foreground">
                เกินโควตา → สถานะ <span className="font-medium text-foreground">429 Too Many Requests</span>{" "}
                (ยกเว้น request ที่มาจากหน้าเว็บของระบบเราเอง)
              </p>
            </section>

            <section className="space-y-2">
              <SectionTitle>ตัวอย่างการตอบกลับ (Preview)</SectionTitle>
              <p className="text-xs text-muted-foreground">
                ดึงข้อมูลจริงจาก API ตามปีที่เลือก — แสดงผลอย่างเดียว
              </p>
              <ResponsePreview defaultYear={defaultYear} />
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
