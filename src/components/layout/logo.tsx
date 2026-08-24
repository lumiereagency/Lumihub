import { cn } from "@/lib/cn";

// Mark da marca: duas argolas sobrepostas em gradiente (vermelho ember →
// laranja → pêssego), a mesma proporção da logo real da Lumière — usado como
// o único elemento gráfico colorido ao lado do wordmark neutro.
export function Logo({ size = "md", className }: { size?: "sm" | "md" | "lg"; className?: string }) {
  const dims = { sm: { w: 20, h: 12 }, md: { w: 26, h: 16 }, lg: { w: 72, h: 44 } }[size];
  const strokeWidth = size === "lg" ? 11 : size === "md" ? 13 : 14;

  return (
    <svg
      width={dims.w}
      height={dims.h}
      viewBox="0 0 120 72"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="lb-logo-mark" x1="0" y1="10" x2="120" y2="62" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="var(--lh-accent-deep)" />
          <stop offset="0.55" stopColor="var(--lh-accent)" />
          <stop offset="1" stopColor="var(--lh-accent-light)" />
        </linearGradient>
      </defs>
      <circle cx="36" cy="36" r="27" stroke="url(#lb-logo-mark)" strokeWidth={strokeWidth} />
      <circle cx="84" cy="36" r="27" stroke="url(#lb-logo-mark)" strokeWidth={strokeWidth} />
    </svg>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <Logo size="sm" />
      <span className="text-[15px] font-bold tracking-wide text-text-primary">LUMIBASE</span>
    </div>
  );
}
