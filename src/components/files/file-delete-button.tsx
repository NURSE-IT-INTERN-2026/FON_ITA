"use client";

import { Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { deleteFile } from "@/actions/file";
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
      <Button variant="ghost" size="icon" aria-label={`ลบ ${name}`} onClick={() => setOpen(true)}>
        <Trash2 className="size-4 text-destructive" aria-hidden />
      </Button>

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ยืนยันการลบไฟล์</AlertDialogTitle>
            <AlertDialogDescription>
              “{name}” จะถูกลบออกจากคลังและจากเซิร์ฟเวอร์ ลิงก์ที่เคยแนบไว้ใน OIT
              จะใช้งานไม่ได้อีก การกระทำนี้ไม่สามารถย้อนกลับได้
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
