"use client";

import { Check, Copy, Pencil, Shuffle, UserPlus } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { createUser, updateUser } from "@/actions/user";
import { generatePassword } from "@/lib/generate-password";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { AppRole } from "@/generated/prisma/enums";

type EditableUser = {
  id: number;
  prefix: string | null;
  firstname: string;
  lastname: string;
  email: string;
  role: AppRole;
  hasPassword: boolean;
  /** True when this row is the signed-in SUPERADMIN's own account. */
  isSelf: boolean;
};

/** "เพิ่มผู้ใช้" — SUPERADMIN only, and the action checks that again (F24). */
export function UserCreateButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <UserPlus className="mr-1 size-4" aria-hidden /> เพิ่มผู้ใช้
      </Button>
      <UserFormDialog open={open} onOpenChange={setOpen} />
    </>
  );
}

/** Per-row edit button. */
export function UserEditButton({ user }: { user: EditableUser }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        aria-label={`แก้ไข ${user.firstname} ${user.lastname}`}
        onClick={() => setOpen(true)}
      >
        <Pencil className="size-4" aria-hidden />
      </Button>
      <UserFormDialog open={open} onOpenChange={setOpen} user={user} />
    </>
  );
}

/**
 * The password input, plus an opt-in "สุ่ม" button.
 *
 * Deliberately empty by default. Every account here also logs in through CMU
 * OAuth, so a password nobody asked for is a second way in that nobody watches
 * — `createUser` stores null when this is blank, and that is the common case.
 */
function PasswordField({
  label,
  placeholder,
  hint,
}: {
  label: string;
  placeholder: string;
  hint: string;
}) {
  const [value, setValue] = useState("");
  // Suggested passwords are shown in the clear: an unreadable one cannot be
  // handed over, and it is not a secret the SUPERADMIN needs hidden from
  // themselves. A typed one stays masked.
  const [suggested, setSuggested] = useState(false);
  const [copied, setCopied] = useState(false);

  function suggest() {
    setValue(generatePassword());
    setSuggested(true);
    setCopied(false);
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Denied permission, or an insecure origin. The password is on screen in
      // plain text, so selecting it by hand still works.
      toast.error("คัดลอกไม่สำเร็จ — เลือกข้อความแล้วคัดลอกเองได้");
    }
  }

  return (
    <div className="space-y-1.5">
      <Label htmlFor="user-password">{label}</Label>
      <div className="flex gap-2">
        <Input
          id="user-password"
          name="password"
          type={suggested ? "text" : "password"}
          autoComplete="new-password"
          placeholder={placeholder}
          value={value}
          onChange={(event) => {
            setValue(event.target.value);
            // Edited by hand — mask it again and stop calling it a suggestion.
            setSuggested(false);
            setCopied(false);
          }}
          className={suggested ? "font-mono" : undefined}
        />
        {suggested && (
          <Button type="button" variant="outline" size="icon" aria-label="คัดลอกรหัสผ่าน" onClick={copy}>
            {copied ? (
              <Check className="size-4 text-primary" aria-hidden />
            ) : (
              <Copy className="size-4" aria-hidden />
            )}
          </Button>
        )}
        <Button type="button" variant="outline" onClick={suggest}>
          <Shuffle className="mr-1 size-4" aria-hidden />
          {suggested ? "สุ่มใหม่" : "สุ่ม"}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        {suggested ? "แจ้งรหัสนี้ให้ผู้ใช้ แล้วแนะนำให้เปลี่ยนเองที่หน้าโปรไฟล์" : hint}
      </p>
    </div>
  );
}

