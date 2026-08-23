"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import { NAV_GROUPS, getActiveHref } from "@/lib/nav";
import { Avatar } from "@/components/ui/avatar";
import { UserMenu } from "@/components/layout/user-menu";

interface SidebarUser {
  name: string;
  email: string;
  avatarUrl: string | null;
  roleName: string;
}

// Recebe apenas as chaves de permissão (dado serializável) do Server Component
// pai e filtra a navegação localmente — componentes de ícone (funções) não
// podem atravessar a fronteira Server -> Client como props.
export function Sidebar({ permissions, user }: { permissions: string[]; user: SidebarUser }) {
  const pathname = usePathname();
  const permissionSet = new Set(permissions);
  const groups = NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => !item.permission || permissionSet.has(item.permission)),
  })).filter((group) => group.items.length > 0);
  const activeHref = getActiveHref(pathname, groups);

  return (
    <aside className="hidden lg:flex w-64 shrink-0 flex-col border-r border-border bg-bg-secondary">
      <div className="flex h-16 items-center px-6">
        <span className="text-lg font-semibold tracking-tight text-gold-light">LUMIBASE</span>
      </div>
      <nav className="scrollbar-thin flex-1 overflow-y-auto px-3 pb-6">
        {groups.map((group) => (
          <div key={group.label} className="mb-5">
            <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">
              {group.label}
            </p>
            <div className="flex flex-col gap-0.5">
              {group.items.map((item) => {
                const active = item.href === activeHref;
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-2.5 rounded-[10px] px-3 py-2 text-sm transition-colors",
                      active
                        ? "bg-card-elevated text-gold-light font-medium"
                        : "text-text-secondary hover:bg-card hover:text-text-primary",
                    )}
                  >
                    <Icon size={16} strokeWidth={1.75} />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
      <div className="border-t border-border p-3">
        <UserMenu>
          <div className="flex w-full items-center gap-2.5 rounded-[10px] px-2 py-2 text-left hover:bg-card">
            <Avatar name={user.name} src={user.avatarUrl} size="sm" />
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-sm font-medium text-text-primary">{user.name}</span>
              <span className="truncate text-xs text-text-tertiary">{user.roleName}</span>
            </div>
          </div>
        </UserMenu>
      </div>
    </aside>
  );
}
