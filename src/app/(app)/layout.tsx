import { AppHeader } from "@/components/shell/app-header";
import { AdminFooter } from "@/components/shell/admin-footer";
import { getSessionUser } from "@/lib/auth/session";

export default async function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Read-only. This group holds both public pages (ITA/OIT browsing — D12) and
  // staff pages, so the layout cannot demand a session; `null` renders the
  // signed-out shell with a "เข้าสู่ระบบ" button.
  //
  // Pages that DO need one call requireUser() / requireRole() themselves — the
  // guard belongs where the requirement is known.
  const user = await getSessionUser();

  return (
    <div className="flex min-h-screen w-full flex-col">
      <AppHeader user={user} />
      <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8">
        <div className="mx-auto w-full max-w-screen-2xl">
          {children}
          {user && <AdminFooter user={user} />}
        </div>
      </main>
    </div>
  );
}
