"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

export interface SectionTab {
  label: string;
  href: string;
}

// Navegação lateral entre páginas que hoje foram agrupadas numa única
// entrada do menu (§ pedido do usuário: "muitas abas... e não precisar
// ficar toda hora entrando nas abas" — CRM+Propostas, Projetos+Tarefas, e
// os dois blocos do Financeiro). As rotas continuam existindo e
// funcionando exatamente como antes; isso só troca o menu lateral por uma
// navegação em abas dentro da própria página, sem quebrar link nenhum.
export function SectionTabs({ tabs }: { tabs: SectionTab[] }) {
  const pathname = usePathname();
  if (tabs.length <= 1) return null;

  return (
    <div className="mb-6 flex gap-1 border-b border-border">
      {tabs.map((tab) => {
        const active = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "border-b-2 px-3.5 py-2.5 text-sm font-medium transition-colors -mb-px",
              active
                ? "border-accent text-text-primary"
                : "border-transparent text-text-tertiary hover:text-text-secondary",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
