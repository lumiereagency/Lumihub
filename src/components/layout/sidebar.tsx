"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import { NAV_GROUPS, getActiveHref } from "@/lib/nav";
import { Avatar } from "@/components/ui/avatar";
import { UserMenu } from "@/components/layout/user-menu";
import { Wordmark } from "@/components/layout/logo";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { NotificationBell } from "@/components/notifications/notification-bell";

interface SidebarUser {
  name: string;
  email: string;
  avatarUrl: string | null;
  roleName: string;
}

// Recebe apenas as chaves de permissão (dado serializável) do Server Component
// pai e filtra a navegação localmente — componentes de ícone (funções) não
// podem atravessar a fronteira Server -> Client como props.
export function Sidebar({
  permissions,
  user,
}: {
  permissions: string[];
  user: SidebarUser;
}) {
  const pathname = usePathname();
  const permissionSet = new Set(permissions);
  const groups = NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => {
      if (!item.permission) return true;
      const required = Array.isArray(item.permission)
        ? item.permission
        : [item.permission];
      return required.some((p) => permissionSet.has(p));
    }),
  })).filter((group) => group.items.length > 0);
  const activeHref = getActiveHref(pathname, groups);
  // Grupos longos (ex: Mídia ADESF, 9 itens) começam recolhidos, a não ser
  // que a página atual esteja dentro deles.
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const isOpen = (label: string, hasActive: boolean, size: number) =>
    openGroups[label] ?? (size <= 5 || hasActive);
  // Em telas baixas os últimos grupos ficam abaixo da dobra: garante que o
  // item da página atual apareça ao navegar.
  const navRef = useRef<HTMLElement>(null);
  useEffect(() => {
    navRef.current
      ?.querySelector('[aria-current="page"]')
      ?.scrollIntoView({ block: "nearest" });
  }, [activeHref]);

  return (
    <aside className="sticky top-0 hidden h-screen w-[268px] shrink-0 p-3 lg:flex">
      <div className="flex w-full flex-col rounded-3xl border border-border bg-card">
        <div className="flex h-[68px] items-center justify-between px-5">
          <Wordmark />
          <div className="flex items-center gap-0.5">
            <NotificationBell placement="sidebar" />
            <ThemeToggle />
          </div>
        </div>
        <nav
          ref={navRef}
          className="scrollbar-thin relative flex-1 overflow-y-auto px-3 pb-6 [mask-image:linear-gradient(to_bottom,#000_calc(100%-28px),transparent)]">
          {groups.map((group) => {
            const hasActive = group.items.some(
              (item) => item.href === activeHref,
            );
            const collapsible = group.items.length > 5;
            const open = isOpen(group.label, hasActive, group.items.length);
            return (
              <div key={group.label} className="mb-4">
                {collapsible ? (
                  <button
                    type="button"
                    onClick={() =>
                      setOpenGroups((g) => ({ ...g, [group.label]: !open }))
                    }
                    aria-expanded={open}
                    className="flex w-full items-center justify-between rounded-full px-3 pb-1.5 pt-0.5 text-[11px] font-medium uppercase tracking-[0.08em] text-text-tertiary hover:text-text-secondary"
                  >
                    {group.label}
                    <ChevronDown
                      size={13}
                      className={cn(
                        "transition-transform",
                        open ? "rotate-0" : "-rotate-90",
                      )}
                    />
                  </button>
                ) : (
                  <p className="px-3 pb-1.5 text-[11px] font-medium uppercase tracking-[0.08em] text-text-tertiary">
                    {group.label}
                  </p>
                )}
                {open && (
                  <div className="flex flex-col gap-0.5">
                    {group.items.map((item) => {
                      const active = item.href === activeHref;
                      const Icon = item.icon;
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          aria-current={active ? "page" : undefined}
                          className={cn(
                            "flex items-center gap-3 rounded-full px-3.5 py-2 text-sm transition-colors",
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
                )}
              </div>
            );
          })}
        </nav>
        <div className="p-3">
          <UserMenu>
            <div className="flex w-full items-center gap-3 rounded-2xl bg-card-elevated px-3 py-2.5 text-left hover:bg-border/60">
              <Avatar name={user.name} src={user.avatarUrl} size="md" />
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-sm font-semibold text-text-primary">
                  {user.name}
                </span>
                <span className="truncate text-xs text-text-tertiary">
                  {user.roleName}
                </span>
              </div>
            </div>
          </UserMenu>
        </div>
      </div>
    </aside>
  );
}
