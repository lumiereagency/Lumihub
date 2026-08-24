import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

interface MetricCardProps {
  label: string;
  value: string;
  trend?: { value: string; positive: boolean } | null;
  icon?: ReactNode;
  tone?: "default" | "accent";
  className?: string;
}

export function MetricCard({ label, value, trend, icon, tone = "default", className }: MetricCardProps) {
  return (
    <div
      className={cn(
        "rounded-2xl border p-5 flex flex-col gap-3",
        tone === "accent" ? "border-accent/25 bg-card-elevated" : "border-border bg-card",
        className,
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-sm text-text-secondary">{label}</span>
        {icon && (
          <span className={cn("text-text-tertiary", tone === "accent" && "text-accent")}>{icon}</span>
        )}
      </div>
      <span
        className={cn(
          "lb-figures text-[28px] leading-tight font-semibold tracking-tight",
          tone === "accent" ? "lb-accent-text" : "text-text-primary",
        )}
      >
        {value}
      </span>
      {trend && (
        <span className={cn("text-xs font-medium", trend.positive ? "text-success" : "text-error")}>
          {trend.positive ? "▲" : "▼"} {trend.value}
        </span>
      )}
    </div>
  );
}
