"use client";

import { KeyRound } from "lucide-react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { resetPassword, type ResetPasswordState } from "@/actions/reset-password";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function SubmitButton() {
  // Must be a child of <form> — useFormStatus reads the enclosing form's state.
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full gap-1.5" disabled={pending}>
      <KeyRound className="h-4 w-4" aria-hidden />
      {pending ? "กำลังบันทึก…" : "ตั้งรหัสผ่านใหม่"}
    </Button>
  );
}

export function ResetPasswordForm() {
  const [state, formAction] = useActionState<ResetPasswordState, FormData>(resetPassword, {});
  const describedBy = state.error ? "reset-error" : "reset-hint";

  return (
    <form action={formAction} className="space-y-4 text-left">
      {/* No "current password" field: they typed it moments ago at the login
          form, and this page is only reachable with the session it produced. */}
      <div className="space-y-1.5">
        <Label htmlFor="next">รหัสผ่านใหม่</Label>
        <Input
          id="next"
          name="next"
          type="password"
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
        <Input
          id="confirm"
          name="confirm"
          type="password"
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

      <SubmitButton />
    </form>
  );
}
