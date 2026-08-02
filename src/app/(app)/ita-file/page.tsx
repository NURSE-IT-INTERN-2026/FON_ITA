import { FolderOpen } from "lucide-react";
import type { Metadata } from "next";
import { EmptyState } from "@/components/misc/empty-state";
import { PaginationNav } from "@/components/misc/pagination-nav";
import { PageHeader } from "@/components/shell/page-header";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { requireRole } from "@/lib/auth/guards";
import { formatBEShort } from "@/lib/date";
import { listFiles } from "@/lib/files/queries";

export const metadata: Metadata = { title: "คลังไฟล์ — FON-ITA" };

type Props = { searchParams: Promise<{ page?: string }> };

/**
 * Central file library, newest first, 15 per page (F18).
 *
 * ADMIN+ only (decisions.md D12): files exist to be attached to OIT entries, so
 * a visitor who cannot edit has no use for the library. The files themselves are
 * served publicly by /storage/itafile/[file] (F22).
 */
export default async function ItaFilePage({ searchParams }: Props) {
  await requireRole("ADMIN", "SUPERADMIN");

  const { page: rawPage } = await searchParams;
  // Anything unparseable falls back to page 1; listFiles() clamps the rest.
  const requested = Number(rawPage);
  const { files, page, totalPages, total } = await listFiles(
    Number.isInteger(requested) && requested > 0 ? requested : 1,
  );

  return (
    <div>
      <PageHeader
        title="คลังไฟล์"
        breadcrumb={[{ label: "หน้าแรก", href: "/" }, { label: "คลังไฟล์" }]}
        description={
          total > 0
            ? `ไฟล์ทั้งหมด ${total} รายการ · หน้า ${page} จาก ${totalPages}`
            : "ไฟล์กลางสำหรับแนบในหัวข้อ OIT"
        }
      />

      {files.length === 0 ? (
        <EmptyState
          icon={FolderOpen}
          title="ยังไม่มีไฟล์ในคลัง"
          description="ไฟล์ที่อัปโหลดไว้จะแสดงที่นี่ เรียงจากรายการใหม่สุด"
        />
      ) : (
        <>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ชื่อไฟล์</TableHead>
                  <TableHead className="w-48">ผู้อัปโหลด</TableHead>
                  <TableHead className="w-36">วันที่อัปโหลด</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {files.map((file) => (
                  <TableRow key={file.id}>
                    <TableCell className="font-medium">{file.name}</TableCell>
                    <TableCell className="text-muted-foreground">{file.createdBy}</TableCell>
                    {/* พ.ศ. via lib/date.ts — never inline +543 */}
                    <TableCell className="tabular-nums text-muted-foreground">
                      {formatBEShort(file.createdAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <PaginationNav
            page={page}
            totalPages={totalPages}
            hrefFor={(n) => (n === 1 ? "/ita-file" : `/ita-file?page=${n}`)}
          />
        </>
      )}
    </div>
  );
}
