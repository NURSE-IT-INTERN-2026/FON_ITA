"use client";

import { LogIn } from "lucide-react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { authenticate, type LoginState } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function SubmitButton() {
  // Must be a child of <form> — useFormStatus reads the enclosing form's state.
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full gap-1.5" disabled={pending}>
      <LogIn className="h-4 w-4" aria-hidden />
      {pending ? "กำลังเข้าสู่ระบบ…" : "เข้าสู่ระบบ"}
    </Button>
  );
}

export function LoginForm({ next }: { next?: string }) {
  const [state, formAction] = useActionState<LoginState, FormData>(authenticate, {});

  return (
    <form action={formAction} className="space-y-4 text-left">
      {/* Where the proxy wanted to send them. Anyone can edit a hidden field,
          so authenticate() validates it before redirecting. */}
      {next && <input type="hidden" name="next" value={next} />}

      <div className="space-y-1.5">
        <Label htmlFor="email">อีเมล</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          required
          placeholder="you@cmu.ac.th"
          aria-describedby={state.error ? "login-error" : undefined}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="password">รหัสผ่าน</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          aria-describedby={state.error ? "login-error" : undefined}
        />
      </div>

      {state.error && (
        // role="alert" so screen readers announce it after the failed submit
        <p
          id="login-error"
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
