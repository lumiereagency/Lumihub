"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { NAV_GROUPS, getActiveHref } from "@/lib/nav";
import { Wordmark } from "@/components/layout/logo";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { NotificationBell } from "@/components/notifications/notification-bell";

export function MobileNav({ permissions }: { permissions: string[] }) {
  const [open, setOpen] = useState(false);
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
    <>
      <div className="sticky top-0 z-40 px-3 pt-3 lg:hidden">
        <div className="flex h-14 items-center justify-between rounded-full border border-border bg-card pl-5 pr-2">
          <Wordmark gradientId="lb-logo-mark-mobile" />
          <div className="flex items-center gap-1.5">
            <NotificationBell placement="mobile" />
            <ThemeToggle />
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-ink text-ink-on"
              aria-label="Abrir menu"
            >
              <Menu size={18} />
            </button>
          </div>
        </div>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex flex-col bg-background lg:hidden">
          <div className="flex h-16 items-center justify-between px-5">
            <Wordmark gradientId="lb-logo-mark-mobile" />
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-border text-text-secondary hover:bg-card-elevated/50"
              aria-label="Fechar menu"
            >
              <X size={20} />
            </button>
          </div>
          <nav className="scrollbar-thin flex-1 overflow-y-auto px-3 py-4">
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
                        onClick={() => setOpen(false)}
                        className={cn(
                          "flex items-center gap-3 rounded-full px-4 py-3 text-[15px]",
                          active
                            ? "bg-ink font-medium text-ink-on"
                            : "text-text-secondary hover:bg-card hover:text-text-primary",
                        )}
                      >
                        <Icon size={18} strokeWidth={1.75} />
                        {item.label}
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>
        </div>
      )}
    </>
  );
}
