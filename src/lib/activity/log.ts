import type { AppRole } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import type { ActivityAction } from "@/lib/activity/actions";

// Write side of the activity log (F26).

/** Whoever performed the action — `SessionUser` satisfies this as-is. */
export type ActivityActor = {
  id: number;
  prefix: string | null;
  firstname: string;
  lastname: string;
  role: AppRole;
};

/** Long titles and file names are common; the log is a summary, not a copy. */
const MAX_TEXT = 255;

function truncate(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.length > MAX_TEXT ? `${trimmed.slice(0, MAX_TEXT - 1)}…` : trimmed;
}

export function actorName(actor: ActivityActor): string {
  return `${actor.prefix ?? ""}${actor.firstname} ${actor.lastname}`.trim();
}

/**
 * Record one action. **Never throws.**
 *
 * The audit trail is secondary to the thing being audited: if the log insert
 * fails, the upload, edit or deletion that just succeeded must still be
 * reported as successful. A failure goes to the server log instead, where it
 * can be noticed without any user seeing an error for work that was done.
 */
export async function logActivity(
  actor: ActivityActor,
  action: ActivityAction,
  extra: { target?: string | null; detail?: string | null } = {},
): Promise<void> {
  try {
    await prisma.activityLog.create({
      data: {
        actorId: actor.id,
        // Denormalised on purpose — renaming an account later must not rewrite
        // what the log says happened.
        actorName: actorName(actor),
        actorRole: actor.role,
        action,
        target: truncate(extra.target),
        detail: truncate(extra.detail),
      },
    });
  } catch (error) {
    console.error("[activity] failed to write log entry", action, error);
  }
}
