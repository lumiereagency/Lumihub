"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, Clock, MessageCircle, Pencil, Plus, QrCode, Send, Sparkles, Trash2, XCircle } from "lucide-react";
import {
  createDefaultTemplatesAction,
  deleteMessageTemplateAction,
  processReminderQueueAction,
  toggleMessageTemplateAction,
  updateBillingSettingsAction,
} from "@/lib/actions/billing-actions";
import { DEFAULT_MESSAGE_TEMPLATES, MESSAGE_TRIGGER_LABELS, REMINDER_CHANNEL_LABELS, REMINDER_STATUS_LABELS } from "@/lib/validation/billing";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/cn";
import { Drawer } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { TemplateForm, type TemplateValues } from "./template-form";

interface ReminderRow {
  id: string;
  channel: string;
  status: string;
  scheduledFor: string;
  sentAt: string | null;
  clientName: string;
  description: string;
  dueLabel: string;
  templateName: string | null;
  messageBody: string | null;
}

interface Status {
  whatsapp: boolean;
  pixKey: string | null;
  company: string;
  thanks: boolean;
  pixSeparate: boolean;
  waitingProof: number;
}

const REMINDER_STATUS_TONE: Record<string, "neutral" | "success" | "error" | "accent"> = {
  AGENDADO: "accent",
  ENVIADO: "success",
  FALHOU: "error",
  CANCELADO: "neutral",
};

const TRIGGER_ORDER = ["D_MENOS_7", "D_MENOS_3", "D_MENOS_1", "D_0", "D_MAIS_1", "D_MAIS_5"];

function failureReason(body: string | null): string | null {
  const m = body?.match(/\[Falha: ([^\]]+)\]/);
  return m ? m[1] : null;
}

function StatusTile({ ok, title, text, href, hrefLabel, icon: Icon }: { ok: boolean; title: string; text: string; href?: string; hrefLabel?: string; icon: typeof CheckCircle2 }) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-border bg-card p-4">
      <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-full", ok ? "bg-success/12 text-success" : "bg-error/12 text-error")}>
        <Icon size={17} />
      </span>
      <div className="min-w-0">
        <p className="text-sm font-medium text-text-primary">{title}</p>
        <p className="text-xs text-text-tertiary">{text}</p>
        {href && (
          <Link href={href} className="mt-1 inline-block text-xs text-accent-light hover:underline">
            {hrefLabel}
          </Link>
        )}
      </div>
    </div>
  );
}

function Toggle({ checked, onChange, label, description, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; description: string; disabled?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <div>
        <p className="text-sm text-text-primary">{label}</p>
        <p className="text-xs text-text-tertiary">{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn("relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-50", checked ? "bg-[image:var(--lh-accent-gradient)]" : "bg-border")}
      >
        <span className={cn("inline-block h-5 w-5 rounded-full bg-white shadow transition-transform", checked ? "translate-x-[22px]" : "translate-x-0.5")} />
      </button>
    </div>
  );
}

