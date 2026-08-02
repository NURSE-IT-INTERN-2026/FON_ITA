import { Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/misc/empty-state";
import { RoleBadge } from "@/components/misc/role-badge";
import { PageHeader } from "@/components/shell/page-header";
import { UserCreateButton, UserEditButton } from "@/components/users/user-form-dialog";
import { UserDisableButton, UserRestoreButton } from "@/components/users/user-status-buttons";
import { buttonVariants } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { requireRole } from "@/lib/auth/guards";
import { formatBEShort } from "@/lib/date";
import { cn } from "@/lib/utils";
import { countManagedUsers, listManagedUsers, type UserListFilter } from "@/lib/users/queries";

export const metadata: Metadata = { title: "จัดการผู้ใช้ — FON-ITA" };

type Props = { searchParams: Promise<{ status?: string }> };

/**
 * User management — SUPERADMIN only (decisions.md D4).
 *
 * Shows every account including SUPERADMIN (D13): they can be created here, so
 * hiding them would make a new one disappear the moment it was made. Disabled
 * accounts get their own tab rather than vanishing, which is what makes
 * re-enabling one possible at all (F24).
 */
export default async function UserManagementPage({ searchParams }: Props) {
  // requireRole raises forbidden() → the 403 page (F12), which is right here:
  // an ADMIN who follows a bookmarked link should be told, not redirected.
  const actor = await requireRole("SUPERADMIN");

  const { status } = await searchParams;
  const filter: UserListFilter = status === "disabled" ? "disabled" : "active";

  const [users, counts] = await Promise.all([listManagedUsers(filter), countManagedUsers()]);
  const showingDisabled = filter === "disabled";

  return (
    <div>
      <PageHeader
        title="จัดการผู้ใช้"
        breadcrumb={[{ label: "หน้าแรก", href: "/" }, { label: "จัดการผู้ใช้" }]}
        description="บัญชีทั้งหมดที่เข้าใช้งานระบบได้ · ผู้เยี่ยมชมทั่วไปไม่ต้องมีบัญชี"
        actions={<UserCreateButton />}
      />

      <div className="mb-4 flex flex-wrap gap-2">
        <FilterTab href="/user-management" active={!showingDisabled}>
          ใช้งานได้ ({counts.active})
        </FilterTab>
        <FilterTab href="/user-management?status=disabled" active={showingDisabled}>
          ปิดใช้งาน ({counts.disabled})
        </FilterTab>
      </div>

      {users.length === 0 ? (
        <EmptyState
          icon={Users}
          title={showingDisabled ? "ไม่มีบัญชีที่ปิดใช้งาน" : "ยังไม่มีบัญชีผู้ใช้"}
          description={
            showingDisabled
              ? "บัญชีที่ถูกปิดใช้งานจะมาอยู่ที่นี่ และเปิดกลับได้ทุกเมื่อ"
              : "เพิ่มบัญชีให้เจ้าหน้าที่ที่ต้องจัดการข้อมูล ITA/OIT"
          }
          action={showingDisabled ? undefined : <UserCreateButton />}
        />
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ชื่อ–สกุล</TableHead>
                <TableHead>อีเมล</TableHead>
                <TableHead className="w-32">บัญชี CMU</TableHead>
                <TableHead className="w-28">บทบาท</TableHead>
                <TableHead className="w-28">วันที่สร้าง</TableHead>
                <TableHead className="w-28 text-right">จัดการ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => {
                const fullName = `${user.prefix ?? ""}${user.firstname} ${user.lastname}`.trim();
                return (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">
                      {fullName}
                      {user.id === actor.id && (
                        <span className="ml-2 text-xs font-normal text-muted-foreground">
                          (บัญชีของคุณ)
                        </span>
                      )}
                      {!user.hasPassword && (
                        <span className="ml-2 text-xs font-normal text-muted-foreground">
                          (เข้าระบบด้วย CMU เท่านั้น)
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{user.email}</TableCell>
                    <TableCell className="text-muted-foreground">{user.cmuAccount}</TableCell>
                    <TableCell>
                      <RoleBadge role={user.role} />
                    </TableCell>
                    {/* พ.ศ. via lib/date.ts — never inline +543 */}
                    <TableCell className="tabular-nums text-muted-foreground">
                      {formatBEShort(user.createdAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      {showingDisabled ? (
                        <UserRestoreButton userId={user.id} name={fullName} />
                      ) : (
                        <div className="flex justify-end">
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
                          {/* No disable button on your own row — the action
                              refuses it anyway, so offering it would only
                              produce an error toast. */}
                          {user.id !== actor.id && (
                            <UserDisableButton userId={user.id} name={fullName} />
                          )}
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

/** Plain links, so each tab is bookmarkable and the list stays server-rendered. */
function FilterTab({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(buttonVariants({ variant: active ? "secondary" : "ghost", size: "sm" }))}
    >
      {children}
    </Link>
  );
}
