import { forwardRef } from "react";
import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "outline";
type Size = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

const variantClasses: Record<Variant, string> = {
  primary:
    "bg-[image:var(--lh-accent-gradient)] text-accent-on shadow-[0_8px_20px_-6px_var(--lh-accent)] hover:brightness-110 focus-visible:ring-accent/50 font-semibold",
  secondary:
    "bg-card-elevated text-text-primary hover:bg-[#232326] border border-border focus-visible:ring-border",
  outline:
    "bg-transparent text-text-primary border border-border hover:bg-card focus-visible:ring-border",
  ghost:
    "bg-transparent text-text-secondary hover:text-text-primary hover:bg-card focus-visible:ring-border",
  danger: "bg-error text-white hover:bg-error/90 focus-visible:ring-error/50",
};

const sizeClasses: Record<Size, string> = {
  sm: "h-8 px-3 text-sm gap-1.5",
  md: "h-10 px-4 text-sm gap-2",
  lg: "h-12 px-6 text-base gap-2",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", type = "button", ...props }, ref) => {
    return (
      <button
        ref={ref}
        type={type}
        className={cn(
          "inline-flex items-center justify-center rounded-[12px] transition-all duration-150",
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