function UserFormDialog({
  open,
  onOpenChange,
  user,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user?: EditableUser;
}) {
  const editMode = !!user;
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(formData: FormData) {
    startTransition(async () => {
      const result = editMode ? await updateUser(formData) : await createUser(formData);
      if (result.error) {
        setError(result.error);
        return;
      }
      setError(null);
      onOpenChange(false);
      toast.success(editMode ? "บันทึกการแก้ไขแล้ว" : "เพิ่มผู้ใช้แล้ว");
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setError(null);
        onOpenChange(next);
      }}
    >
      <DialogContent>
        {/* key remounts the form on each open so nothing is left over. */}
        <form key={open ? "open" : "closed"} action={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{editMode ? "แก้ไขผู้ใช้" : "เพิ่มผู้ใช้"}</DialogTitle>
            <DialogDescription>
              {editMode
                ? "อีเมลและบัญชี CMU แก้ไขไม่ได้ เพราะเป็นตัวระบุตัวตนที่ใช้ล็อกอิน"
                : "บัญชี CMU จะถูกตั้งจากส่วนหน้า @ ของอีเมลโดยอัตโนมัติ"}
            </DialogDescription>
          </DialogHeader>

          {editMode && <input type="hidden" name="id" value={user.id} />}

          <div className="grid gap-4 sm:grid-cols-[7rem_1fr]">
            <div className="space-y-1.5">
              <Label htmlFor="user-prefix">คำนำหน้า</Label>
              <Input
                id="user-prefix"
                name="prefix"
                defaultValue={user?.prefix ?? ""}
                placeholder="นาย / นางสาว / นาง"
                maxLength={50}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="user-firstname">
                ชื่อ <span className="text-destructive">*</span>
              </Label>
              <Input
                id="user-firstname"
                name="firstname"
                defaultValue={user?.firstname ?? ""}
                maxLength={100}
                required
                autoFocus
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="user-lastname">
              นามสกุล <span className="text-destructive">*</span>
            </Label>
            <Input
              id="user-lastname"
              name="lastname"
              defaultValue={user?.lastname ?? ""}
              maxLength={100}
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="user-email">
              อีเมล <span className="text-destructive">*</span>
            </Label>
            <Input
              id="user-email"
              name="email"
              type="email"
              defaultValue={user?.email ?? ""}
              placeholder="someone@cmu.ac.th"
              required={!editMode}
              disabled={editMode}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="user-role">
              บทบาท <span className="text-destructive">*</span>
            </Label>
            <Select name="role" defaultValue={user?.role ?? "ADMIN"} disabled={user?.isSelf}>
              <SelectTrigger id="user-role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ADMIN">เจ้าหน้าที่ — จัดการ ITA/OIT และคลังไฟล์</SelectItem>
                <SelectItem value="SUPERADMIN">ผู้ดูแลสูงสุด — จัดการผู้ใช้ได้ด้วย</SelectItem>
                {/* Only for a row that is already USER: legacy accounts must
                    stay saveable, but no new one can be created (D12). */}
                {user?.role === "USER" && (
                  <SelectItem value="USER">ผู้ใช้ทั่วไป — ดูอย่างเดียว (บทบาทเดิม)</SelectItem>
                )}
              </SelectContent>
            </Select>
            {/* The disabled Select above submits nothing, so the value rides
                along in a hidden field. */}
            {user?.isSelf && <input type="hidden" name="role" value={user.role} />}
            <p className="text-xs text-muted-foreground">
              {user?.isSelf
                ? "เปลี่ยนบทบาทของบัญชีตนเองไม่ได้ เพื่อไม่ให้ตัดสิทธิ์ตัวเองโดยไม่ตั้งใจ"
                : "ผู้เยี่ยมชมทั่วไปดูข้อมูล ITA/OIT ได้อยู่แล้วโดยไม่ต้องมีบัญชี"}
            </p>
          </div>

          <PasswordField
            label={editMode ? "ตั้งรหัสผ่านใหม่" : "รหัสผ่าน"}
            placeholder={editMode ? "เว้นว่างไว้หากไม่ต้องการเปลี่ยน" : "อย่างน้อย 8 ตัวอักษร"}
            hint={
              editMode
                ? user.hasPassword
                  ? "ถ้าตั้งรหัสใหม่ ผู้ใช้จะถูกออกจากระบบทุกอุปกรณ์ทันที"
                  : "บัญชีนี้ยังไม่มีรหัสผ่าน — ใช้ล็อกอินด้วยบัญชี CMU เท่านั้น"
                : "เว้นว่างได้ถ้าให้ล็อกอินด้วยบัญชี CMU เท่านั้น"
            }
          />

          {error && (
            <p
              role="alert"
              className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
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
