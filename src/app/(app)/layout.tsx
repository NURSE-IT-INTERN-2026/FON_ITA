import { AppHeader } from "@/components/shell/app-header";
import { AdminFooter } from "@/components/shell/admin-footer";
import { requireUser } from "@/lib/auth/guards";

export default async function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Every route in this group requires a session, so the guard lives here
  // rather than being repeated in each page. This is the check that catches a
  // forged or expired cookie — proxy.ts only sees that a cookie exists.
  //
  // Per-role gates stay in the individual pages; a layout cannot know which
  // child route is rendering.
  const user = await requireUser();

  return (
    <div className="flex min-h-screen w-full flex-col">
      <AppHeader user={user} />
      <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8">
        <div className="mx-auto w-full max-w-screen-2xl">
          {children}
          {user.role !== "USER" && <AdminFooter user={user} />}
        </div>
      </main>
    </div>
  );
}
