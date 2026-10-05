"use client";

import { useState, useTransition } from "react";
import { CalendarClock, Pencil, Plus, Repeat, Sparkles, Trash2, Users, Wallet } from "lucide-react";
import { createExtraAction, deleteExtraAction, endExtraAction, updateExtraAction } from "@/lib/actions/extra-actions";
import type { ExtraKind } from "@/lib/payroll/extra-kinds";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/cn";
import { Drawer } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";

export interface ExtraRow {
  id: string;
  person: string;
  description: string;
  clientName: string | null;
  amount: number;
  recurring: boolean;
  date: string;
  startMonth: string;
  startLabel: string;
  endMonth: string | null;
  endLabel: string | null;
  active: boolean;
  entries: { competence: string; label: string; amount: number; paid: boolean; dueDate: string | null; paidAt: string | null }[];
  paidTotal: number;
}

const TZ = "America/Sao_Paulo";
const dayBR = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", timeZone: TZ }).replace(".", "");
const monthShort = (m: string) => new Date(`${m}-15T12:00:00Z`).toLocaleDateString("pt-BR", { month: "short", year: "numeric", timeZone: "UTC" }).replace(".", "").replace(" de ", "/");
const initials = (name: string) => name.split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("");

const field = "h-11 w-full rounded-xl border border-border bg-card-elevated px-3 text-sm text-text-primary focus:border-accent/60 focus:outline-none";

function Label({ children }: { children: React.ReactNode }) {
  return <span className="text-xs font-medium text-text-secondary">{children}</span>;
}

function entryStatus(e: ExtraRow["entries"][number] | undefined): { tone: "success" | "accent" | "neutral"; text: string } {
  if (!e) return { tone: "neutral", text: "Ainda não entrou" };
  if (e.paid) return { tone: "success", text: `Pago${e.paidAt ? ` ${dayBR(e.paidAt)}` : ""}` };
  return { tone: "accent", text: `Na folha de ${e.label.split(" de ")[0]}${e.dueDate ? ` · paga ${dayBR(e.dueDate)}` : ""}` };
}

