"use client";

import { useMemo, useState } from "react";
import { ArrowUpRight, CalendarCheck, MessageCircle, PhoneCall, Sparkles } from "lucide-react";
import { cn } from "@/lib/cn";
import { LEAD_STAGE_LABELS, LEAD_TEMPERATURE_LABELS } from "@/lib/validation/crm";
import type { LeadRow } from "./lead-board";

const TZ = "America/Sao_Paulo";

function dayKey(date: Date): number {
  const iso = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
  return Date.parse(`${iso}T00:00:00Z`) / 86400000;
}

// Dias até o contato (negativo = atrasado), no fuso de Brasília.
export function daysUntil(iso: string, now: number): number {
  return dayKey(new Date(iso)) - dayKey(new Date(now));
}

export function whatsappUrl(raw: string | null): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 10) return null;
  return `https://wa.me/${digits.length <= 11 ? `55${digits}` : digits}`;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

const TEMP_LEVEL: Record<string, { level: number; dot: string }> = {
  QUENTE: { level: 5, dot: "bg-error" },
  MORNO: { level: 3, dot: "bg-warning" },
  FRIO: { level: 1, dot: "bg-info" },
};

function InterestMeter({ temperature }: { temperature: string | null }) {
  const meta = temperature ? TEMP_LEVEL[temperature] : null;
  return (
    <span className="flex items-center gap-1" aria-label={temperature ? `Interesse ${LEAD_TEMPERATURE_LABELS[temperature as keyof typeof LEAD_TEMPERATURE_LABELS]}` : "Sem classificação"}>
      {Array.from({ length: 5 }, (_, i) => (
        <span key={i} className={cn("h-2.5 w-2.5 rounded-full", meta && i < meta.level ? meta.dot : "bg-text-tertiary/25")} />
      ))}
    </span>
  );
}

