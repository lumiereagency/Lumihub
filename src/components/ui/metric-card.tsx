import type { ReactNode } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import { cn } from "@/lib/cn";

interface MetricCardProps {
  label: string;
  value: string;
  trend?: { value: string; positive: boolean } | null;
  caption?: string;
  icon?: ReactNode;
  tone?: "default" | "accent";
  className?: string;
  children?: ReactNode;
}

// Widget da referência: rótulo + ícone em chip redondo, número grande,
// pílula de tendência e legenda. `accent` é o card em destaque (dourado, texto escuro).
export function MetricCard({ label, value, trend, caption, icon, tone = "default", className, children }: MetricCardProps) {
  const accent = tone === "accent";
  const numeric = /\d/.test(value);
  // Valores longos ("R$ 10.507,00") encolhem para caber no cartão em vez de
  // estourar no grid de 2 colunas do celular (cqi = largura útil do cartão).
  const fit = numeric ? { fontSize: `min(30px, calc(100cqi / ${(Math.max(value.length, 6) * 0.58).toFixed(2)}))` } : undefined;
  return (
    <div
      className={cn(
        "@container flex flex-col gap-4 rounded-2xl p-5",
        accent ? "bg-[image:var(--lh-accent-gradient)] text-accent-on" : "border border-border bg-card",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span className={cn("text-sm", accent ? "text-accent-on/75" : "text-text-secondary")}>{label}</span>
        {icon && (
          <span
            className={cn(
              "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border [&_svg]:h-4 [&_svg]:w-4",
              accent ? "border-accent-on/25 text-accent-on" : "border-border text-text-secondary",
            )}
          >
            {icon}
          </span>
        )}
      </div>
      {/* Valor em texto ("Indisponível", "Nenhum agendado") fica menor e discreto, sem quebrar a linha dos cartões. */}
      <span
        className={cn(
          "lb-figures font-semibold leading-none tracking-tight",
          numeric ? "whitespace-nowrap text-[30px]" : "text-lg leading-snug",
          !accent && (numeric ? "text-text-primary" : "text-text-secondary"),
        )}
        style={fit}
      >
        {value}
      </span>
      {(trend || caption) && (
        <div className="flex items-center gap-2 text-xs">
          {trend && (
            <span
              className={cn(
                "inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 font-medium",
                accent
                  ? "bg-accent-on/12 text-accent-on"
                  : trend.positive
                    ? "bg-success/12 text-success"
                    : "bg-error/12 text-error",
              )}
            >
              {trend.positive ? <ArrowUp size={11} /> : <ArrowDown size={11} />}
              {trend.value}
            </span>
          )}
          {caption && <span className={accent ? "text-accent-on/70" : "text-text-tertiary"}>{caption}</span>}
        </div>
      )}
      {children}
    </div>
  );
}
