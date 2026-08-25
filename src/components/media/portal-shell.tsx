"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { MEDIA_PORTAL_NAV, getActiveMediaHref } from "@/lib/media/portal-nav";
import { Avatar } from "@/components/ui/avatar";
import { UserMenu } from "@/components/layout/user-menu";
import { ThemeToggle } from "@/components/layout/theme-toggle";

interface PortalUser {
  name: string;
  email: string;
  avatarUrl: string | null;
  roleLabel: string;
}

function NavLinks({
  items,
  activeHref,
  onNavigate,
}: {
  items: typeof MEDIA_PORTAL_NAV;
  activeHref: string | null;
  onNavigate?: () => void;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      {items.map((item) => {
        const active = item.href === activeHref;
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-2.5 rounded-[10px] px-3 py-2 text-sm transition-colors",
              active
                ? "bg-card-elevated text-accent-light font-medium"
                : "text-text-secondary hover:bg-card hover:text-text-primary",
            )}
          >
            <Icon size={16} strokeWidth={1.75} />
            {item.label}
          </Link>
        );
      })}
    </div>
  );
}

export function MediaPortalShell({
  permissions,
  user,
  environmentName,
  children,
}: {
  permissions: string[];
  user: PortalUser;
  environmentName: string;
  children: React.ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const permissionSet = new Set(permissions);
  const items = MEDIA_PORTAL_NAV.filter((item) => !item.permission || permissionSet.has(item.permission));
  const activeHref = getActiveMediaHref(pathname, items);

  return (
    <div className="flex min-h-screen w-full bg-background">
      <aside className="hidden lg:flex w-64 shrink-0 flex-col border-r border-border bg-bg-secondary">
        <div className="flex h-16 items-center justify-between px-6">
          <div className="flex items-center gap-2.5">
            <div className="h-6 w-6 rounded-full bg-[image:var(--lh-accent-gradient)]" />
            <span className="text-[15px] font-bold tracking-wide text-text-primary">{environmentName}</span>
          </div>
          <ThemeToggle />
        </div>
        <nav className="scrollbar-thin flex-1 overflow-y-auto px-3 pb-6">
          <NavLinks items={items} activeHref={activeHref} />
        </nav>
        <div className="border-t border-border p-3">
          <UserMenu>
            <div className="flex w-full items-center gap-2.5 rounded-[10px] px-2 py-2 text-left hover:bg-card">
              <Avatar name={user.name} src={user.avatarUrl} size="sm" />
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-sm font-medium text-text-primary">{user.name}</span>
                <span className="truncate text-xs text-text-tertiary">{user.roleLabel}</span>
              </div>
            </div>
          </UserMenu>
        </div>
      </aside>

      <div className="flex min-h-screen flex-1 flex-col">
        <div className="flex h-14 items-center justify-between border-b border-border bg-bg-secondary px-4 lg:hidden">
          <span className="text-[15px] font-bold tracking-wide text-text-primary">{environmentName}</span>
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="rounded-[8px] p-2 text-text-secondary hover:bg-card"
              aria-label="Abrir menu"
            >
              <Menu size={20} />
            </button>
          </div>
        </div>

        {mobileOpen && (
          <div className="fixed inset-0 z-50 flex flex-col bg-background lg:hidden">
            <div className="flex h-14 items-center justify-between border-b border-border px-4">
              <span className="text-[15px] font-bold tracking-wide text-text-primary">{environmentName}</span>
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="rounded-[8px] p-2 text-text-secondary hover:bg-card"
                aria-label="Fechar menu"
              >
                <X size={20} />
              </button>
            </div>
            <nav className="scrollbar-thin flex-1 overflow-y-auto px-3 py-4">
              <NavLinks items={items} activeHref={activeHref} onNavigate={() => setMobileOpen(false)} />
            </nav>
          </div>
        )}

        <main className="scrollbar-thin flex-1 overflow-y-auto px-4 py-6 lg:px-8 lg:py-8">{children}</main>
      </div>
    </div>
  );
}
