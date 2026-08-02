"use client";

import { Upload } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { uploadFile } from "@/actions/file";
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

/**
 * Upload dialog for the file library (F19).
 *
 * `accept` and the size hint are convenience only — `uploadFile()` checks the
 * extension, the MIME type and the size again on the server, where it counts.
 */
export function FileUploadDialog({
  accept,
  maxSizeMb,
}: {
  /** e.g. ".png,.jpg,.pdf" — built from the same env list the server uses */
  accept: string;
  maxSizeMb: number;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(formData: FormData) {
    const file = formData.get("file");

    // Checked here as well as on the server because Next.js rejects a request
    // body over `serverActions.bodySizeLimit` before the action runs — the user
    // would get a bare failure instead of being told the file is too big.
    if (file instanceof File && file.size > maxSizeMb * 1024 * 1024) {
      setError(`ไฟล์ต้องมีขนาดไม่เกิน ${maxSizeMb} MB`);
      return;
    }

    startTransition(async () => {
      try {
        const result = await uploadFile(formData);
        if (result.error) {
          setError(result.error);
          return;
        }
        setError(null);
        setOpen(false);
        toast.success("อัปโหลดไฟล์แล้ว");
      } catch {
        // Network failure, or a body the server refused outright.
        setError("อัปโหลดไม่สำเร็จ โปรดลองอีกครั้ง");
      }
    });
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Upload className="mr-1 size-4" aria-hidden /> อัปโหลดไฟล์
      </Button>

      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!next) setError(null);
          setOpen(next);
        }}
      >
        <DialogContent>
          {/* Remounts on open so the previous selection is not still sitting
              in the file input. */}
          <form key={open ? "open" : "closed"} action={submit} className="space-y-4">
            <DialogHeader>
              <DialogTitle>อัปโหลดไฟล์</DialogTitle>
              <DialogDescription>
                ไฟล์จะถูกเก็บไว้ในคลังกลาง สำหรับนำไปแนบในหัวข้อ OIT
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-1.5">
              <Label htmlFor="file-name">
                ชื่อไฟล์ที่จะแสดง <span className="text-destructive">*</span>
              </Label>
              <Input
                id="file-name"
                name="name"
                placeholder="เช่น รายงานผลการดำเนินงาน 2569"
                maxLength={255}
                required
                autoFocus
              />
              <p className="text-xs text-muted-foreground">ต้องไม่ซ้ำกับไฟล์ที่มีอยู่ในคลัง</p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="file-input">
                ไฟล์ <span className="text-destructive">*</span>
              </Label>
              <Input id="file-input" name="file" type="file" accept={accept} required />
              <p className="text-xs text-muted-foreground">
                รองรับ {accept.replaceAll(".", "").replaceAll(",", ", ")} · ขนาดไม่เกิน {maxSizeMb} MB
              </p>
            </div>

            {error && (
              <p
                role="alert"
                className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
              >
                {error}
              </p>
            )}

            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                ยกเลิก
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? "กำลังอัปโหลด…" : "อัปโหลด"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
