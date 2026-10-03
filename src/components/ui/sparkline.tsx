import { cn } from "@/lib/cn";

interface SparklineProps {
  values: number[];
  labels: string[];
  formatValue?: (v: number) => string;
  inverted?: boolean;
  ariaLabel: string;
  className?: string;
}

const W = 240;
const H = 52;
const PAD = 6;

// Tendência de uma série só: histórico em tom discreto, ponto atual no
// acento. Cada coluna tem um alvo invisível com <title> para o hover.
export function Sparkline({ values, labels, formatValue = String, inverted = false, ariaLabel, className }: SparklineProps) {
  if (values.length < 2) return null;
  const max = Math.max(...values, 1);
  const step = (W - PAD * 2) / (values.length - 1);
  const points = values.map((v, i) => [PAD + i * step, H - PAD - (v / max) * (H - PAD * 2)] as const);
  const line = points.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = `${line} L${points[points.length - 1][0].toFixed(1)},${H - PAD} L${PAD},${H - PAD} Z`;
  const [lastX, lastY] = points[points.length - 1];

  // "inverted" = desenhado sobre o card em destaque: usa a cor de texto sobre destaque.
  const stroke = inverted ? "color-mix(in srgb, var(--lh-accent-on) 70%, transparent)" : "var(--lh-text-tertiary)";
  const wash = inverted ? "color-mix(in srgb, var(--lh-accent-on) 12%, transparent)" : "var(--lh-text-tertiary)";
  const dot = inverted ? "var(--lh-accent-on)" : "var(--lh-accent)";
  const ring = inverted ? "var(--lh-accent)" : "var(--lh-card)";

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={cn("block h-auto w-full overflow-visible", className)} role="img" aria-label={ariaLabel}>
      <path d={area} fill={wash} fillOpacity={inverted ? 1 : 0.1} />
      <path d={line} fill="none" stroke={stroke} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      <circle cx={lastX} cy={lastY} r={4} fill={dot} stroke={ring} strokeWidth={2} vectorEffect="non-scaling-stroke" />
      {points.map(([x], i) => (
        <rect key={i} x={x - step / 2} y={0} width={step} height={H} fill="transparent">
          <title>{`${labels[i]}: ${formatValue(values[i])}`}</title>
        </rect>
      ))}
    </svg>
  );
}
