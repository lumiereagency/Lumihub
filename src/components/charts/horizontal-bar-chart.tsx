import { formatCurrency } from "@/lib/format";
import { categoricalColor, CHART_MUTED_TEXT } from "./colors";
import { EmptyState } from "@/components/ui/empty-state";

interface DataPoint {
  label: string;
  value: number;
}

const MAX_SLOTS = 8;

function foldIntoOther(data: DataPoint[]): DataPoint[] {
  if (data.length <= MAX_SLOTS) return data;
  const head = data.slice(0, MAX_SLOTS - 1);
  const restTotal = data.slice(MAX_SLOTS - 1).reduce((sum, d) => sum + d.value, 0);
  return [...head, { label: "Outros", value: restTotal }];
}

export function HorizontalBarChart({
  data,
  currency,
  emptyLabel,
}: {
  data: DataPoint[];
  currency: string;
  emptyLabel: string;
}) {
  const points = foldIntoOther(data).filter((d) => d.value > 0);

  if (points.length === 0) {
    return <EmptyState title={emptyLabel} />;
  }

  const max = Math.max(...points.map((d) => d.value));

  return (
    <div className="flex flex-col gap-3" role="img" aria-label={points.map((p) => `${p.label}: ${formatCurrency(p.value, currency)}`).join(", ")}>
      {points.map((p, i) => (
        <div key={p.label} className="flex items-center gap-3">
          <span className="w-28 shrink-0 truncate text-xs text-text-secondary" title={p.label}>
            {p.label}
          </span>
          <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-card-elevated">
            <div
              className="h-full rounded-full"
              style={{ width: `${(p.value / max) * 100}%`, backgroundColor: categoricalColor(i) }}
              title={`${p.label}: ${formatCurrency(p.value, currency)}`}
            />
          </div>
          <span className="w-24 shrink-0 text-right text-xs" style={{ color: CHART_MUTED_TEXT }}>
            {formatCurrency(p.value, currency)}
          </span>
        </div>
      ))}
    </div>
  );
}
