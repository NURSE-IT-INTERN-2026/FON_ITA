"use client";

import { LogIn } from "lucide-react";
import { startTransition, useActionState } from "react";
import { authenticate, type LoginState } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";

// Outline, not the default: the CMU button above is the primary action now,
// and two solid buttons would give equal weight to the fallback.
function SubmitButton({ pending }: { pending: boolean }) {
  return (
    <Button type="submit" variant="outline" className="w-full gap-1.5" disabled={pending}>
      <LogIn className="h-4 w-4" aria-hidden />
      {pending ? "กำลังเข้าสู่ระบบ…" : "เข้าสู่ระบบ"}
    </Button>
  );
}

export function LoginForm({ next }: { next?: string }) {
  const [state, formAction, pending] = useActionState<LoginState, FormData>(authenticate, {});

  /**
   * onSubmit, not `action={formAction}`.
   *
   * React 19 resets the form once the action returns. `authenticate` redirects
   * on success, so only the failure path is affected — and there it wiped the
   * email too, making every mistyped password cost two fields instead of one.
   * useFormStatus goes with it: it reads the `action` prop's state, so pending
   * now comes from useActionState itself.
   */
  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(() => formAction(formData));
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 text-left">
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
        <PasswordInput
          id="password"
          name="password"
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

      <SubmitButton pending={pending} />
    </form>
  );
}
