import { forwardRef } from "react";
import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "accent" | "secondary" | "ghost" | "danger" | "outline";
type Size = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

const variantClasses: Record<Variant, string> = {
  primary: "bg-ink text-ink-on font-medium hover:opacity-90 focus-visible:ring-ink/40",
  accent:
    "bg-[image:var(--lh-accent-gradient)] text-accent-on font-medium shadow-[0_8px_20px_-8px_var(--lh-accent)] hover:brightness-105 focus-visible:ring-accent/50",
  secondary:
    "bg-card-elevated text-text-primary font-medium hover:bg-border/60 focus-visible:ring-border",
  outline:
    "bg-transparent text-text-primary border border-border hover:bg-card-elevated focus-visible:ring-border",
  ghost:
    "bg-transparent text-text-secondary hover:text-text-primary hover:bg-card-elevated focus-visible:ring-border",
  danger: "bg-error/10 text-error font-medium hover:bg-error/15 focus-visible:ring-error/40",
};

const sizeClasses: Record<Size, string> = {
  sm: "h-9 px-3.5 text-sm gap-1.5",
  md: "h-11 px-5 text-sm gap-2",
  lg: "h-12 px-6 text-base gap-2",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", type = "button", ...props }, ref) => {
    return (
      <button
        ref={ref}
        type={type}
        className={cn(
          "inline-flex items-center justify-center rounded-full transition-all duration-150",
          "disabled:opacity-50 disabled:pointer-events-none",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          variantClasses[variant],
          sizeClasses[size],
          className,
        )}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";
