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
import { Button, type ButtonProps } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Delete an OIT from its detail page, then return to the year it belonged to. */
export function OitDeleteButton({
  oitId,
  title,
  redirectTo,
  variant = "outline",
  size = "default",
  className,
  iconOnly = false,
}: {
  oitId: number;
  title: string;
  redirectTo?: string;
  variant?: ButtonProps["variant"];
  size?: ButtonProps["size"];
  className?: string;
  iconOnly?: boolean;
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
      if (redirectTo) {
        // The detail page is about to 404 after deleting its row.
        router.push(redirectTo);
        return;
      }
      router.refresh();
    });
  }

  return (
    <>
      <Button
        type="button"
        variant={variant}
        size={size}
        className={className}
        aria-label={iconOnly ? `ลบ ${title}` : undefined}
        onClick={() => setOpen(true)}
      >
        <Trash2 className={cn("size-4 text-destructive", !iconOnly && "mr-1")} aria-hidden />
        {!iconOnly && "ลบ"}
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
            <Button type="button" variant="destructive" onClick={confirm} disabled={pending}>
              {pending ? "กำลังลบ…" : "ลบ"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
