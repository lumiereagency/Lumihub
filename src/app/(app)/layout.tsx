import { requireUser } from "@/lib/auth/guard";
import { Sidebar } from "@/components/layout/sidebar";
import { MobileNav } from "@/components/layout/mobile-nav";

// Toda a área autenticada depende de sessão/RBAC em tempo real — nunca deve
// ser servida a partir de um cache estático.
export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const permissions = Array.from(user.permissions);

  return (
    <div className="flex min-h-screen w-full bg-background">
      <Sidebar
        permissions={permissions}
        user={{ name: user.name, email: user.email, avatarUrl: user.avatarUrl, roleName: user.role.name }}
      />
      <div className="flex min-h-screen flex-1 flex-col">
        <MobileNav permissions={permissions} />
        <main className="scrollbar-thin flex-1 overflow-y-auto px-4 py-6 lg:px-8 lg:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
