"use client";

import { FileText, Search } from "lucide-react";
import { useRef, useState, useTransition } from "react";
import { searchFiles } from "@/actions/file";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { PickerFile } from "@/lib/files/queries";
import { fileUrl } from "@/lib/files/url";

const DEBOUNCE_MS = 300;

/**
 * Pick a file from the library and drop a link to it into the editor (F21).
 *
 * Searching runs through the `searchFiles` Server Action, so the library is
 * never shipped to the browser — only the handful of rows that match.
 */
export function FilePickerDialog({
  open,
  onOpenChange,
  onPick,
  recentFiles,
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
}) {
  const [term, setTerm] = useState("");
  const [files, setFiles] = useState<PickerFile[]>(recentFiles);
  const [pending, startTransition] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function runSearch(value: string) {
    startTransition(async () => {
      setFiles(await searchFiles(value));
    });
  }

  /** Back to the opening state, so the next open is not the last search. */
  function reset() {
    if (timer.current) clearTimeout(timer.current);
    setTerm("");
    setFiles(recentFiles);
  }

  function onChange(value: string) {
    setTerm(value);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => runSearch(value), DEBOUNCE_MS);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>แนบไฟล์จากคลัง</DialogTitle>
          <DialogDescription>
            เลือกไฟล์เพื่อแทรกเป็นลิงก์ในเนื้อหา — ไฟล์ต้องอัปโหลดไว้ในคลังก่อน
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
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

        <div className="max-h-72 space-y-1 overflow-y-auto">
          {pending && <p className="px-1 py-2 text-sm text-muted-foreground">กำลังค้นหา…</p>}

          {!pending && files.length === 0 && (
            <p className="px-1 py-2 text-sm text-muted-foreground">
              {term ? `ไม่พบไฟล์ที่ตรงกับ “${term}”` : "ยังไม่มีไฟล์ในคลัง"}
            </p>
          )}

          {!pending &&
            files.map((file) => (
              <button
                key={file.id}
                type="button"
                onClick={() => {
                  // Reset here too: the parent closes the dialog after a pick,
                  // which Radix never reports back as an open change.
                  reset();
                  onPick({ url: fileUrl(file.path), label: file.name });
                }}
                className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm transition-colors hover:bg-accent"
              >
                <FileText className="size-4 shrink-0 text-primary" aria-hidden />
                <span className="truncate">{file.name}</span>
              </button>
            ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
