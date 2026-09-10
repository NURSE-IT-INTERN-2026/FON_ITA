"use client";

import { Trash2 } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { deleteFile, fileReferenceCount } from "@/actions/file";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

/** Delete one file from the library (F20). Rendered only for people allowed to. */
export function FileDeleteButton({ fileId, name }: { fileId: number; name: string }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  // How many OIT entries link to this file, fetched when the dialog opens so
  // the warning reflects the live state, not a guess. null = still loading.
  const [references, setReferences] = useState<number | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    fileReferenceCount(fileId)
      .then((count) => {
        if (!cancelled) setReferences(count);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [open, fileId]);

  function confirm() {
    startTransition(async () => {
      const formData = new FormData();
      formData.set("id", String(fileId));
      const result = await deleteFile(formData);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      setOpen(false);
      toast.success("ลบไฟล์แล้ว");
    });
  }

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        aria-label={`ลบ ${name}`}
        onClick={() => {
          setReferences(null);
          setOpen(true);
        }}
      >
        <Trash2 className="size-4 text-destructive" aria-hidden />
      </Button>

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ยืนยันการลบไฟล์</AlertDialogTitle>
            <AlertDialogDescription>
              {references && references > 0 ? (
                <>
                  “{name}” <b>ถูกอ้างอิงอยู่ในเนื้อหา OIT {references} รายการ</b> — ลบแล้วลิงก์ใน
                  รายการเหล่านั้นจะใช้งานไม่ได้ทันที การกระทำนี้ไม่สามารถย้อนกลับได้
                </>
              ) : (
                <>
                  “{name}” จะถูกลบออกจากคลังและจากเซิร์ฟเวอร์ การกระทำนี้ไม่สามารถย้อนกลับได้
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>ยกเลิก</AlertDialogCancel>
            {/* Plain Button — AlertDialogAction closes on click, hiding a failure
                before the toast can explain it. */}
            <Button variant="destructive" onClick={confirm} disabled={pending}>
              {pending ? "กำลังลบ…" : "ลบ"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
