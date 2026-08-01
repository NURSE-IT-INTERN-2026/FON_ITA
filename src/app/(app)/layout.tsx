import { AppHeader } from "@/components/shell/app-header";
import { AdminFooter } from "@/components/shell/admin-footer";
import { getSessionUser } from "@/lib/auth/session";

export default async function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Read-only: safe in a Server Component. Renders the signed-out shell when
  // null. These routes are not yet *protected* — that is F10 (proxy.ts) plus
  // the per-page checks in F11.
  const user = await getSessionUser();

  return (
    <div className="flex min-h-screen w-full flex-col">
      <AppHeader user={user} />
      <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8">
        <div className="mx-auto w-full max-w-screen-2xl">
          {children}
          {user && user.role !== "USER" && <AdminFooter user={user} />}
        </div>
      </main>
    </div>
  );
}
