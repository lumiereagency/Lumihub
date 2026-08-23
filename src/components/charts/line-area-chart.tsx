import { formatCurrency } from "@/lib/format";
import { CATEGORICAL_COLORS, CHART_GRID_COLOR, CHART_MUTED_TEXT, CHART_PRIMARY_TEXT } from "./colors";
import { EmptyState } from "@/components/ui/empty-state";

interface SeriesPoint {
  label: string;
  balance: number;
}

const WIDTH = 720;
const HEIGHT = 260;
const PADDING_LEFT = 72;
const PADDING_RIGHT = 12;
const PADDING_BOTTOM = 28;
const PADDING_TOP = 20;

export function LineAreaChart({
  data,
  currency,
  emptyLabel = "Sem dados suficientes para projetar.",
}: {
  data: SeriesPoint[];
  currency: string;
  emptyLabel?: string;
}) {
  if (data.length < 2) {
    return <EmptyState title={emptyLabel} />;
  }

  const values = data.map((d) => d.balance);
  const rawMax = Math.max(...values, 0);
  const rawMin = Math.min(...values, 0);
  const span = rawMax - rawMin || 1;
  const max = rawMax + span * 0.1;
  const min = rawMin - span * 0.1;
  const range = max - min || 1;

  const plotWidth = WIDTH - PADDING_LEFT - PADDING_RIGHT;
  const plotHeight = HEIGHT - PADDING_TOP - PADDING_BOTTOM;
  const stepX = plotWidth / (data.length - 1);

  const xAt = (i: number) => PADDING_LEFT + i * stepX;
  const yAt = (v: number) => PADDING_TOP + plotHeight - ((v - min) / range) * plotHeight;
  const zeroY = yAt(0);

  const linePath = data.map((d, i) => `${i === 0 ? "M" : "L"} ${xAt(i)} ${yAt(d.balance)}`).join(" ");
  const areaPath = `${linePath} L ${xAt(data.length - 1)} ${zeroY} L ${xAt(0)} ${zeroY} Z`;

  const gridSteps = 4;
  const gridLines = Array.from({ length: gridSteps + 1 }, (_, i) => {
    const value = min + (range / gridSteps) * i;
    return { value, y: yAt(value) };
  });

  const color = CATEGORICAL_COLORS[0];
  const labelEvery = data.length > 8 ? 2 : 1;
  const finalPoint = data[data.length - 1];

  return (
    <div className="flex flex-col gap-2">
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="w-full" role="img" aria-label="Projeção de saldo de caixa">
        {gridLines.map((g) => (
          <g key={g.value}>
            <line x1={PADDING_LEFT} x2={WIDTH - PADDING_RIGHT} y1={g.y} y2={g.y} stroke={CHART_GRID_COLOR} strokeWidth={1} />
            <text x={PADDING_LEFT - 8} y={g.y + 3} textAnchor="end" fontSize={10} fill={CHART_MUTED_TEXT}>
              {formatCurrency(g.value, currency).replace(/,00$/, "")}
            </text>
          </g>
        ))}

        {min < 0 && max > 0 && (
          <line x1={PADDING_LEFT} x2={WIDTH - PADDING_RIGHT} y1={zeroY} y2={zeroY} stroke={CHART_MUTED_TEXT} strokeWidth={1} strokeDasharray="3 3" />
        )}

        <path d={areaPath} fill={color} fillOpacity={0.12} stroke="none" />
        <path d={linePath} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />

        {data.map((d, i) => (
          <g key={d.label}>
            <circle cx={xAt(i)} cy={yAt(d.balance)} r={3.5} fill={color}>
              <title>{`${d.label}: ${formatCurrency(d.balance, currency)}`}</title>
            </circle>
            {i % labelEvery === 0 && (
              <text x={xAt(i)} y={HEIGHT - 8} textAnchor="middle" fontSize={10} fill={CHART_MUTED_TEXT}>
                {d.label}
              </text>
            )}
          </g>
        ))}

        <text x={xAt(data.length - 1)} y={yAt(finalPoint.balance) - 10} textAnchor="end" fontSize={11} fill={CHART_PRIMARY_TEXT} fontWeight={500}>
          {formatCurrency(finalPoint.balance, currency)}
        </text>
      </svg>
    </div>
  );
}
