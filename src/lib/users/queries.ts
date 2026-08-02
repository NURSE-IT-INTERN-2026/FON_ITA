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

export type UserListFilter = "active" | "disabled" | "all";

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
 *
 * `all` is the default since P9 — the Switch toggle in the table makes active
 * and disabled rows visually distinct, so the filter tabs the old UI used are
 * no longer needed.
 */
export async function listManagedUsers(filter: UserListFilter = "all"): Promise<ManagedUser[]> {
  const users = await prisma.user.findMany({
    where: filter === "all" ? {} : { status: filter === "active" },
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

/**
 * Active SUPERADMIN accounts. Used to refuse any change that would take the
 * count to zero, which would leave nobody able to manage users at all.
 */
export async function countActiveSuperadmins(): Promise<number> {
  return prisma.user.count({ where: { role: "SUPERADMIN", status: true } });
}
