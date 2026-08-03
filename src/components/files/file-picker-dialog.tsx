"use client";

import { ArrowLeft, FileImage, Link2, Search, Upload } from "lucide-react";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { searchFiles, uploadFile } from "@/actions/file";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatBEShort } from "@/lib/date";
import { fileIcon } from "@/lib/files/display";
import type { PickerFile } from "@/lib/files/queries";
import { fileUrl } from "@/lib/files/url";
import { cn } from "@/lib/utils";

/**
 * Pick a file from the library and insert a link to it into the editor (F21).
 *
 * Two-step flow like Lovable:
 *   1. List (with inline uploader + search) — pick a file
 *   2. Edit the link's label before inserting
 *
 * Searching runs through the `searchFiles` Server Action, so the library is
 * never shipped to the browser — only the handful of rows that match.
 *
 * The inline uploader shares the `uploadFile` Server Action with the library
 * page, so all rules (extension, size, uniqueness) stay in one place. On
 * success the new row is prepended to the list so it can be picked immediately.
 */

const DEBOUNCE_MS = 300;

export function FilePickerDialog({
  open,
  onOpenChange,
  onPick,
  recentFiles,
  totalFiles,
  accept,
  maxSizeMb,
  defaultLabel,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPick: (file: { url: string; label: string }) => void;
  /**
   * Most recent files, fetched on the server with the page.
   *
   * Passed in rather than fetched when the dialog opens: Radix only calls
   * `onOpenChange` for changes it initiates, and the toolbar opens this one
   * through the parent's state, so there is no reliable open event to hang a
   * fetch on without reaching for an effect. It also means the picker shows
   * something the instant it opens.
   */
  recentFiles: PickerFile[];
  /** Matches behind `recentFiles` — the list is capped at PICKER_LIMIT. */
  totalFiles: number;
  /** e.g. ".png,.jpg,.pdf" — built from the same env list the server uses. */
  accept: string;
  /** Mirrors MAX_FILE_SIZE_BYTES so the client can pre-check before upload. */
  maxSizeMb: number;
  /** Editor selection text — pre-fills the label so staff don't retype it. */
  defaultLabel?: string;
}) {
  const [term, setTerm] = useState("");
  const [files, setFiles] = useState<PickerFile[]>(recentFiles);
  // How many matched in total, not how many are on screen.
  const [total, setTotal] = useState(totalFiles);
  const [selected, setSelected] = useState<PickerFile | null>(null);
  const [label, setLabel] = useState("");
  const [searchPending, startSearchTransition] = useTransition();
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadPending, startUploadTransition] = useTransition();
  // Inline-upload form state. Same shape as FileUploader, but trimmed to fit
  // inside a dialog.
  const [uploadName, setUploadName] = useState("");
  const [uploadFileObj, setUploadFileObj] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function runSearch(value: string) {
    startSearchTransition(async () => {
      const result = await searchFiles(value);
      setFiles(result.files);
      setTotal(result.total);
    });
  }

  /** Reset to opening state, so the next open is not the last search/upload. */
  function reset() {
    if (timer.current) clearTimeout(timer.current);
    setTerm("");
    setFiles(recentFiles);
    setTotal(totalFiles);
    setSelected(null);
    setLabel("");
    setUploadError(null);
    setUploadName("");
    setUploadFileObj(null);
    setDragOver(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function onChange(value: string) {
    setTerm(value);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => runSearch(value), DEBOUNCE_MS);
  }

  function pickFile(file: PickerFile) {
    setSelected(file);
    // Pre-fill with the editor selection if we have one, otherwise the file's
    // display name — matching Lovable's default behaviour.
    setLabel(defaultLabel?.trim() || file.name);
  }

  function confirm() {
    if (!selected) return;
    const finalLabel = label.trim() || selected.name;
    onPick({ url: fileUrl(selected.path), label: finalLabel });
    reset();
    onOpenChange(false);
  }

  function handleUploadPick(f: File | null) {
    if (!f) return;
    if (f.size > maxSizeMb * 1024 * 1024) {
      setUploadError(`ไฟล์ต้องมีขนาดไม่เกิน ${maxSizeMb} MB`);
      return;
    }
    setUploadError(null);
    setUploadFileObj(f);
    if (!uploadName.trim()) {
      const dot = f.name.lastIndexOf(".");
      setUploadName(dot > 0 ? f.name.slice(0, dot) : f.name);
    }
  }

  function submitUpload(event: React.FormEvent<HTMLFormElement>) {
    // onSubmit, not `action=`: React 19 resets an action form as soon as the
    // handler returns, which would clear the <input type="file"> while the
    // `uploadFileObj` chip still showed a filename — the next click would then
    // submit with no file at all.
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const file = formData.get("file");
    if (file instanceof File && file.size > maxSizeMb * 1024 * 1024) {
      setUploadError(`ไฟล์ต้องมีขนาดไม่เกิน ${maxSizeMb} MB`);
      return;
    }

    startUploadTransition(async () => {
      try {
        const result = await uploadFile(formData);
        if (result.error) {
          setUploadError(result.error);
          return;
        }
        setUploadError(null);
        if (result.file) {
          toast.success(`อัปโหลด "${result.file.name}" แล้ว`);
          // Prepend so the new file is the top hit and can be picked in one click.
          setFiles((prev) => [result.file!, ...prev.filter((f) => f.id !== result.file!.id)]);
          // Reset the inline form, keep the picker on the list step.
          setUploadName("");
          setUploadFileObj(null);
          if (fileInputRef.current) fileInputRef.current.value = "";
        }
      } catch {
        setUploadError("อัปโหลดไม่สำเร็จ โปรดลองอีกครั้ง");
      }
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent className="flex max-h-[85vh] max-w-2xl flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle>{selected ? "ตั้งชื่อลิงก์" : "เลือกไฟล์แนบ"}</DialogTitle>
          {!selected && (
            <DialogDescription>
              อัปโหลดไฟล์ใหม่ หรือเลือกจากคลังเพื่อแทรกเป็นลิงก์ในเนื้อหา
            </DialogDescription>
          )}
        </DialogHeader>

        {selected ? (
          // ── Step 2: edit label ───────────────────────────────────────
          <div className="flex-1 overflow-y-auto px-1">
            <button
              type="button"
              onClick={() => {
                setSelected(null);
                setLabel("");
              }}
              className="mb-3 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="size-3.5" aria-hidden />
              กลับไปเลือกไฟล์อื่น
            </button>

            <div className="mb-4 flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-2">
              {(() => {
                const Icon = fileIcon(selected.path);
                return <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />;
              })()}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{selected.name}</p>
                <p className="text-xs text-muted-foreground">
                  {formatBEShort(selected.createdAt)}
                  {selected.createdBy ? ` · ${selected.createdBy}` : ""}
                </p>
              </div>
            </div>

            <Label htmlFor="picker-link-label" className="mb-1.5 block text-sm">
              ข้อความลิงก์ <span className="text-destructive">*</span>
            </Label>
            <Input
              id="picker-link-label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="ข้อความที่จะแสดงเป็นลิงก์"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  confirm();
                }
              }}
            />
            <p className="mt-1.5 text-xs text-muted-foreground">
              ข้อความนี้จะเป็น label ของลิงก์ในเนื้อหา ถ้าปล่อยว่างจะใช้ชื่อไฟล์
            </p>
          </div>
        ) : (
          // ── Step 1: upload + list ────────────────────────────────────
          <div className="flex-1 overflow-y-auto px-1">
            <div className="relative mb-2">
              <Search
                className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <Input
                value={term}
                onChange={(e) => onChange(e.target.value)}
                placeholder="ค้นหาชื่อไฟล์"
                aria-label="ค้นหาชื่อไฟล์ในคลัง"
                className="pl-8"
                autoFocus
              />
            </div>

            <div className="max-h-64 overflow-y-auto rounded-md border">
              {searchPending && files.length === 0 ? (
                <p className="px-3 py-6 text-center text-sm text-muted-foreground">กำลังค้นหา…</p>
              ) : files.length === 0 ? (
                <div className="flex flex-col items-center gap-1 py-8 text-center text-sm text-muted-foreground">
                  {term ? <>ไม่พบไฟล์ที่ตรงกับ “{term}”</> : <>ยังไม่มีไฟล์ — อัปโหลดไฟล์ใหม่ด้านล่าง</>}
                </div>
              ) : (
                <ul className="divide-y">
                  {files.map((file) => {
                    const Icon = fileIcon(file.path);
                    return (
                      <li key={file.id}>
                        <button
                          type="button"
                          onClick={() => pickFile(file)}
                          className="flex w-full items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-accent"
                        >
                          <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">{file.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {formatBEShort(file.createdAt)}
                              {file.createdBy ? ` · ${file.createdBy}` : ""}
                            </p>
                          </div>
                          <Link2 className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            {/* The list is capped server-side. Saying so is the difference
                between "there are only these" and "there are more" — a search
                for a common word matches most of the library, and without this
                line the reader concludes the file is missing and uploads it
                again, which the unique name constraint then refuses. */}
            {total > files.length && (
              <p className="mt-1.5 text-center text-xs text-muted-foreground">
                แสดง {files.length} จาก {total} รายการ — พิมพ์ให้เจาะจงขึ้นเพื่อดูรายการที่เหลือ
              </p>
            )}

            {/* Inline uploader. Drag-drop + click-to-pick like the standalone
                panel on the library page, just tighter padding for the dialog. */}
            {/* Uploading is the fallback, so it sits after the list: you only
                know a file is missing once you have looked for it. It used to be
                first, which put its "ชื่อไฟล์ที่จะแสดง" box above the search box
                and made it the one people typed their search into. */}
            <form onSubmit={submitUpload} className="mt-4 space-y-3 border-t pt-4">
              <p className="text-xs font-medium text-muted-foreground">
                ไม่มีไฟล์ที่ต้องการ? อัปโหลดไฟล์ใหม่
              </p>
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(false);
                  handleUploadPick(e.dataTransfer.files?.[0] ?? null);
                }}
                onClick={() => fileInputRef.current?.click()}
                className={cn(
                  "flex cursor-pointer flex-col items-center justify-center rounded-md border-2 border-dashed p-5 text-center transition-colors",
                  dragOver
                    ? "border-primary bg-primary/5"
                    : "border-muted-foreground/25 hover:bg-muted/40",
                )}
              >
                <Upload className="mb-1.5 size-6 text-muted-foreground" aria-hidden />
                <p className="text-xs font-medium">ลากไฟล์มาวาง หรือคลิกเพื่อเลือกไฟล์</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  {accept.replaceAll(".", "").replaceAll(",", ", ")} · สูงสุด {maxSizeMb} MB
                </p>
                {uploadFileObj && (
                  <p className="mt-2 flex items-center gap-1.5 rounded bg-muted px-2 py-1 text-[11px]">
                    <FileImage className="size-3" aria-hidden /> {uploadFileObj.name}
                  </p>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={accept}
                  className="hidden"
                  onChange={(e) => handleUploadPick(e.target.files?.[0] ?? null)}
                  name="file"
                />
              </div>

              <div className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end">
                <div>
                  <Label htmlFor="picker-upload-name" className="mb-1 block text-xs">
                    ชื่อไฟล์ที่จะแสดง <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="picker-upload-name"
                    name="name"
                    value={uploadName}
                    onChange={(e) => setUploadName(e.target.value)}
                    placeholder="เช่น รายงานผลการดำเนินงาน 2569"
                    maxLength={255}
                    required
                  />
                </div>
                <Button type="submit" disabled={uploadPending} className="w-full sm:w-auto">
                  {uploadPending ? "กำลังอัปโหลด…" : "อัปโหลด"}
                </Button>
              </div>

              {uploadError && (
                <p
                  role="alert"
                  className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
                >
                  {uploadError}
                </p>
              )}
            </form>
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            ยกเลิก
          </Button>
          {selected && (
            <Button type="button" onClick={confirm} disabled={!label.trim()}>
              แนบลิงก์
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