export function MyDaySection({
  leads,
  users,
  currentUserId,
  canSeeTeam,
  canEdit,
  now,
  onOpen,
}: {
  leads: LeadRow[];
  users: { id: string; name: string }[];
  currentUserId: string;
  canSeeTeam: boolean;
  canEdit: boolean;
  now: number;
  onOpen: (id: string, focusContact: boolean) => void;
}) {
  const [person, setPerson] = useState(currentUserId);

  const items = useMemo(() => {
    return leads
      .filter((l) => l.stage !== "FECHADO" && l.stage !== "PERDIDO" && (l.ownerUserId ?? l.createdBy?.id) === person)
      .map((l) => ({ lead: l, days: l.nextContactAt ? daysUntil(l.nextContactAt, now) : null }))
      .filter((x) => x.days === null || x.days <= 0)
      .sort((a, b) => (a.days ?? 1) - (b.days ?? 1));
  }, [leads, person, now]);

  const overdue = items.filter((x) => x.days !== null && x.days < 0).length;
  const today = items.filter((x) => x.days === 0).length;
  const noDate = items.filter((x) => x.days === null).length;
  const isMe = person === currentUserId;
  const personName = users.find((u) => u.id === person)?.name.split(" ")[0] ?? "";

  return (
    <section className="rounded-3xl border border-border bg-card p-4 sm:p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-accent/12 text-accent-light">
            <CalendarCheck size={20} />
          </span>
          <div>
            <h2 className="text-[17px] font-semibold tracking-tight text-text-primary">{isMe ? "Meu dia" : `Dia de ${personName}`}</h2>
            <p className="text-sm text-text-tertiary">
              {items.length === 0
                ? "Nenhum contato pendente — tudo em dia."
                : [overdue && `${overdue} atrasado${overdue === 1 ? "" : "s"}`, today && `${today} para hoje`, noDate && `${noDate} sem data marcada`]
                    .filter(Boolean)
                    .join(" · ")}
            </p>
          </div>
        </div>
        {canSeeTeam && (
          <select
            value={person}
            onChange={(e) => setPerson(e.target.value)}
            aria-label="Ver o dia de"
            className="h-10 rounded-full border border-border bg-card px-4 text-sm text-text-primary focus:outline-none"
          >
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.id === currentUserId ? "Meu dia" : `Dia de ${u.name}`}
              </option>
            ))}
          </select>
        )}
      </div>

      {items.length === 0 ? (
        <div className="flex items-center gap-3 rounded-2xl bg-success/8 px-4 py-4 text-sm text-text-secondary">
          <Sparkles size={18} className="shrink-0 text-success" />
          Sem follow-ups para hoje. Que tal cadastrar novos leads ou importar uma planilha?
        </div>
      ) : (
        <div className="scrollbar-thin -mx-1 flex snap-x gap-3 overflow-x-auto px-1 pb-1">
          {items.map(({ lead, days }) => {
            const wa = whatsappUrl(lead.whatsapp ?? lead.phone);
            const chip =
              days === null
                ? { label: "Sem data marcada", cls: "bg-card-elevated text-text-secondary" }
                : days < 0
                  ? { label: `Atrasado há ${-days} dia${days === -1 ? "" : "s"}`, cls: "bg-error text-white" }
                  : { label: "Para hoje", cls: "bg-warning text-black/80" };
            return (
              <article key={lead.id} className="flex w-[280px] shrink-0 snap-start flex-col gap-3 rounded-2xl border border-border bg-card-elevated/50 p-4">
                <div className="flex items-start justify-between gap-2">
                  <button type="button" onClick={() => onOpen(lead.id, false)} className="min-w-0 text-left">
                    <p className="truncate font-semibold text-text-primary hover:text-accent-light">{lead.company}</p>
                    <p className="truncate text-xs text-text-tertiary">
                      {[lead.contactName, LEAD_STAGE_LABELS[lead.stage as keyof typeof LEAD_STAGE_LABELS]].filter(Boolean).join(" · ")}
                    </p>
                  </button>
                  <InterestMeter temperature={lead.temperature} />
                </div>
                <span className={cn("self-start rounded-full px-2.5 py-1 text-xs font-medium", chip.cls)}>{chip.label}</span>
                <div className="mt-auto flex items-center gap-2">
                  {wa && (
                    <a
                      href={wa}
                      target="_blank"
                      rel="noreferrer"
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-success/12 text-success hover:bg-success/20"
                      aria-label={`WhatsApp de ${lead.company}`}
                    >
                      <MessageCircle size={17} />
                    </a>
                  )}
                  {canEdit && (
                    <button
                      type="button"
                      onClick={() => onOpen(lead.id, true)}
                      className="flex h-10 flex-1 items-center justify-center gap-2 rounded-full bg-ink px-4 text-sm font-medium text-ink-on hover:opacity-90"
                    >
                      <PhoneCall size={15} /> Registrar contato
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

const TEMP_FILTERS = [
  { key: "TODOS", label: "Todos" },
  { key: "QUENTE", label: "Quentes" },
  { key: "MORNO", label: "Mornos" },
  { key: "FRIO", label: "Frios" },
  { key: "NENHUMA", label: "Sem classificação" },
] as const;

export function NewLeadsStrip({
  leads,
  onOpen,
  onSeeAll,
}: {
  leads: LeadRow[];
  onOpen: (id: string) => void;
  onSeeAll: () => void;
}) {
  const [filter, setFilter] = useState<(typeof TEMP_FILTERS)[number]["key"]>("TODOS");
  const fresh = useMemo(() => leads.filter((l) => l.stage === "LEAD").sort((a, b) => b.createdAt.localeCompare(a.createdAt)), [leads]);
  const visible = fresh.filter((l) => (filter === "TODOS" ? true : filter === "NENHUMA" ? !l.temperature : l.temperature === filter));

  if (fresh.length === 0) return null;

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="mr-1 text-[17px] font-semibold tracking-tight text-text-primary">Novos leads</h2>
        <button type="button" onClick={onSeeAll} className="rounded-full bg-card-elevated px-2.5 py-0.5 text-xs font-medium text-text-secondary underline-offset-2 hover:underline">
          {fresh.length} sem contato
        </button>
        <div className="scrollbar-thin -mx-1 flex flex-1 gap-1.5 overflow-x-auto px-1 sm:justify-end">
          {TEMP_FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              aria-pressed={filter === f.key}
              onClick={() => setFilter(f.key)}
              className={cn(
                "h-9 shrink-0 rounded-full border px-3.5 text-sm font-medium transition-colors",
                filter === f.key ? "border-transparent bg-ink text-ink-on" : "border-border bg-card text-text-secondary hover:text-text-primary",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>
      {visible.length === 0 ? (
        <p className="rounded-2xl border border-border bg-card px-4 py-6 text-center text-sm text-text-tertiary">Nenhum lead novo com esse filtro.</p>
      ) : (
        <div className="scrollbar-thin -mx-1 flex snap-x gap-3 overflow-x-auto px-1 pb-1">
          {visible.slice(0, 15).map((lead) => (
            <button
              key={lead.id}
              type="button"
              onClick={() => onOpen(lead.id)}
              className="group flex w-[230px] shrink-0 snap-start flex-col gap-3 rounded-3xl border border-border bg-card p-4 text-left transition-colors hover:border-text-tertiary/60"
            >
              <div className="flex items-start justify-between">
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-accent/15 text-sm font-semibold text-accent-light">{initials(lead.company)}</span>
                <span className="flex h-9 w-9 items-center justify-center rounded-full border border-border text-text-tertiary group-hover:bg-ink group-hover:text-ink-on">
                  <ArrowUpRight size={16} />
                </span>
              </div>
              <div className="min-w-0">
                <p className="truncate font-semibold text-text-primary">{lead.company}</p>
                <p className="truncate text-xs text-text-tertiary">{[lead.contactName, lead.segment, lead.city].filter(Boolean).join(" · ") || "Sem detalhes ainda"}</p>
              </div>
              <div className="flex items-end justify-between gap-2">
                <div className="min-w-0">
                  <p className="mb-1 text-[11px] text-text-tertiary">Origem</p>
                  <span className="inline-block max-w-[110px] truncate rounded-full bg-card-elevated px-2.5 py-1 text-xs text-text-secondary">{lead.source || "—"}</span>
                </div>
                <div className="text-right">
                  <p className="mb-1.5 text-[11px] text-text-tertiary">
                    {lead.temperature ? LEAD_TEMPERATURE_LABELS[lead.temperature as keyof typeof LEAD_TEMPERATURE_LABELS] : "Interesse"}
                  </p>
                  <InterestMeter temperature={lead.temperature} />
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
