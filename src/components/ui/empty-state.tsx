import type { ReactNode } from "react";
import { Inbox } from "lucide-react";
import { cn } from "@/lib/cn";

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

// Estado vazio leve: contorno tracejado em vez de caixa cinza, para não
// virar "um cartão dentro do cartão" quando aparece dentro de um Card.
// Sem descrição nem ação, fica compacto (uma linha com ícone).
export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  const compact = !description && !action;
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-2xl border border-dashed border-border text-center",
        compact ? "gap-2 px-5 py-8" : "gap-3 px-6 py-12",
        className,
      )}
    >
      <div
        className={cn(
          "flex items-center justify-center rounded-full bg-card-elevated text-text-tertiary [&_svg]:h-[18px] [&_svg]:w-[18px]",
          compact ? "h-9 w-9" : "h-12 w-12 [&_svg]:h-5 [&_svg]:w-5",
        )}
      >
        {icon ?? <Inbox />}
      </div>
      <p className={cn("text-text-primary", compact ? "text-sm text-text-secondary" : "text-[15px] font-medium")}>{title}</p>
      {description && <p className="max-w-sm text-sm text-text-tertiary">{description}</p>}
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}
