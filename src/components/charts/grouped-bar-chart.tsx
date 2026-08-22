import { formatCurrency } from "@/lib/format";
import { CATEGORICAL_COLORS, CHART_GRID_COLOR, CHART_MUTED_TEXT } from "./colors";
import { EmptyState } from "@/components/ui/empty-state";

interface MonthPoint {
  label: string;
  receita: number;
  despesa: number;
}

const WIDTH = 640;
const HEIGHT = 240;
const PADDING_LEFT = 56;
const PADDING_BOTTOM = 28;
const PADDING_TOP = 16;

export function GroupedBarChart({
  data,
  currency,
  seriesLabels = ["Receita", "Despesa"],
}: {
  data: MonthPoint[];
  currency: string;
  seriesLabels?: [string, string];
}) {
  const max = Math.max(...data.flatMap((d) => [d.receita, d.despesa]), 1);
  const hasData = data.some((d) => d.receita > 0 || d.despesa > 0);

  if (!hasData) {
    return <EmptyState title="Sem movimentações pagas nos últimos 6 meses" />;
  }

  const plotWidth = WIDTH - PADDING_LEFT - 8;
  const plotHeight = HEIGHT - PADDING_TOP - PADDING_BOTTOM;
  const groupWidth = plotWidth / data.length;
  const barWidth = Math.min(22, groupWidth / 3);
  const gap = 4;

  const gridSteps = 4;
  const gridLines = Array.from({ length: gridSteps + 1 }, (_, i) => {
    const value = (max / gridSteps) * i;
    const y = PADDING_TOP + plotHeight - (value / max) * plotHeight;
    return { value, y };
  });

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-4 text-xs text-text-secondary">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: CATEGORICAL_COLORS[0] }} />
          {seriesLabels[0]}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: CATEGORICAL_COLORS[1] }} />
          {seriesLabels[1]}
        </span>
      </div>
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="w-full" role="img" aria-label="Receita e despesa por mês">
        {gridLines.map((g) => (
          <g key={g.value}>
            <line x1={PADDING_LEFT} x2={WIDTH} y1={g.y} y2={g.y} stroke={CHART_GRID_COLOR} strokeWidth={1} />
            <text x={PADDING_LEFT - 8} y={g.y + 3} textAnchor="end" fontSize={10} fill={CHART_MUTED_TEXT}>
              {formatCurrency(g.value, currency).replace(/,00$/, "")}
            </text>
          </g>
        ))}

        {data.map((d, i) => {
          const groupX = PADDING_LEFT + i * groupWidth + groupWidth / 2;
          const receitaHeight = (d.receita / max) * plotHeight;
          const despesaHeight = (d.despesa / max) * plotHeight;
          const baseY = PADDING_TOP + plotHeight;
          return (
            <g key={d.label}>
              <rect
                x={groupX - barWidth - gap / 2}
                y={baseY - receitaHeight}
                width={barWidth}
                height={receitaHeight}
                rx={3}
                fill={CATEGORICAL_COLORS[0]}
              >
                <title>{`${seriesLabels[0]} ${d.label}: ${formatCurrency(d.receita, currency)}`}</title>
              </rect>
              <rect
                x={groupX + gap / 2}
                y={baseY - despesaHeight}
                width={barWidth}
                height={despesaHeight}
                rx={3}
                fill={CATEGORICAL_COLORS[1]}
              >
                <title>{`${seriesLabels[1]} ${d.label}: ${formatCurrency(d.despesa, currency)}`}</title>
              </rect>
              <text x={groupX} y={HEIGHT - 8} textAnchor="middle" fontSize={11} fill={CHART_MUTED_TEXT} className="capitalize">
                {d.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
