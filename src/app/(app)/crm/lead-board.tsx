"use client";

import { useEffect, useMemo, useState, useSyncExternalStore, useTransition } from "react";
import {
  AlertCircle,
  Building2,
  ChevronLeft,
  ChevronRight,
  Columns3,
  List,
  MessageCircle,
  Plus,
  Search,
  Target,
  TrendingUp,
  Upload,
  UserPlus,
  Wallet,
  X,
} from "lucide-react";
import { LEAD_STAGES, LEAD_STAGE_LABELS, LEAD_TEMPERATURE_LABELS } from "@/lib/validation/crm";
import {
  createLeadAction,
  updateLeadAction,
  updateLeadStageAction,
  deleteLeadAction,
  convertLeadToClientAction,
} from "@/lib/actions/crm-actions";
import { formatCurrency, formatDate } from "@/lib/format";
import { cn } from "@/lib/cn";
import { Drawer } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Badge, StatusDot } from "@/components/ui/badge";
import { MetricCard } from "@/components/ui/metric-card";
import { Sparkline } from "@/components/ui/sparkline";
import { Avatar } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/empty-state";
import { LeadForm, type LeadFormValues, type ServiceOption } from "./lead-form";
import { LeadImport } from "./lead-import";
import { LeadContactPanel } from "./lead-contact-panel";
import { MyDaySection, NewLeadsStrip } from "./crm-today";

type Stage = (typeof LEAD_STAGES)[number];
type Tone = "neutral" | "success" | "warning" | "error" | "info" | "accent";

export interface LeadRow {
  id: string;
  company: string;
  contactName: string | null;
  phone: string | null;
  whatsapp: string | null;
  instagram: string | null;
  website: string | null;
  city: string | null;
  segment: string | null;
  source: string | null;
  temperature: string | null;
  ownerUserId: string | null;
  owner: { id: string; name: string } | null;
  createdBy: { id: string; name: string } | null;
  potentialValue: number | null;
  probability: number;
  stage: string;
  nextContactAt: string | null;
  lastContactAt: string | null;
  notes: string | null;
  convertedClientId: string | null;
  createdAt: string;
  serviceIds: string[];
}

export interface LeadActivity {
  id: string;
  action: string;
  leadId: string | null;
  company: string;
  from: string | null;
  to: string | null;
  userId: string | null;
  userName: string;
  createdAt: string;
}

interface Permissions {
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canManage: boolean;
  canSeeTeam: boolean;
}

const STAGE_GROUPS: { key: string; label: string; stages: Stage[]; tone: Tone }[] = [
  { key: "novos", label: "Novos", stages: ["LEAD"], tone: "info" },
  { key: "contato", label: "Em contato", stages: ["CONTATO", "QUALIFICADO"], tone: "warning" },
  { key: "negociacao", label: "Em negociação", stages: ["REUNIAO", "PROPOSTA", "NEGOCIACAO"], tone: "accent" },
  { key: "fechados", label: "Fechados", stages: ["FECHADO"], tone: "success" },
  { key: "perdidos", label: "Perdidos", stages: ["PERDIDO"], tone: "neutral" },
];

const STAGE_TONE: Record<string, Tone> = Object.fromEntries(
  STAGE_GROUPS.flatMap((g) => g.stages.map((s) => [s, g.tone])),
);

const GROUP_TILE: Record<Tone, string> = {
  info: "bg-info/8",
  warning: "bg-warning/8",
  accent: "bg-accent/8",
  success: "bg-success/8",
  neutral: "bg-card-elevated",
  error: "bg-error/8",
};

const DOT: Record<Tone, string> = {
  info: "bg-info",
  warning: "bg-warning",
  accent: "bg-accent",
  success: "bg-success",
  neutral: "bg-text-tertiary",
  error: "bg-error",
};

const TEMPERATURE_TONE: Record<string, Tone> = { QUENTE: "error", MORNO: "warning", FRIO: "info" };

const PAGE_SIZE = 12;
const VIEW_KEY = "lb-crm-view";
const VIEW_EVENT = "lb-crm-view-change";

function subscribeView(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(VIEW_EVENT, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(VIEW_EVENT, callback);
  };
}

function readView(): "lista" | "quadro" {
  try {
    return window.localStorage.getItem(VIEW_KEY) === "quadro" ? "quadro" : "lista";
  } catch {
    return "lista";
  }
}
const DAY = 24 * 60 * 60 * 1000;

function toFormValues(lead: LeadRow): LeadFormValues {
  return {
    company: lead.company,
    contactName: lead.contactName,
    phone: lead.phone,
    whatsapp: lead.whatsapp,
    instagram: lead.instagram,
    website: lead.website,
    city: lead.city,
    segment: lead.segment,
    source: lead.source,
    temperature: lead.temperature,
    ownerUserId: lead.ownerUserId,
    potentialValue: lead.potentialValue,
    probability: lead.probability,
    stage: lead.stage,
    nextContactAt: lead.nextContactAt,
    notes: lead.notes,
    serviceIds: lead.serviceIds,
  };
}

function isOpen(lead: LeadRow): boolean {
  return lead.stage !== "FECHADO" && lead.stage !== "PERDIDO";
}

