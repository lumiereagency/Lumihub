import { redirect } from "next/navigation";
import { requireUser, hasPermission } from "@/lib/auth/guard";
import { permKey } from "@/lib/auth/permissions";
import { Sidebar } from "@/components/layout/sidebar";
import { MobileNav } from "@/components/layout/mobile-nav";

// Toda a área autenticada depende de sessão/RBAC em tempo real — nunca deve
// ser servida a partir de um cache estático.
export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();

  // Usuário sem NENHUM acesso ao LUMIBASE (ex: voluntário de mídia puro,
  // convidado só para o Portal Mídia ADESF) não deve conseguir navegar pelas
  // rotas do LUMIBASE mesmo entrando pelo /login normal — enforced aqui, no
  // layout, e não só no redirect pós-login, para cobrir qualquer rota deste
  // grupo diretamente por URL.
  if (!hasPermission(user, permKey("DASHBOARD", "VIEW")) && user.media) {
    redirect("/midia/inicio");
  }

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
