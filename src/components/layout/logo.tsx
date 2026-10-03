import { cn } from "@/lib/cn";
import { GOLD_STOPS, RING } from "@/lib/brand/rings";

// Marca LUMI: duas alianças entrelaçadas em ouro metálico (mesma peça do
// Guia, do orçamento e do contrato). O id precisa ser único na página: a
// sidebar (escondida no celular) e o topo mobile renderizam a logo juntos.
export function Logo({
  size = "md",
  className,
  gradientId = "lb-logo-mark",
}: {
  size?: "sm" | "md" | "lg";
  className?: string;
  gradientId?: string;
}) {
  const dims = { sm: { w: 30, h: 20 }, md: { w: 36, h: 24 }, lg: { w: 84, h: 56 } }[size];
  // Em tamanho pequeno o traço engrossa um pouco para não sumir.
  const stroke = size === "lg" ? RING.stroke : 11;
  const gap = size === "lg" ? RING.gap : 1.3;
  const cut = stroke + 2 * gap;
  const { r, cy, left: L, right: R, crossTop: T, crossBottom: B } = RING;
  const id = gradientId;

  return (
    <svg width={dims.w} height={dims.h} viewBox="4 -2 112 76" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={`${id}-g`} x1="10" y1="6" x2="110" y2="70" gradientUnits="userSpaceOnUse">
          {GOLD_STOPS.map((s) => (
            <stop key={s.offset} offset={s.offset} stopColor={s.color} />
          ))}
        </linearGradient>
        <clipPath id={`${id}-ct`}>
          <circle cx="60" cy={T} r="14" />
        </clipPath>
        <clipPath id={`${id}-cb`}>
          <circle cx="60" cy={B} r="14" />
        </clipPath>
        <mask id={`${id}-mr`} maskUnits="userSpaceOnUse" x="-10" y="-10" width="140" height="92">
          <rect x="-10" y="-10" width="140" height="92" fill="#fff" />
          <g clipPath={`url(#${id}-ct)`}>
            <circle cx={L} cy={cy} r={r} stroke="#000" strokeWidth={cut} />
          </g>
        </mask>
        <mask id={`${id}-ml`} maskUnits="userSpaceOnUse" x="-10" y="-10" width="140" height="92">
          <rect x="-10" y="-10" width="140" height="92" fill="#fff" />
          <g clipPath={`url(#${id}-cb)`}>
            <circle cx={R} cy={cy} r={r} stroke="#000" strokeWidth={cut} />
          </g>
        </mask>
      </defs>
      <circle cx={L} cy={cy} r={r} stroke={`url(#${id}-g)`} strokeWidth={stroke} mask={`url(#${id}-ml)`} />
      <circle cx={R} cy={cy} r={r} stroke={`url(#${id}-g)`} strokeWidth={stroke} mask={`url(#${id}-mr)`} />
    </svg>
  );
}

export function Wordmark({ className, gradientId }: { className?: string; gradientId?: string }) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <Logo size="sm" gradientId={gradientId} />
      <span className="pl-[0.16em] text-[14px] font-semibold tracking-[0.16em] text-text-primary">LUMIBASE</span>
    </div>
  );
}