function isOverdue(lead: LeadRow): boolean {
  if (!isOpen(lead)) return false;
  if (!lead.nextContactAt) return true;
  return new Date(lead.nextContactAt).getTime() < Date.now() - DAY / 2;
}

function whatsappUrl(raw: string | null): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 10) return null;
  return `https://wa.me/${digits.length <= 11 ? `55${digits}` : digits}`;
}

function startOfWeek(date: Date): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const offset = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - offset);
  return d;
}

function weeklySeries(leads: LeadRow[], weight: (l: LeadRow) => number) {
  const thisWeek = startOfWeek(new Date());
  const starts = Array.from({ length: 12 }, (_, i) => new Date(thisWeek.getTime() - (11 - i) * 7 * DAY));
  const values = starts.map(() => 0);
  for (const lead of leads) {
    const created = new Date(lead.createdAt).getTime();
    const idx = starts.findIndex((s, i) => created >= s.getTime() && (i === 11 || created < starts[i + 1].getTime()));
    if (idx >= 0) values[idx] += weight(lead);
  }
  const labels = starts.map((s) => `Semana de ${s.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}`);
  return { values, labels };
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.round(diff / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  const hours = Math.round(min / 60);
  if (hours < 24) return `há ${hours} h`;
  const days = Math.round(hours / 24);
  if (days === 1) return "ontem";
  if (days < 7) return `há ${days} dias`;
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

function stageLabel(stage: string | null): string {
  return stage ? (LEAD_STAGE_LABELS[stage as Stage] ?? stage) : "";
}

function describeActivity(a: LeadActivity): string {
  switch (a.action) {
    case "LEAD_CREATED":
      return `cadastrou ${a.company}`;
    case "LEAD_STAGE_CHANGED":
      return `moveu ${a.company} de ${stageLabel(a.from)} para ${stageLabel(a.to)}`;
    case "LEAD_UPDATED":
      return `atualizou ${a.company}`;
    case "LEAD_DELETED":
      return `excluiu ${a.company}`;
    case "LEAD_CONTACTED":
      return `registrou contato com ${a.company}`;
    case "LEAD_CONVERTED_TO_CLIENT":
      return `converteu ${a.company} em cliente`;
    default:
      return `alterou ${a.company}`;
  }
}

const selectClass =
  "h-10 min-w-0 flex-1 rounded-full border border-border bg-card px-4 text-sm text-text-primary focus:outline-none focus:ring-4 focus:ring-accent/15 sm:flex-none";

export function LeadBoard({
  leads,
  users,
  currentUserId,
  currency,
  permissions,
  activity,
  services,
  now,
}: {
  leads: LeadRow[];
  users: { id: string; name: string; avatarUrl: string | null }[];
  currentUserId: string;
  currency: string;
  permissions: Permissions;
  activity: LeadActivity[];
  services: ServiceOption[];
  now: number;
}) {
  const [creating, setCreating] = useState(false);
  const [importing, setImporting] = useState(false);
  const [focusContact, setFocusContact] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [serviceFilter, setServiceFilter] = useState("TODOS");

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(timer);
  }, [toast]);
  const [editingLeadId, setEditingLeadId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const view = useSyncExternalStore(subscribeView, readView, () => "lista" as const);
  const [search, setSearch] = useState("");
  const [groupFilter, setGroupFilter] = useState<string | null>(null);
  const [ownerFilter, setOwnerFilter] = useState("TODOS");
  const [creatorFilter, setCreatorFilter] = useState("TODOS");
  const [temperatureFilter, setTemperatureFilter] = useState("TODAS");
  const [sort, setSort] = useState<"recentes" | "proximo" | "valor">("recentes");
  const [page, setPage] = useState(1);
  const [onlyFollowUp, setOnlyFollowUp] = useState(false);
  const [showAllActivity, setShowAllActivity] = useState(false);

  function changeView(next: "lista" | "quadro") {
    try {
      window.localStorage.setItem(VIEW_KEY, next);
    } catch {}
    window.dispatchEvent(new Event(VIEW_EVENT));
  }

  function withPageReset<T>(setter: (v: T) => void) {
    return (v: T) => {
      setter(v);
      setPage(1);
    };
  }

  const editingLead = editingLeadId ? (leads.find((l) => l.id === editingLeadId) ?? null) : null;
  const money = (v: number) => formatCurrency(v, currency);

  const stats = useMemo(() => {
    const open = leads.filter(isOpen);
    const pipelineOpen = open.reduce((sum, l) => sum + (l.potentialValue ?? 0), 0);
    const new30 = leads.filter((l) => now - new Date(l.createdAt).getTime() <= 30 * DAY).length;
    const prev30 = leads.filter((l) => {
      const age = now - new Date(l.createdAt).getTime();
      return age > 30 * DAY && age <= 60 * DAY;
    }).length;
    const closed = leads.filter((l) => l.stage === "FECHADO").length;
    const lost = leads.filter((l) => l.stage === "PERDIDO").length;
    const conversion = closed + lost > 0 ? Math.round((closed / (closed + lost)) * 100) : 0;
    const followUpDue = open.filter(isOverdue).length;
    const newTrend =
      prev30 > 0 ? { value: `${Math.abs(Math.round(((new30 - prev30) / prev30) * 100))}%`, positive: new30 >= prev30 } : null;
    return {
      openCount: open.length,
      pipelineOpen,
      new30,
      newTrend,
      closed,
      lost,
      conversion,
      followUpDue,
      newSeries: weeklySeries(leads, () => 1),
      valueSeries: weeklySeries(leads, (l) => l.potentialValue ?? 0),
    };
  }, [leads, now]);

  const groupCounts = useMemo(
    () =>
      STAGE_GROUPS.map((g) => {
        const items = leads.filter((l) => g.stages.includes(l.stage as Stage));
        return { ...g, count: items.length, value: items.reduce((s, l) => s + (l.potentialValue ?? 0), 0) };
      }),
    [leads],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const group = STAGE_GROUPS.find((g) => g.key === groupFilter);
    const result = leads.filter((l) => {
      if (group && !group.stages.includes(l.stage as Stage)) return false;
      if (onlyFollowUp && !isOverdue(l)) return false;
      if (ownerFilter === "NENHUM" ? l.ownerUserId : ownerFilter !== "TODOS" && l.ownerUserId !== ownerFilter) return false;
      if (creatorFilter !== "TODOS" && l.createdBy?.id !== creatorFilter) return false;
      if (temperatureFilter !== "TODAS" && (l.temperature ?? "") !== (temperatureFilter === "NENHUMA" ? "" : temperatureFilter)) return false;
      if (serviceFilter !== "TODOS" && !l.serviceIds.includes(serviceFilter)) return false;
      if (!q) return true;
      return [l.company, l.contactName, l.whatsapp, l.phone, l.instagram, l.city, l.segment, l.source]
        .filter(Boolean)
        .some((v) => v!.toLowerCase().includes(q));
    });
    return result.sort((a, b) => {
      if (sort === "valor") return (b.potentialValue ?? 0) - (a.potentialValue ?? 0);
      if (sort === "proximo") {
        const av = a.nextContactAt ? new Date(a.nextContactAt).getTime() : Infinity;
        const bv = b.nextContactAt ? new Date(b.nextContactAt).getTime() : Infinity;
        return av - bv;
      }
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [leads, search, groupFilter, onlyFollowUp, ownerFilter, creatorFilter, temperatureFilter, serviceFilter, sort]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pageItems = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const team = useMemo(() => {
    if (!permissions.canSeeTeam) return [];
    return users
      .map((u) => {
        const created30 = leads.filter((l) => l.createdBy?.id === u.id && now - new Date(l.createdAt).getTime() <= 30 * DAY).length;
        const createdTotal = leads.filter((l) => l.createdBy?.id === u.id).length;
        const openOwned = leads.filter((l) => l.ownerUserId === u.id && isOpen(l)).length;
        const closedOwned = leads.filter((l) => l.ownerUserId === u.id && l.stage === "FECHADO").length;
        const last = activity.find((a) => a.userId === u.id);
        return { ...u, created30, createdTotal, openOwned, closedOwned, lastAt: last?.createdAt ?? null };
      })
      .filter((u) => u.createdTotal + u.openOwned + u.closedOwned > 0 || u.lastAt)
      .sort((a, b) => b.created30 - a.created30 || b.openOwned - a.openOwned);
  }, [permissions.canSeeTeam, users, leads, activity, now]);

  const hasActiveFilters =
    !!search || !!groupFilter || onlyFollowUp || ownerFilter !== "TODOS" || creatorFilter !== "TODOS" || temperatureFilter !== "TODAS" || serviceFilter !== "TODOS";

  function handleStageChange(leadId: string, stage: string) {
    startTransition(() => updateLeadStageAction(leadId, stage));
  }

  function clearFilters() {
    setSearch("");
    setGroupFilter(null);
    setOnlyFollowUp(false);
    setOwnerFilter("TODOS");
    setCreatorFilter("TODOS");
    setTemperatureFilter("TODAS");
    setServiceFilter("TODOS");
    setPage(1);
  }

  function stageControl(lead: LeadRow, className?: string) {
    if (!permissions.canEdit) {
      return (
        <Badge tone={STAGE_TONE[lead.stage] ?? "neutral"} dot>
          {stageLabel(lead.stage)}
        </Badge>
      );
    }
    return (
      <span className={cn("relative inline-flex items-center", className)} onClick={(e) => e.stopPropagation()}>
        <span className={cn("pointer-events-none absolute left-3 h-1.5 w-1.5 rounded-full", DOT[STAGE_TONE[lead.stage] ?? "neutral"])} />
        <select
          value={lead.stage}
          disabled={isPending}
          aria-label={`Estágio de ${lead.company}`}
          onChange={(e) => handleStageChange(lead.id, e.target.value)}
          className="h-8 cursor-pointer appearance-none rounded-full border border-border bg-card-elevated pl-6 pr-3 text-xs font-medium text-text-primary focus:outline-none focus:ring-4 focus:ring-accent/15"
        >
          {LEAD_STAGES.map((s) => (
            <option key={s} value={s}>
              {LEAD_STAGE_LABELS[s]}
            </option>
          ))}
        </select>
      </span>
    );
  }

  function whatsappButton(lead: LeadRow) {
    const url = whatsappUrl(lead.whatsapp ?? lead.phone);
    if (!url) return null;
    return (
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        onClick={(e) => e.stopPropagation()}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border text-success hover:bg-success/10"
        aria-label={`Abrir WhatsApp de ${lead.company}`}
        title="Abrir WhatsApp"
      >
        <MessageCircle size={16} />
      </a>
    );
  }

  function nextContact(lead: LeadRow) {
    const overdue = isOverdue(lead);
    if (!lead.nextContactAt) {
      return <span className={cn("text-sm", overdue ? "text-warning" : "text-text-tertiary")}>{overdue ? "Agendar contato" : "—"}</span>;
    }
    return (
      <span className={cn("inline-flex items-center gap-1 text-sm", overdue ? "font-medium text-warning" : "text-text-secondary")}>
        {overdue && <AlertCircle size={13} />}
        {formatDate(new Date(lead.nextContactAt))}
      </span>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Pipeline em aberto"
          value={money(stats.pipelineOpen)}
          caption={`${stats.openCount} lead${stats.openCount === 1 ? "" : "s"} em andamento`}
          icon={<Wallet />}
          tone="accent"
        >
          <Sparkline
            values={stats.valueSeries.values}
            labels={stats.valueSeries.labels}
            formatValue={money}
            inverted
            ariaLabel="Valor potencial cadastrado por semana nas últimas 12 semanas"
          />
        </MetricCard>
        <MetricCard
          label="Novos leads"
          value={String(stats.new30)}
          trend={stats.newTrend}
          caption="últimos 30 dias"
          icon={<UserPlus />}
        >
          <Sparkline
            values={stats.newSeries.values}
            labels={stats.newSeries.labels}
            formatValue={(v) => `${v} lead${v === 1 ? "" : "s"}`}
            ariaLabel="Leads cadastrados por semana nas últimas 12 semanas"
          />
        </MetricCard>
        <MetricCard
          label="Taxa de conversão"
          value={`${stats.conversion}%`}
          caption={`${stats.closed} fechado${stats.closed === 1 ? "" : "s"} · ${stats.lost} perdido${stats.lost === 1 ? "" : "s"}`}
          icon={<TrendingUp />}
        >
          <div className="mt-auto h-2 overflow-hidden rounded-full bg-card-elevated">
            <div className="h-full rounded-full bg-accent" style={{ width: `${stats.conversion}%` }} />
          </div>
        </MetricCard>
        <MetricCard
          label="Follow-ups pendentes"
          value={String(stats.followUpDue)}
          caption="sem data ou com contato atrasado"
          icon={<Target />}
        >
          {stats.followUpDue > 0 && (
            <button
              type="button"
              onClick={() => {
                setOnlyFollowUp(true);
                setGroupFilter(null);
                withPageReset(setSort)("proximo");
              }}
              className="mt-auto self-start text-sm font-medium text-accent-light hover:underline"
            >
              Ver quem precisa de contato
            </button>
          )}
        </MetricCard>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {groupCounts.map((g) => {
          const active = groupFilter === g.key;
          return (
            <button
              key={g.key}
              type="button"
              aria-pressed={active}
              onClick={() => withPageReset(setGroupFilter)(active ? null : g.key)}
              className={cn(
                "flex flex-col gap-1.5 rounded-2xl border p-4 text-left transition-all",
                GROUP_TILE[g.tone],
                active ? "border-text-primary ring-1 ring-text-primary" : "border-transparent hover:border-border",
              )}
            >
              <span className="flex items-center gap-2 text-sm font-medium text-text-secondary">
                <span className={cn("h-2 w-2 rounded-full", DOT[g.tone])} />
                {g.label}
              </span>
              <span className="text-[26px] font-semibold leading-none tracking-tight text-text-primary">{g.count}</span>
              <span className="text-xs text-text-tertiary">{g.value > 0 ? money(g.value) : "sem valor estimado"}</span>
            </button>
          );
        })}
      </div>

      <MyDaySection
        leads={leads}
        users={users}
        currentUserId={currentUserId}
        canSeeTeam={permissions.canSeeTeam}
        canEdit={permissions.canEdit}
        now={now}
        onOpen={(id, contact) => {
          setFocusContact(contact);
          setEditingLeadId(id);
        }}
      />

      <NewLeadsStrip
        leads={leads}
        onOpen={(id) => {
          setFocusContact(false);
          setEditingLeadId(id);
        }}
        onSeeAll={() => withPageReset(setGroupFilter)("novos")}
      />

      {permissions.canSeeTeam && (
        <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-5">
          <section className="rounded-2xl border border-border bg-card p-5 lg:col-span-3">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-[17px] font-semibold tracking-tight text-text-primary">Equipe comercial</h2>
                <p className="mt-0.5 text-sm text-text-tertiary">Clique em alguém para ver só os leads que essa pessoa cadastrou.</p>
              </div>
              <Badge tone="neutral">Visível só para administradores</Badge>
            </div>
            {team.length === 0 ? (
              <p className="py-6 text-center text-sm text-text-tertiary">Ninguém cadastrou leads ainda.</p>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-bg-secondary text-left text-xs text-text-tertiary">
                      <th className="px-3 py-2.5 font-medium">Pessoa</th>
                      <th className="px-3 py-2.5 text-right font-medium">Cadastrou (30d)</th>
                      <th className="px-3 py-2.5 text-right font-medium">Em aberto</th>
                      <th className="px-3 py-2.5 text-right font-medium">Fechados</th>
                      <th className="px-3 py-2.5 font-medium">Última ação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {team.map((u) => {
                      const selected = creatorFilter === u.id;
                      return (
                        <tr
                          key={u.id}
                          onClick={() => withPageReset(setCreatorFilter)(selected ? "TODOS" : u.id)}
                          className={cn(
                            "cursor-pointer border-t border-border transition-colors",
                            selected ? "bg-accent/8" : "hover:bg-card-elevated",
                          )}
                        >
                          <td className="px-3 py-2.5">
                            <span className="flex items-center gap-2.5">
                              <Avatar name={u.name} src={u.avatarUrl} size="sm" />
                              <span className="font-medium text-text-primary">{u.name}</span>
                            </span>
                          </td>
                          <td className="lb-figures px-3 py-2.5 text-right text-text-primary">{u.created30}</td>
                          <td className="lb-figures px-3 py-2.5 text-right text-text-secondary">{u.openOwned}</td>
                          <td className="lb-figures px-3 py-2.5 text-right text-text-secondary">{u.closedOwned}</td>
                          <td className="px-3 py-2.5 text-text-tertiary" suppressHydrationWarning>
                            {u.lastAt ? relativeTime(u.lastAt) : "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="flex flex-col rounded-2xl border border-border bg-card p-5 lg:col-span-2">
            <h2 className="text-[17px] font-semibold tracking-tight text-text-primary">Atividade recente</h2>
            <p className="mt-0.5 text-sm text-text-tertiary">Tudo o que a equipe fez no CRM.</p>
            {activity.length === 0 ? (
              <p className="py-6 text-center text-sm text-text-tertiary">Nenhuma atividade registrada ainda.</p>
            ) : (
              <ol className={cn("scrollbar-thin mt-4 flex flex-col gap-3 overflow-y-auto pr-1", showAllActivity ? "max-h-[420px]" : "")}>
                {activity.slice(0, showAllActivity ? 60 : 7).map((a) => (
                  <li key={a.id} className="flex items-start gap-3">
                    <Avatar name={a.userName} size="sm" className="mt-0.5 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-text-secondary">
                        <span className="font-medium text-text-primary">{a.userName}</span> {describeActivity(a)}
                      </p>
                      <p className="text-xs text-text-tertiary" suppressHydrationWarning>
                        {relativeTime(a.createdAt)}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            )}
            {activity.length > 7 && (
              <button
                type="button"
                onClick={() => setShowAllActivity((v) => !v)}
                className="mt-4 self-start text-sm font-medium text-accent-light hover:underline"
              >
                {showAllActivity ? "Mostrar menos" : "Ver toda a atividade"}
              </button>
            )}
          </section>
        </div>
      )}

      <section className="rounded-3xl border border-border bg-card p-4 sm:p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h2 className="text-[17px] font-semibold tracking-tight text-text-primary">Leads</h2>
            <span className="rounded-full bg-card-elevated px-2.5 py-0.5 text-xs font-medium text-text-secondary">{filtered.length}</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-full border border-border bg-card-elevated p-1" role="group" aria-label="Modo de visualização">
              {(
                [
                  ["lista", "Lista", List],
                  ["quadro", "Quadro", Columns3],
                ] as const
              ).map(([key, label, Icon]) => (
                <button
                  key={key}
                  type="button"
                  aria-pressed={view === key}
                  onClick={() => changeView(key)}
                  className={cn(
                    "flex h-8 items-center gap-1.5 rounded-full px-3 text-sm font-medium",
                    view === key ? "bg-card text-text-primary shadow-sm" : "text-text-tertiary hover:text-text-secondary",
                  )}
                >
                  <Icon size={14} />
                  <span className="hidden sm:inline">{label}</span>
                </button>
              ))}
            </div>
            {permissions.canCreate && (
              <Button variant="outline" onClick={() => setImporting(true)} className="h-10 whitespace-nowrap">
                <Upload size={15} /> <span className="hidden sm:inline">Importar planilha</span>
              </Button>
            )}
            {permissions.canCreate && (
              <Button onClick={() => setCreating(true)} className="h-10 whitespace-nowrap">
                <Plus size={16} /> Novo lead
              </Button>
            )}
          </div>
        </div>

        <div className="mb-4 flex flex-wrap items-center gap-2">
          <div className="relative min-w-[220px] flex-1">
            <Search size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-text-tertiary" />
            <input
              value={search}
              onChange={(e) => withPageReset(setSearch)(e.target.value)}
              placeholder="Buscar por empresa, contato, cidade, origem..."
              aria-label="Buscar leads"
              className="h-10 w-full rounded-full border border-border bg-card pl-10 pr-4 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-4 focus:ring-accent/15"
            />
          </div>
          <select value={ownerFilter} onChange={(e) => withPageReset(setOwnerFilter)(e.target.value)} aria-label="Filtrar por responsável" className={selectClass}>
            <option value="TODOS">Todos os responsáveis</option>
            <option value={currentUserId}>Meus leads</option>
            <option value="NENHUM">Sem responsável</option>
            {users
              .filter((u) => u.id !== currentUserId)
              .map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
          </select>
          {permissions.canSeeTeam && (
            <select value={creatorFilter} onChange={(e) => withPageReset(setCreatorFilter)(e.target.value)} aria-label="Filtrar por quem cadastrou" className={selectClass}>
              <option value="TODOS">Cadastrado por: todos</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  Cadastrado por: {u.name}
                </option>
              ))}
            </select>
          )}
          <select value={temperatureFilter} onChange={(e) => withPageReset(setTemperatureFilter)(e.target.value)} aria-label="Filtrar por temperatura" className={selectClass}>
            <option value="TODAS">Todas as temperaturas</option>
            <option value="QUENTE">Quentes</option>
            <option value="MORNO">Mornos</option>
            <option value="FRIO">Frios</option>
            <option value="NENHUMA">Sem classificação</option>
          </select>
          {services.length > 0 && (
            <select value={serviceFilter} onChange={(e) => withPageReset(setServiceFilter)(e.target.value)} aria-label="Filtrar por serviço de interesse" className={selectClass}>
              <option value="TODOS">Todos os serviços</option>
              {services.map((sv) => (
                <option key={sv.id} value={sv.id}>
                  {sv.name}
                </option>
              ))}
            </select>
          )}
          <select value={sort} onChange={(e) => withPageReset(setSort)(e.target.value as typeof sort)} aria-label="Ordenar" className={selectClass}>
            <option value="recentes">Mais recentes</option>
            <option value="proximo">Próximo contato</option>
            <option value="valor">Maior valor</option>
          </select>
          {onlyFollowUp && (
            <button
              type="button"
              onClick={() => withPageReset(setOnlyFollowUp)(false)}
              className="inline-flex h-10 items-center gap-1.5 rounded-full bg-warning/12 px-4 text-sm font-medium text-warning"
            >
              Só follow-ups pendentes ×
            </button>
          )}
          {hasActiveFilters && (
            <button type="button" onClick={clearFilters} className="h-10 rounded-full px-3 text-sm font-medium text-text-secondary hover:text-text-primary">
              Limpar filtros
            </button>
          )}
        </div>

        {leads.length === 0 ? (
          <EmptyState
            icon={<Building2 size={24} />}
            title="Nenhum lead cadastrado ainda"
            description="Cadastre o primeiro lead — leva menos de um minuto."
            action={
              permissions.canCreate && (
                <Button onClick={() => setCreating(true)}>
                  <Plus size={16} /> Cadastrar lead
                </Button>
              )
            }
          />
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl bg-card-elevated py-12 text-center">
            <p className="text-sm font-medium text-text-primary">Nenhum lead com esses filtros.</p>
            <button type="button" onClick={clearFilters} className="mt-2 text-sm font-medium text-accent-light hover:underline">
              Limpar filtros
            </button>
          </div>
        ) : view === "lista" ? (
          <>
            <div className="flex flex-col gap-2 md:hidden">
              {pageItems.map((lead) => (
                <div
                  key={lead.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => setEditingLeadId(lead.id)}
                  onKeyDown={(e) => e.key === "Enter" && setEditingLeadId(lead.id)}
                  className="flex flex-col gap-3 rounded-2xl border border-border p-4 active:bg-card-elevated"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-text-primary">{lead.company}</p>
                      <p className="truncate text-sm text-text-tertiary">
                        {[lead.contactName, lead.source].filter(Boolean).join(" · ") || "Sem contato informado"}
                      </p>
                    </div>
                    {whatsappButton(lead)}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {stageControl(lead)}
                    {lead.temperature && (
                      <Badge tone={TEMPERATURE_TONE[lead.temperature] ?? "neutral"} dot>
                        {LEAD_TEMPERATURE_LABELS[lead.temperature as keyof typeof LEAD_TEMPERATURE_LABELS]}
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="lb-figures text-text-primary">{lead.potentialValue != null ? money(lead.potentialValue) : "—"}</span>
                    {nextContact(lead)}
                  </div>
                  {(lead.owner || (permissions.canSeeTeam && lead.createdBy)) && (
                    <p className="text-xs text-text-tertiary">
                      {lead.owner && <>Responsável: {lead.owner.name}</>}
                      {lead.owner && permissions.canSeeTeam && lead.createdBy && " · "}
                      {permissions.canSeeTeam && lead.createdBy && <>Cadastrado por {lead.createdBy.name}</>}
                    </p>
                  )}
                </div>
              ))}
            </div>

            <div className="hidden overflow-x-auto rounded-2xl border border-border md:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="whitespace-nowrap bg-bg-secondary text-left text-xs text-text-tertiary">
                    <th className="px-4 py-3 font-medium">Lead</th>
                    <th className="px-4 py-3 font-medium">Estágio</th>
                    <th className="px-4 py-3 font-medium">Temperatura</th>
                    <th className="px-4 py-3 text-right font-medium">Valor</th>
                    <th className="px-4 py-3 font-medium">Próximo contato</th>
                    <th className="px-4 py-3 font-medium">Responsável</th>
                    {permissions.canSeeTeam && <th className="px-4 py-3 font-medium">Cadastrado por</th>}
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {pageItems.map((lead) => (
                    <tr
                      key={lead.id}
                      onClick={() => setEditingLeadId(lead.id)}
                      className="cursor-pointer border-t border-border transition-colors hover:bg-card-elevated"
                    >
                      <td className="max-w-[260px] px-4 py-3">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingLeadId(lead.id);
                          }}
                          className="block max-w-full truncate text-left font-medium text-text-primary hover:text-accent-light"
                        >
                          {lead.company}
                        </button>
                        <p className="truncate text-xs text-text-tertiary">
                          {[lead.contactName, lead.whatsapp ?? lead.phone, lead.source].filter(Boolean).join(" · ") || "—"}
                        </p>
                      </td>
                      <td className="px-4 py-3">{stageControl(lead)}</td>
                      <td className="px-4 py-3">
                        {lead.temperature ? (
                          <StatusDot tone={TEMPERATURE_TONE[lead.temperature] ?? "neutral"}>
                            {LEAD_TEMPERATURE_LABELS[lead.temperature as keyof typeof LEAD_TEMPERATURE_LABELS]}
                          </StatusDot>
                        ) : (
                          <span className="text-text-tertiary">—</span>
                        )}
                      </td>
                      <td className="lb-figures whitespace-nowrap px-4 py-3 text-right text-text-primary">
                        {lead.potentialValue != null ? money(lead.potentialValue) : <span className="text-text-tertiary">—</span>}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">{nextContact(lead)}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-text-secondary">{lead.owner?.name ?? <span className="text-text-tertiary">—</span>}</td>
                      {permissions.canSeeTeam && (
                        <td className="whitespace-nowrap px-4 py-3">
                          <p className="text-text-secondary">{lead.createdBy?.name ?? "—"}</p>
                          <p className="text-xs text-text-tertiary">{formatDate(new Date(lead.createdAt))}</p>
                        </td>
                      )}
                      <td className="px-4 py-3">
                        <div className="flex justify-end">{whatsappButton(lead)}</div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {pageCount > 1 && (
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-text-tertiary">
                <span className="lb-figures">
                  {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, filtered.length)} de {filtered.length}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    disabled={currentPage === 1}
                    onClick={() => setPage(currentPage - 1)}
                    className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-card-elevated disabled:opacity-40"
                    aria-label="Página anterior"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  {Array.from({ length: pageCount }, (_, i) => i + 1)
                    .filter((p) => p === 1 || p === pageCount || Math.abs(p - currentPage) <= 1)
                    .map((p, i, arr) => (
                      <span key={p} className="flex items-center">
                        {i > 0 && p - arr[i - 1] > 1 && <span className="px-1">…</span>}
                        <button
                          type="button"
                          onClick={() => setPage(p)}
                          aria-current={p === currentPage ? "page" : undefined}
                          className={cn(
                            "lb-figures flex h-9 min-w-9 items-center justify-center rounded-full px-2 font-medium",
                            p === currentPage ? "bg-ink text-ink-on" : "text-text-secondary hover:bg-card-elevated",
                          )}
                        >
                          {p}
                        </button>
                      </span>
                    ))}
                  <button
                    type="button"
                    disabled={currentPage === pageCount}
                    onClick={() => setPage(currentPage + 1)}
                    className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-card-elevated disabled:opacity-40"
                    aria-label="Próxima página"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="scrollbar-thin -mx-1 flex gap-3 overflow-x-auto px-1 pb-2">
            {LEAD_STAGES.map((stage) => {
              const items = filtered.filter((l) => l.stage === stage);
              const total = items.reduce((sum, l) => sum + (l.potentialValue ?? 0), 0);
              const tone = STAGE_TONE[stage] ?? "neutral";
              return (
                <div key={stage} className="flex w-72 shrink-0 flex-col gap-2 rounded-2xl bg-card-elevated p-2.5">
                  <div className="flex items-center justify-between px-1.5 pt-1">
                    <span className="flex items-center gap-2 text-sm font-semibold text-text-primary">
                      <span className={cn("h-2 w-2 rounded-full", DOT[tone])} />
                      {LEAD_STAGE_LABELS[stage]}
                    </span>
                    <span className="rounded-full bg-card px-2 py-0.5 text-xs font-medium text-text-secondary">{items.length}</span>
                  </div>
                  <span className="lb-figures px-1.5 text-xs text-text-tertiary">{money(total)}</span>
                  <div className="flex flex-col gap-2">
                    {items.map((lead) => (
                      <div
                        key={lead.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => setEditingLeadId(lead.id)}
                        onKeyDown={(e) => e.key === "Enter" && setEditingLeadId(lead.id)}
                        className="flex cursor-pointer flex-col gap-2.5 rounded-xl border border-border bg-card p-3.5 text-left transition-colors hover:border-text-tertiary"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-text-primary">{lead.company}</p>
                            {lead.contactName && <p className="truncate text-xs text-text-tertiary">{lead.contactName}</p>}
                          </div>
                          {whatsappButton(lead)}
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5">
                          {lead.potentialValue != null && <Badge tone="neutral">{money(lead.potentialValue)}</Badge>}
                          {lead.temperature && (
                            <Badge tone={TEMPERATURE_TONE[lead.temperature] ?? "neutral"} dot>
                              {LEAD_TEMPERATURE_LABELS[lead.temperature as keyof typeof LEAD_TEMPERATURE_LABELS]}
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center justify-between gap-2 text-xs text-text-tertiary">
                          <span className="truncate">{lead.owner?.name ?? "Sem responsável"}</span>
                          {nextContact(lead)}
                        </div>
                        {permissions.canEdit && stageControl(lead, "self-start")}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <Drawer open={creating} onClose={() => setCreating(false)} title="Novo lead" description="Preencha o essencial agora — dá para completar depois.">
        <LeadForm
          action={createLeadAction}
          users={users}
          services={services}
          currentUserId={currentUserId}
          submitLabel="Cadastrar lead"
          onSuccess={() => setCreating(false)}
        />
      </Drawer>

      <Drawer
        open={!!editingLead}
        onClose={() => setEditingLeadId(null)}
        title={editingLead?.company ?? ""}
        description={editingLead?.convertedClientId ? "Convertido em cliente" : undefined}
      >
        {editingLead && (
          <div className="flex flex-col gap-6">
            <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-card-elevated px-4 py-3 text-sm text-text-secondary">
              <span>
                Cadastrado {editingLead.createdBy ? <>por <span className="font-medium text-text-primary">{editingLead.createdBy.name}</span> </> : ""}
                em {formatDate(new Date(editingLead.createdAt))}
              </span>
              {whatsappUrl(editingLead.whatsapp ?? editingLead.phone) && (
                <a
                  href={whatsappUrl(editingLead.whatsapp ?? editingLead.phone)!}
                  target="_blank"
                  rel="noreferrer"
                  className="ml-auto inline-flex items-center gap-1.5 font-medium text-success hover:underline"
                >
                  <MessageCircle size={14} /> WhatsApp
                </a>
              )}
            </div>

            <LeadContactPanel
              key={`contact-${editingLead.id}`}
              leadId={editingLead.id}
              canEdit={permissions.canEdit}
              autoFocus={focusContact}
              onLogged={(message) => {
                setToast(message);
                setFocusContact(false);
              }}
            />

            <details className="group rounded-3xl border border-border" open={!focusContact}>
              <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3.5 text-sm font-semibold text-text-primary [&::-webkit-details-marker]:hidden">
                Dados do lead
                <ChevronRight size={16} className="text-text-tertiary transition-transform group-open:rotate-90" />
              </summary>
              <div className="border-t border-border p-4">
                <LeadForm
                  key={editingLead.id}
                  action={updateLeadAction.bind(null, editingLead.id)}
                  defaultValues={toFormValues(editingLead)}
                  users={users}
                  services={services}
                  leadId={editingLead.id}
                  currentUserId={currentUserId}
                  submitLabel="Salvar alterações"
                  onSuccess={() => setToast("Lead atualizado.")}
                />
              </div>
            </details>

            <div className="flex flex-col gap-2 border-t border-border pt-5">
              {permissions.canManage && editingLead.stage === "FECHADO" && !editingLead.convertedClientId && (
                <Button
                  variant="secondary"
                  onClick={() =>
                    startTransition(async () => {
                      await convertLeadToClientAction(editingLead.id);
                      setEditingLeadId(null);
                    })
                  }
                >
                  Converter em cliente
                </Button>
              )}
              {permissions.canDelete && (
                <Button
                  variant="danger"
                  onClick={() => {
                    if (!confirm(`Excluir o lead "${editingLead.company}"?`)) return;
                    startTransition(async () => {
                      await deleteLeadAction(editingLead.id);
                      setEditingLeadId(null);
                    });
                  }}
                >
                  Excluir lead
                </Button>
              )}
            </div>
          </div>
        )}
      </Drawer>

      <Drawer open={importing} onClose={() => setImporting(false)} title="Importar planilha" description="Traga leads de um Excel ou CSV sem digitar de novo." widthClassName="max-w-[760px]">
        {importing && (
          <LeadImport
            onDone={(message) => {
              setImporting(false);
              setToast(message);
            }}
          />
        )}
      </Drawer>

      {toast && (
        <div role="status" className="fixed bottom-6 left-1/2 z-[60] flex -translate-x-1/2 items-center gap-3 rounded-full bg-ink px-5 py-3 text-sm font-medium text-ink-on shadow-2xl">
          {toast}
          <button type="button" onClick={() => setToast(null)} aria-label="Fechar aviso" className="opacity-70 hover:opacity-100">
            <X size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
