"use client";

import { useMemo, useState, useTransition } from "react";
import { AlertTriangle, Check, X, BellOff } from "lucide-react";
import { resolveAlertAction, dismissAlertAction } from "@/lib/actions/alert-actions";
import {
  ALERT_CATEGORIES,
  ALERT_CATEGORY_LABELS,
  ALERT_SEVERITIES,
  ALERT_SEVERITY_LABELS,
  ALERT_SEVERITY_TONE,
  ALERT_STATUSES,
  ALERT_STATUS_LABELS,
} from "@/lib/validation/alerts";
import { formatDateTime } from "@/lib/format";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

interface AlertRow {
  id: string;
  category: string;
  severity: string;
  title: string;
  message: string;
  status: string;
  createdAt: string;
  resolvedAt: string | null;
}

export function AlertList({ alerts, canAct }: { alerts: AlertRow[]; canAct: boolean }) {
  const [categoryFilter, setCategoryFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("ABERTO");
  const [, startTransition] = useTransition();

  const filtered = useMemo(() => {
    return alerts.filter((a) => {
      if (categoryFilter && a.category !== categoryFilter) return false;
      if (statusFilter && a.status !== statusFilter) return false;
      return true;
    });
  }, [alerts, categoryFilter, statusFilter]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <Select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="w-56">
          <option value="">Todas as categorias</option>
          {ALERT_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {ALERT_CATEGORY_LABELS[c]}
            </option>
          ))}
        </Select>
        <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-48">
          <option value="">Todos os status</option>
          {ALERT_STATUSES.map((s) => (
            <option key={s} value={s}>
              {ALERT_STATUS_LABELS[s]}
            </option>
          ))}
        </Select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<BellOff size={28} />}
          title={alerts.length === 0 ? "Nenhum alerta no momento" : "Nenhum alerta encontrado com esses filtros"}
          description={alerts.length === 0 ? "Tudo em dia — nenhuma condição de risco detectada nos dados atuais." : undefined}
        />
      ) : (
        <div className="flex flex-col gap-2">
          {filtered.map((a) => (
            <div key={a.id} className="flex items-start gap-3 rounded-2xl border border-border bg-card p-4">
              <AlertTriangle size={16} className="mt-0.5 shrink-0 text-text-tertiary" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={ALERT_SEVERITY_TONE[a.severity as (typeof ALERT_SEVERITIES)[number]]}>
                    {ALERT_SEVERITY_LABELS[a.severity as (typeof ALERT_SEVERITIES)[number]]}
                  </Badge>
                  <Badge tone="neutral">{ALERT_CATEGORY_LABELS[a.category as (typeof ALERT_CATEGORIES)[number]]}</Badge>
                  {a.status !== "ABERTO" && <Badge tone="neutral">{ALERT_STATUS_LABELS[a.status as (typeof ALERT_STATUSES)[number]]}</Badge>}
                </div>
                <p className="mt-1.5 text-sm font-medium text-text-primary">{a.title}</p>
                <p className="text-sm text-text-secondary">{a.message}</p>
                <p className="mt-1 text-xs text-text-tertiary">
                  Detectado em {formatDateTime(new Date(a.createdAt))}
                  {a.resolvedAt && ` · ${a.status === "RESOLVIDO" ? "Resolvido" : "Dispensado"} em ${formatDateTime(new Date(a.resolvedAt))}`}
                </p>
              </div>
              {canAct && a.status === "ABERTO" && (
                <div className="flex shrink-0 gap-1.5">
                  <Button size="sm" variant="secondary" onClick={() => startTransition(() => resolveAlertAction(a.id))}>
                    <Check size={14} /> Resolver
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => startTransition(() => dismissAlertAction(a.id))}>
                    <X size={14} /> Dispensar
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
