"use client";

import { useState, useTransition } from "react";
import { Plus, Send, Trash2, Info } from "lucide-react";
import { toggleMessageTemplateAction, deleteMessageTemplateAction, processReminderQueueAction } from "@/lib/actions/billing-actions";
import { MESSAGE_TRIGGER_LABELS, REMINDER_CHANNEL_LABELS, REMINDER_STATUS_LABELS } from "@/lib/validation/billing";
import { formatDateTime } from "@/lib/format";
import { Drawer } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { TemplateForm } from "./template-form";

interface TemplateRow {
  id: string;
  name: string;
  trigger: string;
  channel: string;
  body: string;
  active: boolean;
}

interface ReminderRow {
  id: string;
  offsetDays: number;
  channel: string;
  status: string;
  scheduledFor: string;
  sentAt: string | null;
  clientName: string;
  description: string;
}

const REMINDER_STATUS_TONE: Record<string, "neutral" | "success" | "error"> = {
  AGENDADO: "neutral",
  ENVIADO: "success",
  FALHOU: "error",
  CANCELADO: "neutral",
};

export function CobrancasView({
  templates,
  reminders,
  canManage,
}: {
  templates: TemplateRow[];
  reminders: ReminderRow[];
  canManage: boolean;
}) {
  const [creating, setCreating] = useState(false);
  const [processing, startProcessing] = useTransition();
  const [result, setResult] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <div className="flex items-start gap-3">
          <Info size={18} className="mt-0.5 shrink-0 text-info" />
          <div className="text-sm text-text-secondary">
            <p>
              Modo atual: <span className="text-text-primary">Manual</span> — clique em &quot;Processar régua agora&quot; para
              disparar os lembretes vencidos. Os modos Automática e Assistida (disparo por agendador em segundo plano) dependem de
              uma integração de automação (Fase 14) e ainda não estão conectados.
            </p>
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Modelos de mensagem (régua)</CardTitle>
          {canManage && (
            <Button size="sm" onClick={() => setCreating(true)}>
              <Plus size={14} /> Novo modelo
            </Button>
          )}
        </CardHeader>
        {templates.length === 0 ? (
          <EmptyState title="Nenhum modelo de mensagem cadastrado" description="Crie modelos para D-7, D-3, D-1, D0, D+1 e D+5." />
        ) : (
          <div className="flex flex-col divide-y divide-border">
            {templates.map((t) => (
              <div key={t.id} className="flex items-center justify-between gap-3 py-2.5">
                <div>
                  <p className="text-sm text-text-primary">{t.name}</p>
                  <div className="mt-1 flex items-center gap-1.5">
                    <Badge tone="accent">{MESSAGE_TRIGGER_LABELS[t.trigger as keyof typeof MESSAGE_TRIGGER_LABELS] ?? t.trigger}</Badge>
                    <Badge tone="info">{REMINDER_CHANNEL_LABELS[t.channel as keyof typeof REMINDER_CHANNEL_LABELS] ?? t.channel}</Badge>
                  </div>
                </div>
                {canManage && (
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-1.5 text-xs text-text-secondary">
                      <input
                        type="checkbox"
                        defaultChecked={t.active}
                        onChange={(e) => toggleMessageTemplateAction(t.id, e.target.checked)}
                        className="h-4 w-4 rounded border-border bg-card accent-[#E8540A]"
                      />
                      Ativo
                    </label>
                    <button type="button" onClick={() => deleteMessageTemplateAction(t.id)} className="text-text-tertiary hover:text-error" aria-label="Excluir modelo">
                      <Trash2 size={14} />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      {canManage && (
        <div className="flex items-center gap-3">
          <Button
            variant="secondary"
            disabled={processing}
            onClick={() =>
              startProcessing(async () => {
                const res = await processReminderQueueAction();
                setResult(res.success ?? res.error ?? null);
              })
            }
          >
            <Send size={16} /> {processing ? "Processando..." : "Processar régua agora"}
          </Button>
          {result && <span className="text-sm text-text-secondary">{result}</span>}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Lembretes</CardTitle>
        </CardHeader>
        {reminders.length === 0 ? (
          <EmptyState title="Nenhum lembrete agendado ainda" description="Lembretes são gerados automaticamente quando uma cobrança é criada, a partir dos modelos ativos." />
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-bg-secondary text-left text-xs uppercase tracking-wide text-text-tertiary">
                  <th className="px-4 py-3 font-medium">Cliente</th>
                  <th className="px-4 py-3 font-medium">Canal</th>
                  <th className="px-4 py-3 font-medium">Agendado para</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {reminders.map((r) => (
                  <tr key={r.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-3">
                      <p className="text-text-primary">{r.clientName}</p>
                      <p className="text-xs text-text-tertiary">{r.description}</p>
                    </td>
                    <td className="px-4 py-3 text-text-secondary">{REMINDER_CHANNEL_LABELS[r.channel as keyof typeof REMINDER_CHANNEL_LABELS] ?? r.channel}</td>
                    <td className="px-4 py-3 text-text-secondary">{formatDateTime(new Date(r.scheduledFor))}</td>
                    <td className="px-4 py-3">
                      <Badge tone={REMINDER_STATUS_TONE[r.status] ?? "neutral"}>{REMINDER_STATUS_LABELS[r.status] ?? r.status}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Drawer open={creating} onClose={() => setCreating(false)} title="Novo Modelo de Mensagem">
        <TemplateForm onSuccess={() => setCreating(false)} />
      </Drawer>
    </div>
  );
}
