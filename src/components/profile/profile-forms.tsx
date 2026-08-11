"use client";

import { KeyRound, Save, User as UserIcon } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { changePassword, updateProfile } from "@/actions/profile";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PrefixSelect } from "@/components/users/prefix-select";

// Client leaves of the profile page (F25). Only these two forms need state; the
// page around them stays a Server Component.

type Props = {
  prefix: string | null;
  firstname: string;
  lastname: string;
  /** false = CMU-only account, which is setting a password rather than changing one. */
  hasPassword: boolean;
};

export function ProfileForms({ prefix, firstname, lastname, hasPassword }: Props) {
  return (
    <Tabs defaultValue="profile" className="max-w-2xl">
      <TabsList className="border border-warm/15 bg-warm-soft/70 dark:border-warm/20 dark:bg-warm/10">
        <TabsTrigger value="profile" className="gap-1.5">
          <UserIcon className="size-4" aria-hidden />
          โปรไฟล์
        </TabsTrigger>
        <TabsTrigger value="password" className="gap-1.5">
          <KeyRound className="size-4" aria-hidden />
          {hasPassword ? "เปลี่ยนรหัสผ่าน" : "ตั้งรหัสผ่าน"}
        </TabsTrigger>
      </TabsList>

      <TabsContent value="profile">
        <ProfileForm prefix={prefix} firstname={firstname} lastname={lastname} />
      </TabsContent>

      <TabsContent value="password">
        <PasswordForm hasPassword={hasPassword} />
      </TabsContent>
    </Tabs>
  );
}

/** Shared error strip, so both forms report failures the same way. */
function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
      {message}
    </p>
  );
}

function ProfileForm({ prefix, firstname, lastname }: Omit<Props, "hasPassword">) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // onSubmit, not `action=`: React 19 resets an action form when the action
  // returns, and ours returns `{ error }` rather than throwing — a rejected
  // save would put the old name back while showing an error about the new one.
  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(async () => {
      const result = await updateProfile(formData);
      if (result.error) {
        setError(result.error);
        return;
      }
      setError(null);
      toast.success("บันทึกข้อมูลส่วนตัวแล้ว");
    });
  }

  return (
    <Card className="mt-4 rounded-3xl border-warm/20 p-6 shadow-[0_24px_60px_-52px_rgba(67,36,19,0.24)] dark:border-warm/25 dark:shadow-[0_24px_60px_-48px_rgba(0,0,0,0.6)]">
      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-1">
          <h2 className="text-base font-semibold text-warm-strong dark:text-warm">ข้อมูลส่วนตัว</h2>
          <p className="text-sm text-muted-foreground">
            ชื่อที่ใช้แสดงในระบบและใช้สำหรับการเข้าสู่ระบบ
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="profile-prefix">คำนำหน้า</Label>
          <PrefixSelect id="profile-prefix" defaultValue={prefix} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="profile-firstname">
              ชื่อ <span className="text-destructive">*</span>
            </Label>
            <Input
              id="profile-firstname"
              name="firstname"
              defaultValue={firstname}
              maxLength={100}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="profile-lastname">
              นามสกุล <span className="text-destructive">*</span>
            </Label>
            <Input
              id="profile-lastname"
              name="lastname"
              defaultValue={lastname}
              maxLength={100}
              required
            />
          </div>
        </div>

        <FormError message={error} />

        <div className="flex justify-end">
          <Button type="submit" disabled={pending}>
            <Save className="mr-1 size-4" aria-hidden />
            {pending ? "กำลังบันทึก…" : "บันทึก"}
          </Button>
        </div>
      </form>
    </Card>
  );
}

function PasswordForm({ hasPassword }: { hasPassword: boolean }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  // Bumped after a success to remount the form, which clears the three fields
  // without any of them becoming controlled inputs.
  const [formKey, setFormKey] = useState(0);

  // Same reason as ProfileForm. The deliberate clear on SUCCESS still happens,
  // via formKey below — what this stops is the clear on FAILURE.
  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(async () => {
      const result = await changePassword(formData);
      if (result.error) {
        setError(result.error);
        return;
      }
      setError(null);
      setFormKey((n) => n + 1);
      toast.success(hasPassword ? "เปลี่ยนรหัสผ่านแล้ว" : "ตั้งรหัสผ่านแล้ว");
    });
  }

  return (
    <Card className="mt-4 rounded-3xl border-warm/20 p-6 shadow-[0_24px_60px_-52px_rgba(67,36,19,0.24)] dark:border-warm/25 dark:shadow-[0_24px_60px_-48px_rgba(0,0,0,0.6)]">
      <form key={formKey} onSubmit={submit} className="space-y-4">
        <div className="space-y-1">
          <h2 className="text-base font-semibold text-warm-strong dark:text-warm">
            {hasPassword ? "เปลี่ยนรหัสผ่าน" : "ตั้งรหัสผ่าน"}
          </h2>
          <p className="text-sm text-muted-foreground">
            {hasPassword
              ? "เมื่อเปลี่ยนแล้ว อุปกรณ์อื่นที่ยังค้างอยู่จะถูกออกจากระบบทั้งหมด แต่เครื่องนี้ยังใช้งานต่อได้"
              : "บัญชีนี้เข้าระบบด้วยบัญชี CMU อยู่แล้ว การตั้งรหัสผ่านจะเพิ่มช่องทางเข้าด้วยอีเมลอีกทาง"}
          </p>
        </div>

        {hasPassword && (
          <div className="space-y-1.5">
            <Label htmlFor="password-current">
              รหัสผ่านปัจจุบัน <span className="text-destructive">*</span>
            </Label>
            <PasswordInput
              id="password-current"
              name="current"
              autoComplete="current-password"
              required
            />
          </div>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="password-next">
            รหัสผ่านใหม่ <span className="text-destructive">*</span>
          </Label>
          <PasswordInput
            id="password-next"
            name="next"
            autoComplete="new-password"
            placeholder="อย่างน้อย 8 ตัวอักษร"
            required
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="password-confirm">
            ยืนยันรหัสผ่านใหม่ <span className="text-destructive">*</span>
          </Label>
          <PasswordInput
            id="password-confirm"
            name="confirm"
            autoComplete="new-password"
            required
          />
        </div>

        <FormError message={error} />

        <div className="flex justify-end">
          <Button type="submit" disabled={pending}>
            <KeyRound className="mr-1 size-4" aria-hidden />
            {pending ? "กำลังบันทึก…" : hasPassword ? "เปลี่ยนรหัสผ่าน" : "ตั้งรหัสผ่าน"}
          </Button>
        </div>
      </form>
    </Card>
  );
}
