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
  // A aba mais específica vence: em /crm/servicos só "Serviços" fica ativa, não "Funil" (/crm).
  const activeHref = tabs
    .filter((t) => pathname === t.href || pathname.startsWith(`${t.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;

  return (
    <div className="scrollbar-thin mb-6 flex w-fit max-w-full gap-1 overflow-x-auto rounded-full border border-border bg-card p-1">
      {tabs.map((tab) => {
        const active = tab.href === activeHref;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "shrink-0 whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition-colors",
              active ? "bg-ink text-ink-on" : "text-text-secondary hover:text-text-primary",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
