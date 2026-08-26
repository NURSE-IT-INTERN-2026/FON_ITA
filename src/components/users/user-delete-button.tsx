"use client";

import { Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { deleteUser } from "@/actions/user";
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

/**
 * Per-row hard delete (D26). Not rendered on the operator's own row — the
 * action refuses self-delete anyway, and hiding the button says so without
 * the error round-trip.
 */
export function UserDeleteButton({
  userId,
  name,
  email,
  isSelf,
}: {
  userId: number;
  name: string;
  email: string;
  isSelf: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  if (isSelf) return null;

  function confirm() {
    startTransition(async () => {
      const formData = new FormData();
      formData.set("id", String(userId));
      const result = await deleteUser(formData);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      setOpen(false);
      toast.success(`ลบ "${name}" แล้ว`);
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
            <AlertDialogTitle>ยืนยันการลบผู้ใช้</AlertDialogTitle>
            <AlertDialogDescription>
              บัญชี “{name}” ({email}) จะถูกลบออกจากระบบถาวร และออกจากระบบทุกอุปกรณ์ทันที
              ไฟล์ที่เคยอัปโหลดและประวัติกิจกรรมยังอยู่ตามเดิม การกระทำนี้ไม่สามารถย้อนกลับได้
              หากต้องการเพียงพักการใช้งานชั่วคราว ใช้สวิตช์สถานะในคอลัมน์ข้าง ๆ แทน
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>ยกเลิก</AlertDialogCancel>
            {/* Plain Button — AlertDialogAction closes on click, hiding a failure
                before the toast can explain it. */}
            <Button variant="destructive" onClick={confirm} disabled={pending}>
              {pending ? "กำลังลบ…" : "ลบถาวร"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
