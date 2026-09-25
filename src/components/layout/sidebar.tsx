"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import { NAV_GROUPS, getActiveHref } from "@/lib/nav";
import { Avatar } from "@/components/ui/avatar";
import { UserMenu } from "@/components/layout/user-menu";
import { Wordmark } from "@/components/layout/logo";
import { ThemeToggle } from "@/components/layout/theme-toggle";

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
    items: group.items.filter((item) => {
      if (!item.permission) return true;
      const required = Array.isArray(item.permission) ? item.permission : [item.permission];
      return required.some((p) => permissionSet.has(p));
    }),
  })).filter((group) => group.items.length > 0);
  const activeHref = getActiveHref(pathname, groups);

  return (
    <aside className="sticky top-0 hidden h-screen w-[268px] shrink-0 p-3 lg:flex">
      <div className="flex w-full flex-col rounded-3xl border border-border bg-card">
        <div className="flex h-[68px] items-center justify-between px-5">
          <Wordmark />
          <ThemeToggle />
        </div>
        <nav className="scrollbar-thin flex-1 overflow-y-auto px-3 pb-4">
          {groups.map((group) => (
            <div key={group.label} className="mb-5">
              <p className="px-3 pb-2 text-[11px] font-medium uppercase tracking-[0.08em] text-text-tertiary">
                {group.label}
              </p>
              <div className="flex flex-col gap-1">
                {group.items.map((item) => {
                  const active = item.href === activeHref;
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        "flex items-center gap-3 rounded-full px-3.5 py-2.5 text-sm transition-colors",
                        active
                          ? "bg-ink font-medium text-ink-on"
                          : "text-text-secondary hover:bg-card-elevated hover:text-text-primary",
                      )}
                    >
                      <Icon size={17} strokeWidth={1.75} />
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
        <div className="p-3">
          <UserMenu>
            <div className="flex w-full items-center gap-3 rounded-2xl bg-card-elevated px-3 py-2.5 text-left hover:bg-border/60">
              <Avatar name={user.name} src={user.avatarUrl} size="md" />
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-sm font-semibold text-text-primary">{user.name}</span>
                <span className="truncate text-xs text-text-tertiary">{user.roleName}</span>
              </div>
            </div>
          </UserMenu>
        </div>
      </div>
    </aside>
  );
}