export function CobrancasView({
  status,
  noPhone,
  templates,
  reminders,
  canManage,
}: {
  status: Status;
  noPhone: { id: string; companyName: string }[];
  templates: TemplateValues[];
  reminders: ReminderRow[];
  canManage: boolean;
}) {
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<TemplateValues | null>(null);
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<string | null>(null);
  const [settings, setSettings] = useState({ thanks: status.thanks, pixSeparate: status.pixSeparate });
  const [filter, setFilter] = useState<"todos" | "AGENDADO" | "ENVIADO" | "FALHOU">("todos");

  const sorted = [...templates].sort((a, b) => TRIGGER_ORDER.indexOf(a.trigger) - TRIGGER_ORDER.indexOf(b.trigger));
  const shown = filter === "todos" ? reminders : reminders.filter((r) => r.status === filter);
  const failedCount = reminders.filter((r) => r.status === "FALHOU").length;

  function saveSettings(next: typeof settings) {
    setSettings(next);
    startTransition(async () => {
      await updateBillingSettingsAction(next);
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <StatusTile
          ok={status.whatsapp}
          icon={MessageCircle}
          title={status.whatsapp ? "WhatsApp conectado" : "WhatsApp desconectado"}
          text={status.whatsapp ? "As mensagens saem pelo número da empresa." : "Sem ele, nenhum lembrete é enviado."}
          href={status.whatsapp ? undefined : "/configuracoes/integracoes"}
          hrefLabel="Conectar agora"
        />
        <StatusTile
          ok={!!status.pixKey}
          icon={QrCode}
          title={status.pixKey ? "Pix configurado" : "Chave Pix não configurada"}
          text={status.pixKey ? `${status.pixKey} · ${status.company}` : "Sem chave, a mensagem vai só com o link."}
          href={status.pixKey ? undefined : "/propostas/configuracoes"}
          hrefLabel="Cadastrar chave Pix"
        />
        <StatusTile ok icon={Clock} title="Envio automático" text="De segunda a sábado, entre 9h e 18h. No máximo uma mensagem por cliente por dia: várias faturas saem juntas, com o total e um Pix só." />
      </div>

      {(noPhone.length > 0 || status.waitingProof > 0) && (
        <div className="flex flex-col gap-2">
          {status.waitingProof > 0 && (
            <Link href="/financeiro/receber" className="flex items-center gap-2 rounded-2xl border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning">
              <AlertTriangle size={16} /> {status.waitingProof === 1 ? "1 cliente enviou comprovante" : `${status.waitingProof} clientes enviaram comprovante`} e aguarda conferência em Contas a receber.
            </Link>
          )}
          {noPhone.length > 0 && (
            <div className="rounded-2xl border border-error/30 bg-error/10 px-4 py-3 text-sm text-error">
              <p className="flex items-center gap-2">
                <AlertTriangle size={16} /> {noPhone.length === 1 ? "1 cliente com cobrança em aberto está sem telefone" : `${noPhone.length} clientes com cobrança em aberto estão sem telefone`}, e não recebe os lembretes:
              </p>
              <p className="mt-1 flex flex-wrap gap-x-3 gap-y-1 pl-6 text-xs">
                {noPhone.map((c) => (
                  <Link key={c.id} href={`/clientes/${c.id}`} className="underline">
                    {c.companyName}
                  </Link>
                ))}
              </p>
            </div>
          )}
        </div>
      )}

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Régua de lembretes</CardTitle>
            <p className="mt-1 text-sm text-text-tertiary">Mensagens enviadas sozinhas antes e depois do vencimento, com link de pagamento.</p>
          </div>
          {canManage && (
            <div className="flex flex-wrap gap-2">
              {DEFAULT_MESSAGE_TEMPLATES.some((d) => !templates.some((x) => x.trigger === d.trigger)) && (
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={pending}
                  onClick={() =>
                    startTransition(async () => {
                      const res = await createDefaultTemplatesAction();
                      setResult(res.success ?? res.error ?? null);
                    })
                  }
                >
                  <Sparkles size={14} /> Usar modelos prontos
                </Button>
              )}
              <Button size="sm" onClick={() => setCreating(true)}>
                <Plus size={14} /> Novo modelo
              </Button>
            </div>
          )}
        </CardHeader>
        {sorted.length === 0 ? (
          <EmptyState title="Nenhum modelo na régua" description="Comece com os modelos prontos: 3 dias antes, no dia, 1 dia depois e 5 dias depois do vencimento." />
        ) : (
          <div className="flex flex-col divide-y divide-border">
            {sorted.map((t) => (
              <div key={t.id} className="flex items-start justify-between gap-4 py-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <p className={cn("text-sm", t.active ? "text-text-primary" : "text-text-tertiary")}>{t.name}</p>
                    <Badge tone="accent">{MESSAGE_TRIGGER_LABELS[t.trigger as keyof typeof MESSAGE_TRIGGER_LABELS] ?? t.trigger}</Badge>
                    <Badge tone="neutral">{REMINDER_CHANNEL_LABELS[t.channel as keyof typeof REMINDER_CHANNEL_LABELS] ?? t.channel}</Badge>
                    {!t.active && <Badge tone="neutral">Pausado</Badge>}
                  </div>
                  <p className="mt-1 line-clamp-2 text-xs text-text-tertiary">{t.body.replace(/\s+/g, " ")}</p>
                </div>
                {canManage && (
                  <div className="flex shrink-0 items-center gap-1">
                    <label className="mr-2 flex items-center gap-1.5 text-xs text-text-secondary">
                      <input
                        type="checkbox"
                        defaultChecked={t.active}
                        onChange={(e) => toggleMessageTemplateAction(t.id, e.target.checked)}
                        className="h-4 w-4 rounded border-border bg-card accent-[var(--lh-accent)]"
                      />
                      Ativo
                    </label>
                    <button type="button" onClick={() => setEditing(t)} className="rounded-full p-2 text-text-tertiary hover:bg-card-elevated hover:text-text-primary" aria-label="Editar modelo">
                      <Pencil size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => confirm(`Excluir o modelo "${t.name}"?`) && deleteMessageTemplateAction(t.id)}
                      className="rounded-full p-2 text-text-tertiary hover:bg-error/10 hover:text-error"
                      aria-label="Excluir modelo"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
        {canManage && (
          <div className="mt-4 border-t border-border pt-1">
            <Toggle
              checked={settings.pixSeparate}
              onChange={(v) => saveSettings({ ...settings, pixSeparate: v })}
              label="Pix copia e cola numa mensagem separada"
              description="Logo depois do lembrete, a base manda só o código Pix, para o cliente copiar com um toque."
              disabled={pending}
            />
            <Toggle
              checked={settings.thanks}
              onChange={(v) => saveSettings({ ...settings, thanks: v })}
              label="Agradecer quando o pagamento for confirmado"
              description="Ao dar baixa, o cliente recebe no WhatsApp: “Recebemos o pagamento… Muito obrigado!”"
              disabled={pending}
            />
          </div>
        )}
      </Card>

      {canManage && (
        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="secondary"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const res = await processReminderQueueAction();
                setResult(res.success ?? res.error ?? null);
              })
            }
          >
            <Send size={16} /> {pending ? "Processando…" : "Enviar lembretes de hoje agora"}
          </Button>
          {result && <span className="text-sm text-text-secondary">{result}</span>}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Lembretes</CardTitle>
          <div className="flex flex-wrap gap-1.5">
            {(["todos", "AGENDADO", "ENVIADO", "FALHOU"] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                className={cn(
                  "rounded-full px-3 py-1 text-xs",
                  filter === f ? "bg-ink text-ink-on" : "border border-border text-text-secondary hover:text-text-primary",
                )}
              >
                {f === "todos" ? "Todos" : REMINDER_STATUS_LABELS[f]}
                {f === "FALHOU" && failedCount > 0 ? ` · ${failedCount}` : ""}
              </button>
            ))}
          </div>
        </CardHeader>
        {shown.length === 0 ? (
          <EmptyState title="Nenhum lembrete por aqui" description="Os lembretes aparecem conforme as cobranças em aberto se aproximam do vencimento." />
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-[11px] uppercase tracking-[0.06em] text-text-tertiary">
                  <th className="px-4 py-3 font-medium">Cliente</th>
                  <th className="px-4 py-3 font-medium">Lembrete</th>
                  <th className="px-4 py-3 font-medium">Quando</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((r) => {
                  const reason = r.status === "FALHOU" ? failureReason(r.messageBody) : null;
                  return (
                    <tr key={r.id} className="border-b border-border align-top last:border-0 hover:bg-card-elevated/50">
                      <td className="px-4 py-3">
                        <p className="text-text-primary">{r.clientName}</p>
                        <p className="text-xs text-text-tertiary">
                          {r.description} · vence {r.dueLabel}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-text-secondary">
                        {r.templateName ?? "—"}
                        <span className="block text-xs text-text-tertiary">{REMINDER_CHANNEL_LABELS[r.channel as keyof typeof REMINDER_CHANNEL_LABELS] ?? r.channel}</span>
                      </td>
                      <td className="px-4 py-3 text-text-secondary">{formatDateTime(new Date(r.sentAt ?? r.scheduledFor))}</td>
                      <td className="px-4 py-3">
                        <span className="flex items-center gap-1.5">
                          {r.status === "ENVIADO" ? <CheckCircle2 size={13} className="text-success" /> : r.status === "FALHOU" ? <XCircle size={13} className="text-error" /> : null}
                          <Badge tone={REMINDER_STATUS_TONE[r.status] ?? "neutral"}>{REMINDER_STATUS_LABELS[r.status] ?? r.status}</Badge>
                        </span>
                        {reason && <p className="mt-1 max-w-[260px] text-xs text-error">{reason}</p>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Drawer open={creating} onClose={() => setCreating(false)} title="Novo modelo de mensagem">
        <TemplateForm onSuccess={() => setCreating(false)} />
      </Drawer>
      <Drawer open={!!editing} onClose={() => setEditing(null)} title="Editar modelo">
        {editing && <TemplateForm key={editing.id} template={editing} onSuccess={() => setEditing(null)} />}
      </Drawer>
    </div>
  );
}
