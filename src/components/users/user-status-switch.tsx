"use client";

import { useOptimistic, useTransition } from "react";
import { toast } from "sonner";
import { disableUser, restoreUser } from "@/actions/user";
import { Switch } from "@/components/ui/switch";

/**
 * Inline active/disabled toggle for the user management table (F24).
 *
 * Replaces the old "Disable"/"Restore" buttons + filter tabs. Under the hood it
 * still calls the same `disableUser`/`restoreUser` Server Actions — only the UI
 * changes — so all the safety rules (cannot disable self, cannot disable the
 * last active SUPERADMIN) still apply and the audit log still records the
 * action.
 *
 * `useOptimistic` flips the UI immediately and rolls back if the action errors,
 * so the toggle feels instant for the common case and still ends up correct.
 */
export function UserStatusSwitch({
  userId,
  name,
  active,
  isSelf,
}: {
  userId: number;
  name: string;
  active: boolean;
  /** The signed-in SUPERADMIN's own row — disabling yourself is refused by the
      action, so the Switch is grayed out to say so up front. */
  isSelf: boolean;
}) {
  // Optimistic state mirrors the prop until a transition runs. The action's
  // error path rolls it back via `useOptimistic`'s automatic restore.
  const [optimisticActive, setOptimisticActive] = useOptimistic(active);
  const [pending, startTransition] = useTransition();

  function toggle(next: boolean) {
    // Build the FormData the Server Action expects, then run the right one for
    // the direction of the change.
    const formData = new FormData();
    formData.set("id", String(userId));

    startTransition(async () => {
      setOptimisticActive(next);
      const result = next ? await restoreUser(formData) : await disableUser(formData);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(next ? `เปิดใช้งาน "${name}" แล้ว` : `ปิดใช้งาน "${name}" แล้ว`);
    });
  }

  return (
    <div className="flex items-center gap-2">
      <Switch
        checked={optimisticActive}
        onCheckedChange={toggle}
        disabled={isSelf || pending}
        aria-label={isSelf ? "บัญชีของคุณ — ปิดใช้งานตัวเองไม่ได้" : `${optimisticActive ? "ปิด" : "เปิด"}ใช้งาน ${name}`}
      />
      <span className="text-xs text-muted-foreground">{optimisticActive ? "ใช้งาน" : "ปิด"}</span>
    </div>
  );
}
