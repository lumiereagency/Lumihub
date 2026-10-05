"use client";

import { useState, useTransition } from "react";
import { Camera, Check, ChevronDown, HandCoins, Settings2, Undo2, Wallet } from "lucide-react";
import { payFolhaAction, undoFolhaAction, updatePayrollSettingsAction } from "@/lib/actions/payroll-actions";
import { CAPTURE_CREW_ROLE_LABELS } from "@/lib/validation/capture-assignments";
import { extraKindLabel } from "@/lib/payroll/extra-kinds";
import type { MonthOverview, PersonMonth } from "@/lib/payroll/overview";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";

const TZ = "America/Sao_Paulo";
const dateBR = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", timeZone: TZ }).replace(".", "");
const initials = (name: string) => name.split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("");

function Row({ icon: Icon, label, value, muted }: { icon: typeof Wallet; label: string; value: number; muted?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="flex items-center gap-2 text-text-secondary">
        <Icon size={14} className="text-text-tertiary" /> {label}
      </span>
      <span className={cn("lb-figures", muted || value === 0 ? "text-text-tertiary" : "text-text-primary")}>{formatCurrency(value)}</span>
    </div>
  );
}

function PersonCard({ p, canPay }: { p: PersonMonth; canPay: boolean }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const tone = p.status === "PAGO" ? "success" : p.status === "ATRASADO" ? "error" : p.status === "PENDENTE" ? "accent" : "neutral";
  const label = p.status === "PAGO" ? `Pago ${p.paidAt ? dateBR(p.paidAt) : ""}` : p.status === "ATRASADO" ? "Atrasado" : p.status === "PENDENTE" ? `Vence ${dateBR(p.dueDate)}` : "Nada neste mês";
  const hasDetails = p.commissions.length > 0 || p.extras.length > 0 || p.bonuses.length > 0;

  return (
    <article className="flex flex-col gap-4 rounded-3xl border border-border bg-card p-5">
      <header className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[image:var(--lh-accent-gradient)] text-sm font-semibold text-accent-on">{initials(p.name)}</span>
          <div className="min-w-0">
            <p className="truncate font-semibold text-text-primary">{p.name}</p>
            <p className="truncate text-xs text-text-tertiary">{p.role}</p>
            <p className="text-xs text-text-tertiary">Recebe no {p.payRule}</p>
          </div>
        </div>
        <Badge tone={tone}>{label}</Badge>
      </header>

      <div className="flex flex-col gap-2">
        <Row icon={Wallet} label="Fixo" value={p.fixed} />
        <Row icon={HandCoins} label={`Comissões${p.commissions.length ? ` (${p.commissions.length})` : ""}`} value={p.commissionsTotal} />
        <Row icon={Camera} label={`Extras${p.extras.length + p.bonuses.length ? ` (${p.extras.length + p.bonuses.length})` : ""}`} value={p.extrasTotal} />
      </div>

      <div className="flex items-end justify-between gap-3 border-t border-border pt-4">
        <div>
          <p className="text-xs text-text-tertiary">Total do mês</p>
          <p className="lb-figures text-[26px] font-semibold leading-tight tracking-tight text-text-primary">{formatCurrency(p.total)}</p>
        </div>
        {canPay && p.payableId && p.status !== "PAGO" && (
          <Button
            size="sm"
            variant="accent"
            disabled={pending}
            onClick={() => {
              if (!confirm(`Registrar o pagamento de ${formatCurrency(p.total)} para ${p.name}?`)) return;
              setError(null);
              start(async () => {
                const res = await payFolhaAction(p.payableId!);
                if (!res.ok) setError(res.error ?? "Não foi possível registrar.");
              });
            }}
          >
            <Check size={14} /> Marcar como pago
          </Button>
        )}
        {canPay && p.payableId && p.status === "PAGO" && (
          <Button
            size="sm"
            variant="ghost"
            disabled={pending}
            onClick={() =>
              confirm("Desfazer o pagamento desta folha?") &&
              start(async () => {
                await undoFolhaAction(p.payableId!);
              })
            }
          >
            <Undo2 size={14} /> Desfazer
          </Button>
        )}
      </div>
      {error && <p className="text-xs text-error">{error}</p>}

      {hasDetails && (
        <div>
          <button type="button" onClick={() => setOpen((v) => !v)} className="flex items-center gap-1 text-xs text-text-secondary hover:text-text-primary">
            <ChevronDown size={14} className={cn("transition-transform", open ? "rotate-180" : "")} /> {open ? "Esconder detalhes" : "Ver de onde vem"}
          </button>
          {open && (
            <div className="mt-3 flex flex-col gap-1.5 rounded-2xl bg-card-elevated/60 p-3 text-xs">
              {p.commissions.map((c, i) => (
                <div key={`c${i}`} className="flex justify-between gap-3">
                  <span className="truncate text-text-secondary">Comissão · {c.description}</span>
                  <span className="lb-figures shrink-0 text-text-primary">{formatCurrency(c.amount)}</span>
                </div>
              ))}
              {p.extras.map((e, i) => (
                <div key={`e${i}`} className="flex justify-between gap-3">
                  <span className="truncate text-text-secondary">
                    Captação {dateBR(e.date)} · {e.client} · {CAPTURE_CREW_ROLE_LABELS[e.role as keyof typeof CAPTURE_CREW_ROLE_LABELS] ?? e.role}
                  </span>
                  <span className="lb-figures shrink-0 text-text-primary">{formatCurrency(e.amount)}</span>
                </div>
              ))}
              {p.bonuses.map((b, i) => (
                <div key={`b${i}`} className="flex justify-between gap-3">
                  <span className="truncate text-text-secondary">
                    {extraKindLabel(b.kind)} · {b.description}
                    {b.recurring ? " (todo mês)" : ""}
                  </span>
                  <span className="lb-figures shrink-0 text-text-primary">{formatCurrency(b.amount)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </article>
  );
}

function SettingsCard({ settings }: { settings: { captureFeeSolo: number; captureFeeShared: number; taxRate: number; taxDueDay: number } }) {
  const [values, setValues] = useState(settings);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const field = (key: keyof typeof values, label: string, suffix: string, step = "1") => (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs text-text-tertiary">{label}</span>
      <span className="flex items-center gap-2 rounded-xl border border-border bg-card-elevated px-3">
        {suffix === "R$" && <span className="text-sm text-text-tertiary">R$</span>}
        <input
          type="number"
          step={step}
          min={0}
          value={values[key]}
          onChange={(e) => setValues((v) => ({ ...v, [key]: Number(e.target.value) }))}
          className="lb-figures h-10 w-full bg-transparent text-sm text-text-primary focus:outline-none"
        />
        {suffix !== "R$" && <span className="text-sm text-text-tertiary">{suffix}</span>}
      </span>
    </label>
  );
  return (
    <section className="flex flex-col gap-4 rounded-3xl border border-border bg-card p-5">
      <div className="flex items-center gap-2">
        <Settings2 size={16} className="text-text-tertiary" />
        <p className="font-semibold text-text-primary">Valores e regras</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {field("captureFeeSolo", "Captação feita por 1 pessoa", "R$")}
        {field("captureFeeShared", "Por pessoa, quando há 2 ou mais", "R$")}
        {field("taxRate", "Imposto sobre o que recebe (Simples)", "%", "0.01")}
        {field("taxDueDay", "Dia do vencimento do DAS", "º dia")}
      </div>
      <p className="text-xs text-text-tertiary">Os extras de captação novos usam estes valores. Os que já foram pagos não mudam.</p>
      <div className="flex items-center gap-3">
        <Button
          size="sm"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const res = await updatePayrollSettingsAction(values);
              setMsg(res.ok ? "Salvo." : (res.error ?? "Não foi possível salvar."));
            })
          }
        >
          {pending ? "Salvando…" : "Salvar valores"}
        </Button>
        {msg && <span className="text-xs text-text-secondary">{msg}</span>}
      </div>
    </section>
  );
}

export function PayrollBoard({
  overview,
  isCurrent,
  canPay,
  canEditSettings,
  settings,
}: {
  overview: MonthOverview;
  isCurrent: boolean;
  canPay: boolean;
  canEditSettings: boolean;
  settings: { captureFeeSolo: number; captureFeeShared: number; taxRate: number; taxDueDay: number };
}) {
  const t = overview.totals;
  const paidPct = t.total > 0 ? Math.round((t.paid / t.total) * 100) : 0;
  const people = overview.people.filter((p) => p.total > 0 || p.status !== "SEM_VALOR");
  const idle = overview.people.filter((p) => p.total === 0 && p.status === "SEM_VALOR");

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <section className="relative flex min-h-[260px] flex-col justify-between gap-6 overflow-hidden rounded-3xl bg-[image:var(--lh-accent-gradient)] p-6 text-accent-on">
          <div>
            <p className="text-sm text-accent-on/75">{isCurrent ? "Folha deste mês" : "Folha de"} · {overview.label}</p>
            <p className="lb-figures mt-1 text-[40px] font-semibold leading-tight tracking-tight">{formatCurrency(t.total)}</p>
            <p className="text-sm text-accent-on/75">
              {t.open > 0 ? `${formatCurrency(t.open)} a pagar${overview.nextDue ? ` · o primeiro vence ${dateBR(overview.nextDue)}` : ""}` : t.total > 0 ? "Tudo pago 🎉" : "Nada a pagar neste mês"}
            </p>
          </div>
          <div className="flex flex-col gap-3">
            <div className="h-2 overflow-hidden rounded-full bg-accent-on/15">
              <div className="h-full rounded-full bg-accent-on/70" style={{ width: `${paidPct}%` }} />
            </div>
            <div className="grid grid-cols-3 gap-3 text-sm">
              <div>
                <p className="text-xs text-accent-on/70">Fixos</p>
                <p className="lb-figures font-semibold">{formatCurrency(t.fixed)}</p>
              </div>
              <div>
                <p className="text-xs text-accent-on/70">Comissões</p>
                <p className="lb-figures font-semibold">{formatCurrency(t.commissions)}</p>
              </div>
              <div>
                <p className="text-xs text-accent-on/70">Extras</p>
                <p className="lb-figures font-semibold">{formatCurrency(t.extras)}</p>
              </div>
            </div>
          </div>
        </section>
        {canEditSettings ? (
          <SettingsCard settings={settings} />
        ) : (
          <section className="rounded-3xl border border-border bg-card p-5 text-sm text-text-secondary">
            Extra de captação: {formatCurrency(settings.captureFeeSolo)} sozinho · {formatCurrency(settings.captureFeeShared)} por pessoa em dupla.
          </section>
        )}
      </div>

      {people.length === 0 ? (
        <EmptyState title="Ninguém com valores neste mês" description="Salários fixos, comissões liberadas e extras (captações, edição, gráficos) aparecem aqui." />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {people.map((p) => (
            <PersonCard key={p.memberId} p={p} canPay={canPay} />
          ))}
        </div>
      )}

      {idle.length > 0 && (
        <p className="text-xs text-text-tertiary">Sem valores neste mês: {idle.map((p) => p.name).join(", ")}.</p>
      )}
    </div>
  );
}
