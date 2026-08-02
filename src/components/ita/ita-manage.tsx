"use client";

import { Pencil, Plus, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { createIta, deleteIta, updateIta } from "@/actions/ita";
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

// Create / edit / delete controls for ITA topics (F14). Client Components
// because dialogs need open state — the list itself stays on the server.
//
// These are only rendered for ADMIN+ (see ItaListView), but that is UX only:
// the Server Actions check the role themselves.

type EditableIta = { id: number; title: string; year: string; order: number };

/** "เพิ่มหัวข้อ" — used in the page header and in the empty state. */
export function ItaCreateButton({
  year,
  variant = "default",
}: {
  year: string;
  variant?: "default" | "secondary";
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant={variant} onClick={() => setOpen(true)}>
        <Plus className="mr-1 size-4" aria-hidden /> เพิ่มหัวข้อ
      </Button>
      <ItaFormDialog open={open} onOpenChange={setOpen} defaultYear={year} />
    </>
  );
}

/** Per-card edit and delete. */
export function ItaCardActions({ ita }: { ita: EditableIta }) {
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);

  return (
    <div className="flex shrink-0 gap-1">
      <Button variant="ghost" size="icon" aria-label="แก้ไข" onClick={() => setEditing(true)}>
        <Pencil className="size-4" aria-hidden />
      </Button>
      <Button variant="ghost" size="icon" aria-label="ลบ" onClick={() => setDeleting(true)}>
        <Trash2 className="size-4 text-destructive" aria-hidden />
      </Button>

      <ItaFormDialog
        open={editing}
        onOpenChange={setEditing}
        defaultYear={ita.year}
        ita={ita}
      />
      <ItaDeleteDialog open={deleting} onOpenChange={setDeleting} ita={ita} />
    </div>
  );
}

function ItaFormDialog({
  open,
  onOpenChange,
  defaultYear,
  ita,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultYear: string;
  ita?: EditableIta;
}) {
  const editMode = !!ita;
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(formData: FormData) {
    startTransition(async () => {
      const result = editMode ? await updateIta(formData) : await createIta(formData);
      if (result.error) {
        setError(result.error);
        return;
      }
      setError(null);
      onOpenChange(false);
      toast.success(editMode ? "บันทึกการแก้ไขแล้ว" : "เพิ่มหัวข้อแล้ว");
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        // Drop a stale error so reopening the dialog starts clean.
        if (!next) setError(null);
        onOpenChange(next);
      }}
    >
      <DialogContent>
        {/* key remounts the form when the dialog reopens, so defaultValue is
            re-applied instead of keeping whatever was typed last time. */}
        <form key={open ? "open" : "closed"} action={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{editMode ? "แก้ไขหัวข้อ ITA" : "เพิ่มหัวข้อ ITA"}</DialogTitle>
            <DialogDescription>
              {editMode ? "แก้ไขปีและชื่อของหัวข้อนี้" : "ระบุปีและชื่อหัวข้อที่ต้องการเพิ่ม"}
            </DialogDescription>
          </DialogHeader>

          {editMode && <input type="hidden" name="id" value={ita.id} />}

          {/* ปีมาก่อนชื่อหัวข้อ: ปีคือสิ่งที่ตัดสินว่าหัวข้อนี้จะไปอยู่ในชุดไหน
              ส่วนชื่อเป็นรายละเอียดของหัวข้อนั้น */}
          <div className="space-y-1.5">
            <Label htmlFor="ita-year">
              ปี พ.ศ. <span className="text-destructive">*</span>
            </Label>
            <Input
              id="ita-year"
              name="year"
              defaultValue={ita?.year ?? defaultYear}
              placeholder="เช่น 2568"
              inputMode="numeric"
              maxLength={4}
              className="sm:w-40"
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ita-title">
              ชื่อหัวข้อ <span className="text-destructive">*</span>
            </Label>
            <Input
              id="ita-title"
              name="title"
              defaultValue={ita?.title ?? ""}
              placeholder="เช่น การเปิดเผยข้อมูลสาธารณะ"
              maxLength={255}
              required
              autoFocus
            />
          </div>

          {/* ไม่มีช่อง "ลำดับ" โดยตั้งใจ — ลำดับเปลี่ยนด้วยการลากการ์ดในหน้ารายการ
              การให้พิมพ์เลขเองซ้ำซ้อนกับการลาก และเป็นเลขที่เปลี่ยนได้ตลอดเวลา */}
          <p className="text-xs text-muted-foreground">
            {editMode
              ? "ลำดับการแสดงผลปรับได้ด้วยการลากการ์ดในหน้ารายการ · ถ้าเปลี่ยนปี หัวข้อจะถูกย้ายไปต่อท้ายรายการของปีใหม่"
              : "หัวข้อใหม่จะถูกเพิ่มต่อท้ายรายการของปีที่ระบุ · จัดลำดับภายหลังได้ด้วยการลากการ์ด"}
          </p>

          {error && (
            <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              ยกเลิก
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "กำลังบันทึก…" : "บันทึก"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ItaDeleteDialog({
  open,
  onOpenChange,
  ita,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ita: EditableIta;
}) {
  const [pending, startTransition] = useTransition();

  function confirm() {
    startTransition(async () => {
      const formData = new FormData();
      formData.set("id", String(ita.id));
      const result = await deleteIta(formData);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      onOpenChange(false);
      toast.success("ลบหัวข้อแล้ว");
    });
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>ยืนยันการลบหัวข้อ</AlertDialogTitle>
          <AlertDialogDescription>
            หัวข้อ “{ita.title}” และ OIT ทั้งหมดที่อยู่ภายใต้หัวข้อนี้จะถูกลบออกจากระบบ
            การกระทำนี้ไม่สามารถย้อนกลับได้
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>ยกเลิก</AlertDialogCancel>
          {/* Not AlertDialogAction: that closes the dialog on click, which would
              hide a failure before the toast explains it. */}
          <Button variant="destructive" onClick={confirm} disabled={pending}>
            {pending ? "กำลังลบ…" : "ลบ"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
