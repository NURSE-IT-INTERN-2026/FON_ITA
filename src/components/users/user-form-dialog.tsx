"use client";

import { Check, Copy, KeyRound, Pencil, Shuffle, UserPlus } from "lucide-react";
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
import { PrefixSelect } from "@/components/users/prefix-select";
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
 * The password input, plus an opt-in "สุ่ม" button — folded away behind a
 * disclosure by the caller.
 *
 * Adding someone to this system means giving them an address that CMU OAuth can
 * match (D6/D7). A password is the *fallback* the PRD describes for when OAuth
 * is unavailable, so it does not belong in the line of sight of the ordinary
 * task. Empty is both the default and the common case: `createUser` stores null
 * when this is blank.
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
        {suggested ? "แจ้งรหัสนี้ให้ผู้ใช้ เมื่อเข้าใช้ครั้งแรกระบบจะให้ตั้งรหัสใหม่เอง" : hint}
      </p>

      {/* Only meaningful when a password is actually being set — the flag hangs
          off the password, and `createUser` ignores it without one. Hiding it
          keeps a CMU-only account from looking like it has an unread setting.
          A native checkbox: shadcn has no Checkbox here, and adding a Radix
          dependency for one box is not worth it. */}
      {value !== "" && (
        <label className="flex items-start gap-2 pt-1 text-xs text-muted-foreground">
          <input
            type="checkbox"
            name="mustReset"
            defaultChecked
            className="mt-0.5 size-3.5 accent-primary"
          />
          <span>
            บังคับให้ตั้งรหัสผ่านใหม่เมื่อเข้าใช้ครั้งแรก
            <span className="block text-[11px]">
              ผู้ใช้จะเข้าหน้าอื่นไม่ได้จนกว่าจะตั้งรหัสของตนเอง (ใช้กับการล็อกอินด้วยรหัสผ่านเท่านั้น)
            </span>
          </span>
        </label>
      )}
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

          {/* 9rem, not 7: a dropdown trigger has to fit the longest title
              ("ผศ. ดร.") plus the chevron, where the old text input only had to
              fit a placeholder. */}
          <div className="grid gap-4 sm:grid-cols-[9rem_1fr]">
            <div className="space-y-1.5">
              <Label htmlFor="user-prefix">คำนำหน้า</Label>
              <PrefixSelect id="user-prefix" defaultValue={user?.prefix} />
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
              aria-describedby={editMode ? undefined : "user-email-hint"}
            />
            {/* Only when creating — on edit the field is disabled and the rule
                would read as a demand the person cannot act on. */}
            {!editMode && (
              <p id="user-email-hint" className="text-xs text-muted-foreground">
                ต้องเป็น <span className="font-medium">@cmu.ac.th</span> เท่านั้น ·
                ส่วนหน้า @ จะถูกใช้จับคู่ตอนล็อกอินด้วยบัญชี CMU และ<span className="font-medium">ห้ามซ้ำกับบัญชีอื่น</span>
              </p>
            )}
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

          {/* Folded away: the ordinary task is ชื่อ + อีเมล + บทบาท, and the
              person then signs in with the CMU button. A password is only for
              the fallback the PRD describes (OAuth unavailable), so it is one
              click away rather than in the way.

              Native <details>, not React state: it survives a failed submit
              without extra wiring, and the form-level error sits outside this
              block so a validation message can never end up hidden. */}
          <details className="rounded-md border border-dashed px-3 py-2 [&[open]>summary]:mb-3">
            <summary className="cursor-pointer list-none text-sm text-muted-foreground marker:content-none">
              <span className="inline-flex items-center gap-1.5">
                <KeyRound className="size-3.5" aria-hidden />
                {editMode ? "ตั้งรหัสผ่านใหม่" : "ตั้งรหัสผ่านสำรอง"}
                <span className="text-xs">(ไม่จำเป็น)</span>
              </span>
            </summary>
            <PasswordField
              label={editMode ? "รหัสผ่านใหม่" : "รหัสผ่าน"}
              placeholder={editMode ? "เว้นว่างไว้หากไม่ต้องการเปลี่ยน" : "อย่างน้อย 8 ตัวอักษร"}
              hint={
                editMode
                  ? user.hasPassword
                    ? "ถ้าตั้งรหัสใหม่ ผู้ใช้จะถูกออกจากระบบทุกอุปกรณ์ทันที"
                    : "บัญชีนี้ยังไม่มีรหัสผ่าน — ใช้ล็อกอินด้วยบัญชี CMU เท่านั้น"
                  : "ปกติไม่ต้องตั้ง — ผู้ใช้เข้าระบบด้วยปุ่ม CMU · ตั้งไว้เฉพาะกรณีสำรองตอน CMU ใช้งานไม่ได้"
              }
            />
          </details>

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
