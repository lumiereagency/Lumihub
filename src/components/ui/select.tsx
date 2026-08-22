import { forwardRef, useId } from "react";
import type { SelectHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, error, id, children, ...props }, ref) => {
    const generatedId = useId();
    const selectId = id ?? generatedId;

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={selectId} className="text-sm font-medium text-text-secondary">
            {label}
          </label>
        )}
        <select
          ref={ref}
          id={selectId}
          className={cn(
            "h-10 w-full rounded-[10px] border border-border bg-card px-3 text-sm text-text-primary",
            "focus:outline-none focus:ring-2 focus:ring-gold/40 focus:border-gold/60",
            error && "border-error focus:ring-error/40 focus:border-error",
            className,
          )}
          {...props}
        >
          {children}
        </select>
        {error && <p className="text-xs text-error">{error}</p>}
      </div>
    );
  },
);
Select.displayName = "Select";
