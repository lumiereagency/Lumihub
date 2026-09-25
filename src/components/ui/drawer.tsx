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
        className="absolute inset-0 bg-black/50 backdrop-blur-[2px]"
      />
      <div
        className={cn(
          "scrollbar-thin relative flex h-full w-full flex-col overflow-y-auto bg-card p-6 sm:m-3 sm:h-[calc(100%-1.5rem)] sm:rounded-3xl sm:border sm:border-border",
          widthClassName ?? "max-w-[480px]",
        )}
      >
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold tracking-tight text-text-primary">{title}</h2>
            {description && <p className="mt-1 text-sm text-text-tertiary">{description}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border text-text-tertiary hover:bg-card-elevated hover:text-text-primary"
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
