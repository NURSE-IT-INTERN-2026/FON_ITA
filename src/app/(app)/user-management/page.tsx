import { Users } from "lucide-react";
import type { Metadata } from "next";
import { EmptyState } from "@/components/misc/empty-state";
import { RoleBadge } from "@/components/misc/role-badge";
import { PageHeader } from "@/components/shell/page-header";
import { WarmTableHead, WarmTableSurface } from "@/components/shell/surfaces";
import { UserCreateButton, UserEditButton } from "@/components/users/user-form-dialog";
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
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </WarmTableSurface>
      )}
    </div>
  );
}
