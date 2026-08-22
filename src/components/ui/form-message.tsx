import { AlertCircle, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/cn";

export function FormMessage({ error, success }: { error?: string; success?: string }) {
  if (!error && !success) return null;
  const isError = !!error;
  return (
    <div
      role={isError ? "alert" : "status"}
      className={cn(
        "flex items-start gap-2 rounded-[10px] border px-3 py-2.5 text-sm",
        isError
          ? "border-error/30 bg-error/10 text-error"
          : "border-success/30 bg-success/10 text-success",
      )}
    >
      {isError ? (
        <AlertCircle size={16} className="mt-0.5 shrink-0" />
      ) : (
        <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
      )}
      <span>{error ?? success}</span>
    </div>
  );
}
