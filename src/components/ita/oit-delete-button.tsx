"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { deleteOit } from "@/actions/oit";
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

/** Delete an OIT from its detail page, then return to the year it belonged to. */
export function OitDeleteButton({
  oitId,
  title,
  year,
}: {
  oitId: number;
  title: string;
  year: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function confirm() {
    startTransition(async () => {
      const formData = new FormData();
      formData.set("id", String(oitId));
      const result = await deleteOit(formData);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      setOpen(false);
      toast.success("ลบ OIT แล้ว");
      // This page is about to 404 — leave before that happens.
      router.push(`/ita/by-year/${year}`);
    });
  }

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <Trash2 className="mr-1 size-4 text-destructive" aria-hidden /> ลบ
      </Button>

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ยืนยันการลบ OIT</AlertDialogTitle>
            <AlertDialogDescription>
              “{title}” จะถูกลบออกจากระบบ การกระทำนี้ไม่สามารถย้อนกลับได้
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>ยกเลิก</AlertDialogCancel>
            {/* Plain Button: AlertDialogAction closes on click, which would hide
                a failure before the toast could explain it. */}
            <Button variant="destructive" onClick={confirm} disabled={pending}>
              {pending ? "กำลังลบ…" : "ลบ"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
