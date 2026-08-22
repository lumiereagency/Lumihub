"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { NAV_GROUPS, getActiveHref } from "@/lib/nav";

export function MobileNav({ permissions }: { permissions: string[] }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const permissionSet = new Set(permissions);
  const groups = NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => !item.permission || permissionSet.has(item.permission)),
  })).filter((group) => group.items.length > 0);
  const activeHref = getActiveHref(pathname, groups);

  return (
    <>
      <div className="flex h-14 items-center justify-between border-b border-border bg-bg-secondary px-4 lg:hidden">
        <span className="text-base font-semibold tracking-tight text-gold-light">LUMIHUB</span>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-[8px] p-2 text-text-secondary hover:bg-card"
          aria-label="Abrir menu"
        >
          <Menu size={20} />
        </button>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex flex-col bg-background lg:hidden">
          <div className="flex h-14 items-center justify-between border-b border-border px-4">
            <span className="text-base font-semibold tracking-tight text-gold-light">LUMIHUB</span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-[8px] p-2 text-text-secondary hover:bg-card"
              aria-label="Fechar menu"
            >
              <X size={20} />
            </button>
          </div>
          <nav className="scrollbar-thin flex-1 overflow-y-auto px-3 py-4">
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
                        onClick={() => setOpen(false)}
                        className={cn(
                          "flex items-center gap-2.5 rounded-[10px] px-3 py-2.5 text-sm",
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
        </div>
      )}
    </>
  );
}
