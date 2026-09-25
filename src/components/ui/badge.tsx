import type { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

type Tone = "neutral" | "success" | "warning" | "error" | "info" | "accent";

const toneClasses: Record<Tone, string> = {
  neutral: "bg-card-elevated text-text-secondary",
  success: "bg-success/12 text-success",
  warning: "bg-warning/12 text-warning",
  error: "bg-error/12 text-error",
  info: "bg-info/12 text-info",
  accent: "bg-accent/12 text-accent-light",
};

const dotClasses: Record<Tone, string> = {
  neutral: "bg-text-tertiary",
  success: "bg-success",
  warning: "bg-warning",
  error: "bg-error",
  info: "bg-info",
  accent: "bg-accent",
};

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: Tone;
  dot?: boolean;
}

export function Badge({ className, tone = "neutral", dot = false, children, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium leading-none",
        toneClasses[tone],
        className,
      )}
      {...props}
    >
      {dot && <span className={cn("h-1.5 w-1.5 rounded-full", dotClasses[tone])} />}
      {children}
    </span>
  );
}

// Status "● Concluído" da referência: ponto colorido + texto neutro, sem fundo.
export function StatusDot({ tone = "neutral", children, className }: { tone?: Tone; children: React.ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2 whitespace-nowrap text-sm text-text-secondary", className)}>
      <span className={cn("h-2 w-2 rounded-full", dotClasses[tone])} />
      {children}
    </span>
  );
}
