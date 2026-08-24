"use client";

import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/cn";

// Sem estado em React: qual ícone mostrar é decidido via CSS a partir do
// atributo data-theme no <html> (evita mismatch de hidratação, já que o
// tema real só é conhecido depois do script inline em layout.tsx rodar).
export function ThemeToggle({ className }: { className?: string }) {
  return (
    <button
      type="button"
      onClick={() => {
        const html = document.documentElement;
        const next = html.dataset.theme === "light" ? "dark" : "light";
        html.dataset.theme = next;
        window.localStorage.setItem("lb-theme", next);
      }}
      className={cn(
        "flex h-8 w-8 items-center justify-center rounded-[8px] text-text-secondary hover:bg-card hover:text-text-primary",
        className,
      )}
      aria-label="Alternar entre modo dia e modo noite"
      title="Alternar tema"
    >
      <Sun size={16} strokeWidth={1.75} className="hidden [html[data-theme=light]_&]:block" />
      <Moon size={16} strokeWidth={1.75} className="hidden [html[data-theme=dark]_&]:block" />
    </button>
  );
}
