"use client";

import { Trash2 } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { deleteFile, fileReferences, type OitFileReference } from "@/actions/file";
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

const LIST_LIMIT = 5;

/** Delete one file from the library (F20). Rendered only for people allowed to. */
export function FileDeleteButton({ fileId, name }: { fileId: number; name: string }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  // Which OIT entries link to this file, fetched when the dialog opens so
  // the warning reflects the live state, not a guess. null = still loading.
  const [references, setReferences] = useState<OitFileReference[] | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    fileReferences(fileId)
      .then((entries) => {
        if (!cancelled) setReferences(entries);
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
              {references !== null && references.length > 0 ? (
                <>
                  “{name}” <b>ถูกอ้างอิงอยู่ในเนื้อหา OIT {references.length} รายการ</b> — ลบแล้วลิงก์ใน
                  รายการเหล่านั้นจะใช้งานไม่ได้ทันที การกระทำนี้ไม่สามารถย้อนกลับได้
                </>
              ) : (
                <>
                  “{name}” จะถูกลบออกจากคลังและจากเซิร์ฟเวอร์ การกระทำนี้ไม่สามารถย้อนกลับได้
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {references !== null && references.length > 0 && (
            // Outside AlertDialogDescription on purpose: it renders a <p>, and a
            // list cannot nest inside one.
            <ul className="max-h-48 space-y-2 overflow-y-auto rounded-md border bg-muted/40 p-3 text-sm">
              {references.slice(0, LIST_LIMIT).map((ref) => (
                <li key={ref.id}>
                  <span className="font-medium">{ref.title}</span>
                  <span className="block text-muted-foreground">
                    อยู่ในหัวข้อ ITA: {ref.itaTitle} · พ.ศ. {ref.itaYear}
                  </span>
                </li>
              ))}
              {references.length > LIST_LIMIT && (
                <li className="text-muted-foreground">
                  และอีก {references.length - LIST_LIMIT} รายการ
                </li>
              )}
            </ul>
          )}
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
