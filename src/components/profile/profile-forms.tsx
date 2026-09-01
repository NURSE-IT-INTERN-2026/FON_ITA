"use client";

import { BadgeCheck, KeyRound, Save, User as UserIcon } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { changePassword, updateProfile } from "@/actions/profile";
import { WarmSectionCard } from "@/components/shell/surfaces";
import { Button } from "@/components/ui/button";
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
  /** This session was signed in through CMU OAuth (D27) — Microsoft proved who
      is here, so the "current password" field is not asked for. */
  cmuVerified: boolean;
};

export function ProfileForms({ prefix, firstname, lastname, hasPassword, cmuVerified }: Props) {
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
        <PasswordForm hasPassword={hasPassword} cmuVerified={cmuVerified} />
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

function ProfileForm({ prefix, firstname, lastname }: Omit<Props, "hasPassword" | "cmuVerified">) {
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
    <WarmSectionCard
      title="ข้อมูลส่วนตัว"
      description="ชื่อที่ใช้แสดงในระบบและใช้สำหรับการเข้าสู่ระบบ"
      className="mt-4"
      contentClassName="space-y-4"
    >
      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="profile-prefix">คำนำหน้า</Label>
          <PrefixSelect id="profile-prefix" defaultValue={prefix} />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
    </WarmSectionCard>
  );
}

function PasswordForm({ hasPassword, cmuVerified }: { hasPassword: boolean; cmuVerified: boolean }) {
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
    <WarmSectionCard
      title={hasPassword ? "เปลี่ยนรหัสผ่าน" : "ตั้งรหัสผ่าน"}
      description={
        hasPassword
          ? "เมื่อเปลี่ยนแล้ว อุปกรณ์อื่นที่ยังค้างอยู่จะถูกออกจากระบบทั้งหมด แต่เครื่องนี้ยังใช้งานต่อได้"
          : "บัญชีนี้เข้าระบบด้วยบัญชี CMU อยู่แล้ว การตั้งรหัสผ่านจะเพิ่มช่องทางเข้าด้วยอีเมลอีกทาง"
      }
      className="mt-4"
      contentClassName="space-y-4"
    >
      <form key={formKey} onSubmit={submit} className="space-y-4">
        {hasPassword && cmuVerified && (
          // The Server Action re-checks this — the note is the prompt, not the guard.
          <p className="rounded-md border border-primary/25 bg-primary/5 px-3 py-2 text-sm">
            <span className="inline-flex items-center gap-1.5 font-medium">
              <BadgeCheck className="size-4 text-primary" aria-hidden />
              ยืนยันตัวตนด้วยบัญชี CMU แล้ว
            </span>
            <span className="mt-0.5 block text-xs text-muted-foreground">
              คุณล็อกอินด้วยบัญชี CMU อยู่ — ไม่ต้องกรอกรหัสผ่านปัจจุบัน
            </span>
          </p>
        )}

        {hasPassword && !cmuVerified && (
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
            <p className="text-xs text-muted-foreground">
              ลืมรหัสผ่านปัจจุบัน? ออกจากระบบแล้วล็อกอินกลับด้วยปุ่มบัญชี CMU —
              กลับมาหน้านี้ใหม่จะตั้งรหัสผ่านใหม่ได้โดยไม่ต้องใช้รหัสเก่า
            </p>
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
    </WarmSectionCard>
  );
}
