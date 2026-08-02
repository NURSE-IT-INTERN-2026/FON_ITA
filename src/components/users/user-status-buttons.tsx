"use client";

import { RotateCcw, UserX } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { disableUser, restoreUser } from "@/actions/user";
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
 * Disable an account (F24).
 *
 * "ลบผู้ใช้" in the old system meant `status = 0`, and that is kept: `ItaFile`
 * rows point at users, and an upload's history should outlive the uploader.
 * The wording says "ปิดใช้งาน" so nobody expects the row to be gone.
 */
export function UserDisableButton({ userId, name }: { userId: number; name: string }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function confirm() {
    startTransition(async () => {
      const formData = new FormData();
      formData.set("id", String(userId));
      const result = await disableUser(formData);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      setOpen(false);
      toast.success("ปิดใช้งานบัญชีแล้ว");
    });
  }

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        aria-label={`ปิดใช้งาน ${name}`}
        onClick={() => setOpen(true)}
      >
        <UserX className="size-4 text-destructive" aria-hidden />
      </Button>

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ยืนยันการปิดใช้งานบัญชี</AlertDialogTitle>
            <AlertDialogDescription>
              “{name}” จะเข้าสู่ระบบไม่ได้อีกและถูกออกจากระบบทุกอุปกรณ์ทันที ·
              ไฟล์และข้อมูลที่เคยบันทึกไว้ยังอยู่ครบ · เปิดใช้งานกลับได้ที่แท็บ “ปิดใช้งาน”
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>ยกเลิก</AlertDialogCancel>
            {/* Plain Button: AlertDialogAction closes on click, which would hide
                a failure before the toast explains it. */}
            <Button variant="destructive" onClick={confirm} disabled={pending}>
              {pending ? "กำลังปิดใช้งาน…" : "ปิดใช้งาน"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

/** Re-enable a disabled account — the way back that the old system lacked. */
export function UserRestoreButton({ userId, name }: { userId: number; name: string }) {
  const [pending, startTransition] = useTransition();

  function restore() {
    startTransition(async () => {
      const formData = new FormData();
      formData.set("id", String(userId));
      const result = await restoreUser(formData);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("เปิดใช้งานบัญชีแล้ว");
    });
  }

  return (
    <Button variant="outline" size="sm" onClick={restore} disabled={pending}>
      <RotateCcw className="mr-1 size-3.5" aria-hidden />
      {pending ? "กำลังเปิด…" : "เปิดใช้งาน"}
      <span className="sr-only"> {name}</span>
    </Button>
  );
}
