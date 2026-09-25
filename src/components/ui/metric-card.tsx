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
// pílula de tendência e legenda. `accent` é o card em destaque (laranja).
export function MetricCard({ label, value, trend, caption, icon, tone = "default", className, children }: MetricCardProps) {
  const accent = tone === "accent";
  return (
    <div
      className={cn(
        "flex flex-col gap-4 rounded-2xl p-5",
        accent ? "bg-[image:var(--lh-accent-gradient)] text-white" : "border border-border bg-card",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span className={cn("text-sm", accent ? "text-white/85" : "text-text-secondary")}>{label}</span>
        {icon && (
          <span
            className={cn(
              "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border [&_svg]:h-4 [&_svg]:w-4",
              accent ? "border-white/30 text-white" : "border-border text-text-secondary",
            )}
          >
            {icon}
          </span>
        )}
      </div>
      <span className={cn("text-[30px] font-semibold leading-none tracking-tight", !accent && "text-text-primary")}>
        {value}
      </span>
      {(trend || caption) && (
        <div className="flex items-center gap-2 text-xs">
          {trend && (
            <span
              className={cn(
                "inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 font-medium",
                accent
                  ? "bg-white/20 text-white"
                  : trend.positive
                    ? "bg-success/12 text-success"
                    : "bg-error/12 text-error",
              )}
            >
              {trend.positive ? <ArrowUp size={11} /> : <ArrowDown size={11} />}
              {trend.value}
            </span>
          )}
          {caption && <span className={accent ? "text-white/80" : "text-text-tertiary"}>{caption}</span>}
        </div>
      )}
      {children}
    </div>
  );
}
