"use client";

import type { ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  widthClassName?: string;
}

export function Drawer({ open, onClose, title, description, children, widthClassName }: DrawerProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        aria-label="Fechar"
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-[1px]"
      />
      <div
        className={cn(
          "scrollbar-thin relative flex h-full w-full flex-col overflow-y-auto border-l border-border bg-bg-secondary p-6",
          widthClassName ?? "max-w-[480px]",
        )}
      >
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-text-primary">{title}</h2>
            {description && <p className="mt-1 text-sm text-text-tertiary">{description}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-[8px] p-1.5 text-text-tertiary hover:bg-card hover:text-text-primary"
            aria-label="Fechar"
          >
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