function CreateForm({ kind, hint, members, onDone }: { kind: ExtraKind; hint: string; members: { id: string; name: string; role: string }[]; onDone: () => void }) {
  const [today] = useState(() => new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date()));
  const [recurring, setRecurring] = useState(false);
  const [form, setForm] = useState({ teamMemberId: members[0]?.id ?? "", description: "", clientName: "", amount: "", date: today, startMonth: today.slice(0, 7), endMonth: "" });
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    start(async () => {
      const res = await createExtraAction({
        kind,
        recurring,
        teamMemberId: form.teamMemberId,
        description: form.description,
        clientName: form.clientName,
        amount: form.amount.replace(",", "."),
        ...(recurring ? { startMonth: form.startMonth, endMonth: form.endMonth } : { date: form.date }),
      });
      if (res.ok) onDone();
      else setError(res.error ?? "Não foi possível salvar.");
    });
  }

  if (members.length === 0) return <p className="text-sm text-text-secondary">Cadastre a pessoa em Equipe → Funcionários para poder lançar extras para ela.</p>;

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1.5">
        <Label>Quem fez</Label>
        <select value={form.teamMemberId} onChange={set("teamMemberId")} className={field}>
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name} · {m.role}
            </option>
          ))}
        </select>
      </label>

      <div className="flex flex-col gap-1.5">
        <Label>Como entra nos ganhos</Label>
        <div className="grid grid-cols-2 gap-2" role="radiogroup">
          {[
            { v: false, t: "Pontual", d: "Uma vez, no mês em que foi feito" },
            { v: true, t: "Todo mês", d: "Recorrente, até você encerrar" },
          ].map((o) => (
            <button
              key={o.t}
              type="button"
              role="radio"
              aria-checked={recurring === o.v}
              onClick={() => setRecurring(o.v)}
              className={cn("rounded-2xl border p-3 text-left transition-colors", recurring === o.v ? "border-accent/60 bg-accent/10" : "border-border hover:border-text-tertiary/50")}
            >
              <span className="block text-sm font-medium text-text-primary">{o.t}</span>
              <span className="block text-xs text-text-tertiary">{o.d}</span>
            </button>
          ))}
        </div>
      </div>

      <label className="flex flex-col gap-1.5">
        <Label>O que foi feito</Label>
        <input value={form.description} onChange={set("description")} required maxLength={160} placeholder={hint} className={field} />
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1.5">
          <Label>{recurring ? "Valor por mês" : "Valor"}</Label>
          <span className={cn(field, "flex items-center gap-2")}>
            <span className="text-text-tertiary">R$</span>
            <input value={form.amount} onChange={set("amount")} required inputMode="decimal" placeholder="0,00" className="lb-figures w-full bg-transparent focus:outline-none" />
          </span>
        </label>
        <label className="flex flex-col gap-1.5">
          <Label>Cliente (opcional)</Label>
          <input value={form.clientName} onChange={set("clientName")} maxLength={120} placeholder="Para quem foi" className={field} />
        </label>
      </div>

      {recurring ? (
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1.5">
            <Label>Começa em</Label>
            <input type="month" value={form.startMonth} onChange={set("startMonth")} required className={field} />
          </label>
          <label className="flex flex-col gap-1.5">
            <Label>Termina em (opcional)</Label>
            <input type="month" value={form.endMonth} onChange={set("endMonth")} min={form.startMonth} className={field} />
          </label>
        </div>
      ) : (
        <label className="flex flex-col gap-1.5">
          <Label>Quando foi feito</Label>
          <input type="date" value={form.date} onChange={set("date")} required className={field} />
        </label>
      )}

      <p className="rounded-xl bg-card-elevated/60 px-3 py-2 text-xs text-text-tertiary">
        {recurring
          ? "Entra na folha de cada mês, do mês de início até o mês final, e a pessoa é avisada no celular."
          : "Entra na folha do mês em que foi feito (se essa folha já foi paga, vai para a próxima) e a pessoa é avisada no celular."}
      </p>
      {error && <p className="text-sm text-error">{error}</p>}
      <Button type="submit" variant="accent" disabled={pending} className="w-full">
        {pending ? "Lançando…" : "Lançar extra"}
      </Button>
    </form>
  );
}

function EditForm({ row, onDone }: { row: ExtraRow; onDone: () => void }) {
  const [form, setForm] = useState({ description: row.description, clientName: row.clientName ?? "", amount: String(row.amount).replace(".", ","), endMonth: row.endMonth ?? "" });
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        start(async () => {
          const res = await updateExtraAction(row.id, { ...form, amount: form.amount.replace(",", ".") });
          if (res.ok) onDone();
          else setError(res.error ?? "Não foi possível salvar.");
        });
      }}
      className="flex flex-col gap-4"
    >
      <p className="text-sm text-text-secondary">
        {row.person} · {row.recurring ? `todo mês desde ${row.startLabel}` : `pontual em ${dayBR(row.date)}`}
      </p>
      <label className="flex flex-col gap-1.5">
        <Label>O que foi feito</Label>
        <input value={form.description} onChange={set("description")} required maxLength={160} className={field} />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1.5">
          <Label>{row.recurring ? "Valor por mês" : "Valor"}</Label>
          <input value={form.amount} onChange={set("amount")} required inputMode="decimal" className={cn(field, "lb-figures")} />
        </label>
        <label className="flex flex-col gap-1.5">
          <Label>Cliente (opcional)</Label>
          <input value={form.clientName} onChange={set("clientName")} maxLength={120} className={field} />
        </label>
      </div>
      {row.recurring && (
        <label className="flex flex-col gap-1.5">
          <Label>Termina em (vazio = sem data)</Label>
          <input type="month" value={form.endMonth} onChange={set("endMonth")} min={row.startMonth} className={field} />
        </label>
      )}
      <p className="text-xs text-text-tertiary">O novo valor vale para os meses ainda não pagos. O que já foi pago não muda.</p>
      {error && <p className="text-sm text-error">{error}</p>}
      <Button type="submit" variant="accent" disabled={pending} className="w-full">
        {pending ? "Salvando…" : "Salvar"}
      </Button>
    </form>
  );
}

