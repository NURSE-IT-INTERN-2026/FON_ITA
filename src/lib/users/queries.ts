import { Prisma } from "@/generated/prisma/client";
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

export const USERS_PER_PAGE = 15;

export type ManagedUserPage = {
  users: ManagedUser[];
  page: number;
  totalPages: number;
  total: number;
};

/**
 * One page of accounts, every role included, SUPERADMIN at the top.
 *
 * The Laravel system hid SUPERADMIN rows from this table. That is dropped:
 * SUPERADMIN accounts can now be created here, and an account you can create
 * but never see would simply vanish after creation. The safety it used to
 * provide is now explicit in the actions instead — the last SUPERADMIN cannot
 * be demoted or disabled, and nobody can disable themselves.
 *
 * Ordered SUPERADMIN → ADMIN → USER (the enum's own order), then by name, so
 * the accounts with the most power are at the top where they get looked at.
 * `id` breaks name ties so a page boundary can't show or skip a row.
 *
 * `page` is clamped rather than trusted (same as the file library): it comes
 * from the query string, and a huge value would otherwise render an empty
 * table with no way back.
 *
 * `hasPassword` comes from a second id-only query rather than selecting the
 * hash column — the hash never leaves the database this way, and there is no
 * `password` field to accidentally leak into a future caller.
 */
export async function listManagedUsers(page: number): Promise<ManagedUserPage> {
  const total = await prisma.user.count();
  const totalPages = Math.max(1, Math.ceil(total / USERS_PER_PAGE));
  const current = Math.min(Math.max(1, page), totalPages);

  const users = await prisma.user.findMany({
    orderBy: [{ role: "asc" }, { firstname: "asc" }, { lastname: "asc" }, { id: "asc" }],
    skip: (current - 1) * USERS_PER_PAGE,
    take: USERS_PER_PAGE,
    select: {
      id: true,
      prefix: true,
      firstname: true,
      lastname: true,
      email: true,
      cmuAccount: true,
      role: true,
      status: true,
      createdAt: true,
    },
  });

  const withPassword = await prisma.user.findMany({
    where: { id: { in: users.map((user) => user.id) }, password: { not: null } },
    select: { id: true },
  });
  const passwordIds = new Set(withPassword.map((user) => user.id));

  return {
    users: users.map((user) => ({ ...user, hasPassword: passwordIds.has(user.id) })),
    page: current,
    totalPages,
    total,
  };
}

/**
 * Active SUPERADMIN accounts. Used to refuse any change that would take the
 * count to zero, which would leave nobody able to manage users at all.
 *
 * Accepts a transaction client: the last-SUPERADMIN guard counts inside the
 * write's transaction (under an advisory lock), so the count and the write it
 * guards are atomic.
 */
export async function countActiveSuperadmins(
  client: Prisma.TransactionClient | typeof prisma = prisma,
): Promise<number> {
  return client.user.count({ where: { role: "SUPERADMIN", status: true } });
}
