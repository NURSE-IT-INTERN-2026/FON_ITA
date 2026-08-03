"use client";

import { FileIcon, Upload } from "lucide-react";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { uploadFile } from "@/actions/file";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/**
 * Standalone upload panel — the always-visible uploader at the top of the file
 * library page (F19).
 *
 * Mirrors the Lovable prototype's UX: drag-and-drop zone, click-to-pick, name
 * field auto-filled from the filename. The actual write goes through the same
 * `uploadFile` Server Action the dialog version uses, so all rules (extension,
 * size, uniqueness) stay in one place.
 */
export function FileUploader({
  accept,
  maxSizeMb,
}: {
  /** e.g. ".png,.jpg,.pdf" — built from the same env list the server uses. */
  accept: string;
  /** Mirrors MAX_FILE_SIZE_BYTES so the client can pre-check before upload. */
  maxSizeMb: number;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function pickFile(f: File | null) {
    if (!f) return;
    // Pre-check client-side so Next.js does not reject the body before the
    // action runs (serverActions.bodySizeLimit). The action re-checks anyway.
    if (f.size > maxSizeMb * 1024 * 1024) {
      setError(`ไฟล์ต้องมีขนาดไม่เกิน ${maxSizeMb} MB`);
      return;
    }
    setError(null);
    setFile(f);
    // Auto-fill name from filename (without extension) if the user has not
    // typed one — matches Lovable, and means drag-drop is a one-field action.
    if (!name.trim()) {
      const dot = f.name.lastIndexOf(".");
      setName(dot > 0 ? f.name.slice(0, dot) : f.name);
    }
  }

  function submit() {
    if (!file) {
      setError("กรุณาเลือกไฟล์");
      return;
    }
    if (!name.trim()) {
      setError("กรุณากรอกชื่อไฟล์");
      return;
    }

    setError(null);
    const trimmedName = name.trim();
    const formData = new FormData();
    formData.set("name", trimmedName);
    formData.set("file", file);

    startTransition(async () => {
      try {
        const result = await uploadFile(formData);
        if (result.error) {
          setError(result.error);
          return;
        }
        toast.success(`อัปโหลด "${trimmedName}" แล้ว`);
        // Reset for the next upload.
        setName("");
        setFile(null);
        setError(null);
        if (inputRef.current) inputRef.current.value = "";
      } catch {
        setError("อัปโหลดไม่สำเร็จ โปรดลองอีกครั้ง");
      }
    });
  }

  return (
    <div className="rounded-lg border bg-card p-5">
      <h2 className="mb-3 text-lg font-semibold">อัปโหลดไฟล์ใหม่</h2>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          pickFile(e.dataTransfer.files?.[0] ?? null);
        }}
        onClick={() => inputRef.current?.click()}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center rounded-md border-2 border-dashed p-8 text-center transition-colors",
          dragOver
            ? "border-primary bg-primary/5"
            : "border-muted-foreground/25 hover:bg-muted/40",
        )}
      >
        <Upload className="mb-2 size-8 text-muted-foreground" aria-hidden />
        <p className="text-sm font-medium">ลากไฟล์มาวาง หรือคลิกเพื่อเลือกไฟล์</p>
        <p className="mt-1 text-xs text-muted-foreground">
          รองรับ {accept.replaceAll(".", "").replaceAll(",", ", ")} · สูงสุด {maxSizeMb} MB
        </p>
        {file && (
          <p className="mt-3 flex items-center gap-2 rounded-md bg-muted px-3 py-1.5 text-xs">
            <FileIcon className="size-3.5" aria-hidden /> {file.name}
          </p>
        )}
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          className="hidden"
          onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
        />
      </div>
      {/* items-end aligns to the bottom of the taller grid cell. The helper
          text used to live inside the left column, under the Input — that made
          the left cell taller than the button's, so "bottom" landed below the
          Input instead of level with it and the button sank out of line. Moving
          the helper text outside the grid keeps both cells the same height
          (label + input, and nothing else) so the alignment means what it says. */}
      <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
        <div>
          <Label htmlFor="file-name" className="mb-1.5 block text-sm">
            ชื่อไฟล์ (ไม่ซ้ำกัน) <span className="text-destructive">*</span>
          </Label>
          <Input
            id="file-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="ระบุชื่อไฟล์"
            maxLength={255}
          />
        </div>
        <Button onClick={submit} disabled={pending}>
          {pending ? "กำลังอัปโหลด…" : "อัปโหลด"}
        </Button>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">ต้องไม่ซ้ำกับไฟล์ที่มีอยู่ในคลัง</p>
      {error && (
        <p
          role="alert"
          className="mt-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {error}
        </p>
      )}
    </div>
  );
}
