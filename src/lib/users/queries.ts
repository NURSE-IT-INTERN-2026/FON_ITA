import type { AppRole } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";

// Read side of user management (F23/F24). SUPERADMIN only — see decisions.md D4.

export type ManagedUser = {
  id: number;
  prefix: string | null;
  firstname: string;
  lastname: string;
  email: string;
  cmuAccount: string;
  role: AppRole;
  status: boolean;
  hasPassword: boolean;
  createdAt: Date;
};

export type UserListFilter = "active" | "disabled";

/**
 * Every account, SUPERADMIN included.
 *
 * The Laravel system hid SUPERADMIN rows from this table. That is dropped:
 * SUPERADMIN accounts can now be created here, and an account you can create
 * but never see would simply vanish after creation. The safety it used to
 * provide is now explicit in the actions instead — the last SUPERADMIN cannot
 * be demoted or disabled, and nobody can disable themselves.
 *
 * Ordered SUPERADMIN → ADMIN → USER (the enum's own order), then by name, so
 * the accounts with the most power are at the top where they get looked at.
 */
export async function listManagedUsers(filter: UserListFilter = "active"): Promise<ManagedUser[]> {
  const users = await prisma.user.findMany({
    where: { status: filter === "active" },
    orderBy: [{ role: "asc" }, { firstname: "asc" }, { lastname: "asc" }],
    select: {
      id: true,
      prefix: true,
      firstname: true,
      lastname: true,
      email: true,
      cmuAccount: true,
      role: true,
      status: true,
      // Never select the hash itself — the UI only needs to know whether the
      // account can sign in with a password at all.
      password: true,
      createdAt: true,
    },
  });

  return users.map(({ password, ...user }) => ({ ...user, hasPassword: !!password }));
}

/** Counts for the two tabs, so each one can say how many rows it holds. */
export async function countManagedUsers(): Promise<{ active: number; disabled: number }> {
  const [active, disabled] = await Promise.all([
    prisma.user.count({ where: { status: true } }),
    prisma.user.count({ where: { status: false } }),
  ]);
  return { active, disabled };
}

/**
 * Active SUPERADMIN accounts. Used to refuse any change that would take the
 * count to zero, which would leave nobody able to manage users at all.
 */
export async function countActiveSuperadmins(): Promise<number> {
  return prisma.user.count({ where: { role: "SUPERADMIN", status: true } });
}