export function ExtrasBoard({
  kind,
  title,
  hint,
  rows,
  members,
  canManage,
  own,
  summary,
  currentMonth,
}: {
  kind: ExtraKind;
  title: string;
  hint: string;
  rows: ExtraRow[];
  members: { id: string; name: string; role: string }[];
  canManage: boolean;
  own: boolean;
  summary: { monthLabel: string; monthTotal: number; people: number; recurringActive: number; recurringMonthly: number };
  currentMonth: string;
}) {
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<ExtraRow | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const recurring = rows.filter((r) => r.recurring);
  const oneOff = rows.filter((r) => !r.recurring);

  function act(fn: () => Promise<{ ok: boolean; error?: string }>, done: string) {
    setMsg(null);
    start(async () => {
      const res = await fn();
      setMsg(res.ok ? done : (res.error ?? "Não foi possível."));
    });
  }

  const Actions = ({ r }: { r: ExtraRow }) =>
    canManage ? (
      <div className="flex shrink-0 items-center gap-0.5">
        <button type="button" onClick={() => setEditing(r)} className="rounded-full p-2 text-text-tertiary hover:bg-card-elevated hover:text-text-primary" aria-label="Editar extra">
          <Pencil size={14} />
        </button>
        {r.recurring && r.active && (
          <button
            type="button"
            disabled={pending}
            onClick={() => confirm(`Encerrar o extra de ${r.person}? O deste mês continua; a partir do próximo, para de entrar.`) && act(() => endExtraAction(r.id), "Extra encerrado.")}
            className="rounded-full px-2.5 py-1 text-xs text-text-tertiary hover:bg-card-elevated hover:text-text-primary"
          >
            Encerrar
          </button>
        )}
        <button
          type="button"
          disabled={pending}
          onClick={() => confirm(`Excluir este extra de ${r.person}?`) && act(() => deleteExtraAction(r.id), "Extra excluído.")}
          className="rounded-full p-2 text-text-tertiary hover:bg-error/10 hover:text-error"
          aria-label="Excluir extra"
        >
          <Trash2 size={14} />
        </button>
      </div>
    ) : null;

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="flex flex-col gap-1 rounded-3xl bg-[image:var(--lh-accent-gradient)] p-5 text-accent-on">
          <p className="flex items-center gap-1.5 text-xs text-accent-on/75">
            <Sparkles size={13} /> {own ? "Seus extras" : title} · {summary.monthLabel}
          </p>
          <p className="lb-figures text-[30px] font-semibold leading-tight tracking-tight">{formatCurrency(summary.monthTotal)}</p>
          <p className="text-xs text-accent-on/75">entrando nos ganhos deste mês</p>
        </div>
        <div className="flex flex-col gap-1 rounded-3xl border border-border bg-card p-5">
          <p className="flex items-center gap-1.5 text-xs text-text-tertiary">
            <Repeat size={13} className="text-accent-light" /> Recorrentes ativos
          </p>
          <p className="lb-figures text-2xl font-semibold tracking-tight text-text-primary">{summary.recurringActive}</p>
          <p className="text-xs text-text-tertiary">{formatCurrency(summary.recurringMonthly)} por mês</p>
        </div>
        <div className="flex flex-col gap-1 rounded-3xl border border-border bg-card p-5">
          <p className="flex items-center gap-1.5 text-xs text-text-tertiary">
            <Users size={13} className="text-accent-light" /> {own ? "Lançamentos" : "Pessoas bonificadas no mês"}
          </p>
          <p className="lb-figures text-2xl font-semibold tracking-tight text-text-primary">{own ? rows.length : summary.people}</p>
          <p className="text-xs text-text-tertiary">{own ? "no total" : "com extra neste mês"}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[17px] font-semibold tracking-tight text-text-primary">{title}</p>
          <p className="text-sm text-text-tertiary">{own ? "O que você fez além do fixo e quando entra." : "Bonifique quem fez: pontual (uma vez) ou todo mês."}</p>
        </div>
        {canManage && (
          <Button variant="accent" onClick={() => setCreating(true)}>
            <Plus size={16} /> Lançar extra
          </Button>
        )}
      </div>
      {msg && <p className="-mt-3 text-sm text-text-secondary">{msg}</p>}

      {rows.length === 0 ? (
        <EmptyState
          icon={<Wallet size={26} />}
          title={own ? "Nenhum extra seu por aqui ainda" : "Nenhum extra lançado"}
          description={own ? "Quando a diretoria lançar um extra para você, ele aparece aqui e soma no seu mês." : "Lance um extra e ele entra direto na folha da pessoa, no mês certo."}
        />
      ) : (
        <>
          {recurring.length > 0 && (
            <section className="flex flex-col gap-3">
              <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-text-tertiary">Todo mês</p>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                {recurring.map((r) => {
                  const now = r.entries.find((e) => e.competence === currentMonth);
                  const st = r.active ? entryStatus(now) : { tone: "neutral" as const, text: `Encerrado em ${r.endLabel}` };
                  return (
                    <article key={r.id} className={cn("flex flex-col gap-3 rounded-3xl border border-border bg-card p-5", !r.active && "opacity-70")}>
                      <header className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-card-elevated text-xs font-semibold text-text-secondary">{initials(r.person)}</span>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-text-primary">{r.person}</p>
                            <p className="truncate text-xs text-text-tertiary">
                              {r.description}
                              {r.clientName ? ` · ${r.clientName}` : ""}
                            </p>
                          </div>
                        </div>
                        <Actions r={r} />
                      </header>
                      <div className="flex flex-wrap items-end justify-between gap-2">
                        <div>
                          <p className="lb-figures text-xl font-semibold tracking-tight text-text-primary">
                            {formatCurrency(r.amount)}
                            <span className="text-sm font-normal text-text-tertiary">/mês</span>
                          </p>
                          <p className="text-xs text-text-tertiary">
                            desde {monthShort(r.startMonth)}
                            {r.endMonth && r.active ? ` · até ${monthShort(r.endMonth)}` : ""}
                            {r.paidTotal > 0 ? ` · ${formatCurrency(r.paidTotal)} já pagos` : ""}
                          </p>
                        </div>
                        <Badge tone={st.tone}>{st.text}</Badge>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          )}

          {oneOff.length > 0 && (
            <section className="flex flex-col gap-3">
              <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-text-tertiary">Pontuais</p>
              <div className="flex flex-col divide-y divide-border rounded-3xl border border-border bg-card px-5">
                {oneOff.map((r) => {
                  const st = entryStatus(r.entries[0]);
                  return (
                    <div key={r.id} className="flex flex-col gap-2 py-3.5 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-card-elevated text-text-tertiary">
                          <CalendarClock size={15} />
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-sm text-text-primary">
                            {own ? "" : `${r.person} · `}
                            {r.description}
                          </p>
                          <p className="truncate text-xs text-text-tertiary">
                            {dayBR(r.date)}
                            {r.clientName ? ` · ${r.clientName}` : ""}
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 pl-12 sm:shrink-0 sm:flex-nowrap sm:gap-3 sm:pl-0">
                        <Badge tone={st.tone}>{st.text}</Badge>
                        <span className="lb-figures text-sm font-semibold text-text-primary sm:w-24 sm:text-right">{formatCurrency(r.amount)}</span>
                        <Actions r={r} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}
        </>
      )}

      <Drawer open={creating} onClose={() => setCreating(false)} title={`Lançar extra · ${title}`}>
        {creating && <CreateForm kind={kind} hint={hint} members={members} onDone={() => setCreating(false)} />}
      </Drawer>
      <Drawer open={!!editing} onClose={() => setEditing(null)} title="Editar extra">
        {editing && <EditForm key={editing.id} row={editing} onDone={() => setEditing(null)} />}
      </Drawer>
    </div>
  );
}
