"use client";

import { KeyRound } from "lucide-react";
import { startTransition, useActionState } from "react";
import { resetPassword, type ResetPasswordState } from "@/actions/reset-password";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";

function SubmitButton({ pending }: { pending: boolean }) {
  return (
    <Button type="submit" className="w-full gap-1.5" disabled={pending}>
      <KeyRound className="h-4 w-4" aria-hidden />
      {pending ? "กำลังบันทึก…" : "ตั้งรหัสผ่านใหม่"}
    </Button>
  );
}

export function ResetPasswordForm() {
  const [state, formAction, pending] = useActionState<ResetPasswordState, FormData>(
    resetPassword,
    {},
  );

  // Same as the login form: React 19 would clear both password boxes on a
  // rejected reset, so the person retypes everything to fix one typo.
  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(() => formAction(formData));
  }
  const describedBy = state.error ? "reset-error" : "reset-hint";

  return (
    <form onSubmit={handleSubmit} className="space-y-4 text-left">
      {/* No "current password" field: they typed it moments ago at the login
          form, and this page is only reachable with the session it produced. */}
      <div className="space-y-1.5">
        <Label htmlFor="next">รหัสผ่านใหม่</Label>
        <PasswordInput
          id="next"
          name="next"
          autoComplete="new-password"
          required
          minLength={8}
          autoFocus
          aria-describedby={describedBy}
        />
        <p id="reset-hint" className="text-xs text-muted-foreground">
          อย่างน้อย 8 ตัวอักษร และต้องไม่ซ้ำกับรหัสผ่านชั่วคราวที่ได้รับมา
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="confirm">ยืนยันรหัสผ่านใหม่</Label>
        <PasswordInput
          id="confirm"
          name="confirm"
          autoComplete="new-password"
          required
          minLength={8}
          aria-describedby={describedBy}
        />
      </div>

      {state.error && (
        // role="alert" so screen readers announce it after the failed submit
        <p
          id="reset-error"
          role="alert"
          className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {state.error}
        </p>
      )}

      <SubmitButton pending={pending} />
    </form>
  );
}
