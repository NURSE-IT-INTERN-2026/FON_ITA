import { ExternalLink, FolderOpen } from "lucide-react";
import type { Metadata } from "next";
import { FileCopyUrlButton } from "@/components/files/file-copy-url-button";
import { FileDeleteButton } from "@/components/files/file-delete-button";
import { FileSearchInput } from "@/components/files/file-search-input";
import { FileUploadDialog } from "@/components/files/file-upload-dialog";
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
import { MAX_FILE_SIZE_BYTES, allowedExtensions } from "@/lib/files/storage";
import { fileUrl } from "@/lib/files/url";

export const metadata: Metadata = { title: "คลังไฟล์ — FON-ITA" };

type Props = { searchParams: Promise<{ page?: string; q?: string }> };

/**
 * Central file library, newest first, 15 per page (F18).
 *
 * ADMIN+ only (decisions.md D12): files exist to be attached to OIT entries, so
 * a visitor who cannot edit has no use for the library. The files themselves are
 * served publicly by /storage/itafile/[file] (F22).
 */
export default async function ItaFilePage({ searchParams }: Props) {
  const user = await requireRole("ADMIN", "SUPERADMIN");

  const { page: rawPage, q } = await searchParams;
  // Anything unparseable falls back to page 1; listFiles() clamps the rest.
  const requested = Number(rawPage);
  const search = (q ?? "").slice(0, 255);
  const { files, page, totalPages, total } = await listFiles(
    Number.isInteger(requested) && requested > 0 ? requested : 1,
    search,
  );

  // Built from the same env the Server Action validates against, so the picker
  // and the rule behind it cannot drift apart.
  const accept = allowedExtensions()
    .map((ext) => `.${ext}`)
    .join(",");
  const maxSizeMb = Math.round(MAX_FILE_SIZE_BYTES / (1024 * 1024));

  return (
    <div>
      <PageHeader
        title="คลังไฟล์"
        breadcrumb={[{ label: "หน้าแรก", href: "/" }, { label: "คลังไฟล์" }]}
        description={
          total > 0
            ? `${search ? `ผลการค้นหา “${search}” — ` : "ไฟล์ทั้งหมด "}${total} รายการ · หน้า ${page} จาก ${totalPages}`
            : "ไฟล์กลางสำหรับแนบในหัวข้อ OIT"
        }
        actions={
          <>
            <FileSearchInput defaultValue={search} />
            <FileUploadDialog accept={accept} maxSizeMb={maxSizeMb} />
          </>
        }
      />

      {files.length === 0 ? (
        <EmptyState
          icon={FolderOpen}
          title={search ? `ไม่พบไฟล์ที่ตรงกับ “${search}”` : "ยังไม่มีไฟล์ในคลัง"}
          description={
            search
              ? "ลองใช้คำค้นอื่น หรือล้างคำค้นหาเพื่อดูไฟล์ทั้งหมด"
              : "เริ่มต้นด้วยการอัปโหลดไฟล์แรก — รายการใหม่สุดจะแสดงบนสุดเสมอ"
          }
          action={search ? undefined : <FileUploadDialog accept={accept} maxSizeMb={maxSizeMb} />}
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
                  <TableHead className="w-24 text-right">จัดการ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {files.map((file) => (
                  <TableRow key={file.id}>
                    <TableCell className="font-medium">
                      {/* Route handler, not a page — a plain <a> with the
                          basePath added, since <Link> would try an RSC fetch. */}
                      <a
                        href={fileUrl(file.path)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 hover:text-primary hover:underline"
                      >
                        {file.name}
                        <ExternalLink className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                      </a>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{file.createdBy}</TableCell>
                    {/* พ.ศ. via lib/date.ts — never inline +543 */}
                    <TableCell className="tabular-nums text-muted-foreground">
                      {formatBEShort(file.createdAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end">
                        <FileCopyUrlButton url={fileUrl(file.path)} name={file.name} />
                        {/* Owner, or SUPERADMIN for anything (D5). The action
                            re-decides this — hiding the button is only UX. */}
                        {(file.userId === user.id || user.role === "SUPERADMIN") && (
                          <FileDeleteButton fileId={file.id} name={file.name} />
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <PaginationNav
            page={page}
            totalPages={totalPages}
            // The term rides along, or page 2 of a search would show everything.
            hrefFor={(n) => {
              const params = new URLSearchParams();
              if (search) params.set("q", search);
              if (n > 1) params.set("page", String(n));
              const query = params.toString();
              return query ? `/ita-file?${query}` : "/ita-file";
            }}
          />
        </>
      )}
    </div>
  );
}
