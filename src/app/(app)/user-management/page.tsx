import { Users } from "lucide-react";
import type { Metadata } from "next";
import { EmptyState } from "@/components/misc/empty-state";
import { RoleBadge } from "@/components/misc/role-badge";
import { PageHeader } from "@/components/shell/page-header";
import { WarmTableHead, WarmTableSurface } from "@/components/shell/surfaces";
import { UserCreateButton, UserEditButton } from "@/components/users/user-form-dialog";
import { UserDeleteButton } from "@/components/users/user-delete-button";
import { UserStatusSwitch } from "@/components/users/user-status-switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { requireRole } from "@/lib/auth/guards";
import { listManagedUsers } from "@/lib/users/queries";

export const metadata: Metadata = { title: "จัดการผู้ใช้ — FON-ITA" };

/**
 * User management — SUPERADMIN only (decisions.md D4).
 *
 * Shows every account including SUPERADMIN (D13): they can be created here, so
 * hiding them would make a new one disappear the moment it was made. Active and
 * disabled rows live in the same table — the Switch in the "สถานะ" column
 * toggles between them, so disabled accounts stay visible (and reversible)
 * without needing a separate tab.
 */
export default async function UserManagementPage() {
  // requireRole raises forbidden() → the 403 page (F12), which is right here:
  // an ADMIN who follows a bookmarked link should be told, not redirected.
  const actor = await requireRole("SUPERADMIN");

  const users = await listManagedUsers("all");

  return (
    <div>
      <PageHeader
        title="จัดการผู้ใช้"
        breadcrumb={[{ label: "หน้าแรก", href: "/" }, { label: "จัดการผู้ใช้" }]}
        description="เพิ่ม แก้ไข และควบคุมสถานะการใช้งานของบัญชีผู้ใช้ภายในระบบ"
        actions={<UserCreateButton />}
        variant="featured"
      />

      {users.length === 0 ? (
        <EmptyState
          icon={Users}
          title="ยังไม่มีผู้ใช้ในระบบ"
          description="เพิ่มผู้ใช้ใหม่เพื่อเริ่มจัดการสิทธิ์การเข้าถึง"
          action={<UserCreateButton />}
        />
      ) : (
        <>
          {/* Same cards-on-mobile split as the file library: the 6-column table
              needs ~46rem, so phones get one card per user instead. */}
          <div className="grid grid-cols-1 gap-3 md:hidden">
            {users.map((user) => (
              <article
                key={user.id}
                className="rounded-3xl border border-stone-200/80 bg-warm-surface p-4 shadow-[0_18px_40px_-36px_rgba(67,36,19,0.45)] dark:border-border/80 dark:bg-accent/25 dark:shadow-[0_22px_52px_-40px_rgba(0,0,0,0.72)]"
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="flex min-w-0 flex-1 items-center gap-2 text-sm font-semibold text-warm-strong dark:text-warm">
                    <span className="truncate">
                      {[user.prefix, user.firstname, user.lastname].filter(Boolean).join(" ")}
                    </span>
                  </p>
                  <RoleBadge role={user.role} />
                </div>

                <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <div className="col-span-2">
                    <dt className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
                      อีเมล
                    </dt>
                    <dd className="mt-1 truncate text-foreground">{user.email}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
                      คำนำหน้า
                    </dt>
                    <dd className="mt-1 text-foreground">{user.prefix ?? "-"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
                      สถานะ
                    </dt>
                    <dd className="mt-1">
                      <UserStatusSwitch
                        userId={user.id}
                        name={`${user.firstname} ${user.lastname}`.trim()}
                        active={user.status}
                        isSelf={user.id === actor.id}
                      />
                    </dd>
                  </div>
                </dl>

                <div className="mt-4 flex flex-wrap items-center justify-end gap-2 border-t border-stone-200 pt-3 dark:border-border/70">
                  <UserEditButton
                    user={{
                      id: user.id,
                      prefix: user.prefix,
                      firstname: user.firstname,
                      lastname: user.lastname,
                      email: user.email,
                      role: user.role,
                      hasPassword: user.hasPassword,
                      isSelf: user.id === actor.id,
                    }}
                  />
                  <UserDeleteButton
                    userId={user.id}
                    name={`${user.firstname} ${user.lastname}`.trim()}
                    email={user.email}
                    isSelf={user.id === actor.id}
                  />
                </div>
              </article>
            ))}
          </div>

          <div className="hidden md:block">
            <WarmTableSurface>
              <Table>
                <TableHeader>
                  <TableRow>
                    <WarmTableHead className="w-24">คำนำหน้า</WarmTableHead>
                    <WarmTableHead>ชื่อ - นามสกุล</WarmTableHead>
                    <WarmTableHead>อีเมล</WarmTableHead>
                    <WarmTableHead className="w-32">บทบาท</WarmTableHead>
                    <WarmTableHead className="w-28">สถานะ</WarmTableHead>
                    <WarmTableHead className="w-32 text-right">การกระทำ</WarmTableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>{user.prefix ?? "-"}</TableCell>
                      <TableCell className="font-medium">
                        {user.firstname} {user.lastname}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{user.email}</TableCell>
                      <TableCell>
                        <RoleBadge role={user.role} />
                      </TableCell>
                      <TableCell>
                        <UserStatusSwitch
                          userId={user.id}
                          name={`${user.firstname} ${user.lastname}`.trim()}
                          active={user.status}
                          isSelf={user.id === actor.id}
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <UserEditButton
                            user={{
                              id: user.id,
                              prefix: user.prefix,
                              firstname: user.firstname,
                              lastname: user.lastname,
                              email: user.email,
                              role: user.role,
                              hasPassword: user.hasPassword,
                              isSelf: user.id === actor.id,
                            }}
                          />
                          <UserDeleteButton
                            userId={user.id}
                            name={`${user.firstname} ${user.lastname}`.trim()}
                            email={user.email}
                            isSelf={user.id === actor.id}
                          />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </WarmTableSurface>
          </div>
        </>
      )}
    </div>
  );
}
