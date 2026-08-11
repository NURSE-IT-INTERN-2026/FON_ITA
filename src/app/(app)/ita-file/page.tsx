import { ExternalLink, Files, HardDriveUpload, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import { FileCopyUrlButton } from "@/components/files/file-copy-url-button";
import { FileDeleteButton } from "@/components/files/file-delete-button";
import { FileSearchInput } from "@/components/files/file-search-input";
import { FileUploader } from "@/components/files/file-uploader";
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
import { fileIcon, fileTypeLabel } from "@/lib/files/display";
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

  // Built from the same env the Server Action validates against, so the uploader
  // and the rule behind it cannot drift apart.
  const accept = allowedExtensions()
    .map((ext) => `.${ext}`)
    .join(",");
  const maxSizeMb = Math.round(MAX_FILE_SIZE_BYTES / (1024 * 1024));

  return (
    <div className="space-y-6">
      <PageHeader
        title="คลังไฟล์"
        breadcrumb={[{ label: "หน้าแรก", href: "/" }, { label: "คลังไฟล์" }]}
        description="ศูนย์กลางสำหรับอัปโหลด ค้นหา และคัดลอกลิงก์ไฟล์เอกสารที่ใช้ประกอบข้อมูล ITA/OIT"
        variant="featured"
      />

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(280px,0.8fr)]">
        <FileUploader accept={accept} maxSizeMb={maxSizeMb} />

        <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1">
          <div className="rounded-3xl border border-stone-200/80 bg-white p-4 shadow-[0_24px_60px_-52px_rgba(67,36,19,0.4)] dark:border-border/80 dark:bg-card/95 dark:shadow-[0_26px_70px_-48px_rgba(0,0,0,0.72)]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#9b6a46] dark:text-primary/80">
                  ไฟล์ทั้งหมด
                </p>
                <p className="mt-2 text-3xl font-bold tracking-tight text-[#4d1646] dark:text-foreground">{total}</p>
                <p className="mt-2 text-sm text-muted-foreground">รวมไฟล์ที่พร้อมนำไปแนบในเนื้อหา OIT</p>
              </div>
              <span className="rounded-full bg-[#f7efe7] p-2 text-[#9b6a46] dark:bg-primary/15 dark:text-primary">
                <Files className="size-5" aria-hidden />
              </span>
            </div>
          </div>

          <div className="rounded-3xl border border-stone-200/80 bg-white p-4 shadow-[0_24px_60px_-52px_rgba(67,36,19,0.4)] dark:border-border/80 dark:bg-card/95 dark:shadow-[0_26px_70px_-48px_rgba(0,0,0,0.72)]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#9b6a46] dark:text-primary/80">
                  ขนาดสูงสุด
                </p>
                <p className="mt-2 text-3xl font-bold tracking-tight text-[#4d1646] dark:text-foreground">{maxSizeMb} MB</p>
                <p className="mt-2 text-sm text-muted-foreground">ตรวจทั้งฝั่งเบราว์เซอร์และฝั่งเซิร์ฟเวอร์ก่อนบันทึกไฟล์</p>
              </div>
              <span className="rounded-full bg-[#f7efe7] p-2 text-[#9b6a46] dark:bg-primary/15 dark:text-primary">
                <HardDriveUpload className="size-5" aria-hidden />
              </span>
            </div>
          </div>

          <div className="rounded-3xl border border-stone-200/80 bg-white p-4 shadow-[0_24px_60px_-52px_rgba(67,36,19,0.4)] dark:border-border/80 dark:bg-card/95 dark:shadow-[0_26px_70px_-48px_rgba(0,0,0,0.72)]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#9b6a46] dark:text-primary/80">
                  ชนิดที่รองรับ
                </p>
                <p className="mt-2 text-lg font-bold tracking-tight text-[#4d1646] dark:text-foreground">
                  {allowedExtensions().join(", ")}
                </p>
                <p className="mt-2 text-sm text-muted-foreground">คงกฎเดียวกับตัวเลือกอัปโหลดทุกหน้าของระบบ</p>
              </div>
              <span className="rounded-full bg-[#f7efe7] p-2 text-[#9b6a46] dark:bg-primary/15 dark:text-primary">
                <ShieldCheck className="size-5" aria-hidden />
              </span>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-[28px] border border-stone-200/80 bg-white p-4 shadow-[0_24px_60px_-52px_rgba(67,36,19,0.4)] dark:border-border/80 dark:bg-card/95 dark:shadow-[0_26px_70px_-48px_rgba(0,0,0,0.72)] sm:p-5">
        <div className="mb-4 flex flex-col gap-3 border-b border-stone-200 pb-4 dark:border-border/70 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold tracking-tight text-[#4d1646] dark:text-foreground">ค้นหาและจัดการไฟล์</p>
            <p className="mt-1 text-sm text-muted-foreground">
              เปิดดูไฟล์ คัดลอกลิงก์ หรือจัดการไฟล์ที่อัปโหลดไว้ในคลังกลาง
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:items-end">
            <FileSearchInput defaultValue={search} />
            <span className="text-xs text-muted-foreground">ทั้งหมด {total} รายการ</span>
          </div>
        </div>

        {files.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-stone-300 bg-[#fcfaf8] px-4 py-10 text-center text-muted-foreground dark:border-border dark:bg-accent/30">
            {search ? `ไม่พบไฟล์ที่ตรงกับ “${search}”` : "ยังไม่มีไฟล์ในคลัง"}
          </div>
        ) : (
          <>
            <div className="grid gap-3 md:hidden">
              {files.map((file) => {
                const Icon = fileIcon(file.path);
                const canDelete = file.userId === user.id || user.role === "SUPERADMIN";
                return (
                  <article
                    key={file.id}
                    className="rounded-3xl border border-stone-200/80 bg-[#fcfaf8] p-4 shadow-[0_18px_40px_-36px_rgba(67,36,19,0.45)] dark:border-border/80 dark:bg-accent/25 dark:shadow-[0_22px_52px_-40px_rgba(0,0,0,0.72)]"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <a
                        href={fileUrl(file.path)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="min-w-0 flex-1 text-left"
                      >
                        <span className="inline-flex items-center gap-2 text-sm font-semibold text-[#4d1646] hover:underline dark:text-foreground">
                          <Icon className="size-4 shrink-0 text-[#9b6a46] dark:text-primary" aria-hidden />
                          <span className="truncate">{file.name}</span>
                          <ExternalLink className="size-3 shrink-0 opacity-60" aria-hidden />
                        </span>
                      </a>
                      <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#9b6a46] ring-1 ring-stone-200 dark:bg-background/60 dark:text-primary dark:ring-border">
                        {fileTypeLabel(file.path)}
                      </span>
                    </div>

                    <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <dt className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
                          ผู้อัปโหลด
                        </dt>
                        <dd className="mt-1 text-foreground">{file.createdBy}</dd>
                      </div>
                      <div>
                        <dt className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
                          วันที่
                        </dt>
                        <dd className="mt-1 tabular-nums text-foreground">{formatBEShort(file.createdAt)}</dd>
                      </div>
                    </dl>

                    <div className="mt-4 flex flex-wrap items-center justify-end gap-2 border-t border-stone-200 pt-3 dark:border-border/70">
                      <FileCopyUrlButton url={fileUrl(file.path)} name={file.name} />
                      {canDelete && <FileDeleteButton fileId={file.id} name={file.name} />}
                    </div>
                  </article>
                );
              })}
            </div>

            <div className="hidden overflow-x-auto rounded-2xl border border-stone-200/80 bg-card/60 dark:border-border/80 dark:bg-background/35 md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ชื่อไฟล์</TableHead>
                    <TableHead className="w-24">ประเภท</TableHead>
                    <TableHead className="w-48">ผู้อัปโหลด</TableHead>
                    <TableHead className="w-32">วันที่</TableHead>
                    <TableHead className="w-32 text-right">การกระทำ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {files.map((file) => {
                    const Icon = fileIcon(file.path);
                    const canDelete = file.userId === user.id || user.role === "SUPERADMIN";
                    return (
                      <TableRow key={file.id}>
                        <TableCell>
                          {/* Route handler, not a page — a plain <a> with the
                              basePath added, since <Link> would try an RSC fetch. */}
                          <a
                            href={fileUrl(file.path)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 font-medium text-primary hover:underline"
                          >
                            <Icon className="size-4 shrink-0" aria-hidden />
                            <span className="truncate">{file.name}</span>
                            <ExternalLink className="size-3 shrink-0 opacity-60" aria-hidden />
                          </a>
                        </TableCell>
                        <TableCell className="text-xs uppercase text-muted-foreground">
                          {fileTypeLabel(file.path)}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{file.createdBy}</TableCell>
                        {/* พ.ศ. via lib/date.ts — never inline +543 */}
                        <TableCell className="text-sm tabular-nums text-muted-foreground">
                          {formatBEShort(file.createdAt)}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <FileCopyUrlButton url={fileUrl(file.path)} name={file.name} />
                            {/* Owner, or SUPERADMIN for anything (D5). The action
                                re-decides this — hiding the button is only UX. */}
                            {canDelete && <FileDeleteButton fileId={file.id} name={file.name} />}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </>
        )}

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
      </section>
    </div>
  );
}
