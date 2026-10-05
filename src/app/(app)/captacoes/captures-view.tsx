"use client";

import { useMemo, useState, useTransition } from "react";
import { Plus, Camera, CheckCircle2, MapPin, Trash2, Clock } from "lucide-react";
import { createCaptureAction, deleteCaptureAction, setCaptureFeeAction, setCaptureStatusAction, updateCaptureAction } from "@/lib/actions/capture-actions";
import { CAPTURE_STATUS_LABELS } from "@/lib/validation/captures";
import { CAPTURE_CREW_ROLE_LABELS } from "@/lib/validation/capture-assignments";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/cn";
import { MetricCard } from "@/components/ui/metric-card";
import { Drawer } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { CaptureForm, type CaptureFormValues } from "./capture-form";

interface CaptureRow {
  id: string;
  clientId: string;
  projectId: string | null;
  date: string;
  location: string | null;
  status: string;
  videomaker: string | null;
  photographer: string | null;
  storymaker: string | null;
  droneOperator: string | null;
  videoCount: number | null;
  photoCount: number | null;
  scriptNotes: string | null;
  equipment: string | null;
  clientName: string;
  projectName: string | null;
  videomakerUserId: string | null;
  photographerUserId: string | null;
  storymakerUserId: string | null;
  droneOperatorUserId: string | null;
  assignmentStatuses: Record<string, "PENDENTE" | "ACEITO" | "RECUSADO">;
  crew: { id: string; role: string; name: string; status: "PENDENTE" | "ACEITO" | "RECUSADO"; fee: number | null; feeManual: boolean; paid: boolean }[];
}

const ASSIGNMENT_ROLE_BY_FIELD: Record<"videomaker" | "photographer" | "storymaker" | "droneOperator", string> = {
  videomaker: "VIDEOMAKER",
  photographer: "PHOTOGRAPHER",
  storymaker: "STORYMAKER",
  droneOperator: "DRONE_OPERATOR",
};

const ASSIGNMENT_STATUS_DOT: Record<"PENDENTE" | "ACEITO" | "RECUSADO", string> = {
  PENDENTE: "bg-warning",
  ACEITO: "bg-success",
  RECUSADO: "bg-error",
};

const STATUS_TONE: Record<string, "neutral" | "info" | "success" | "warning" | "accent"> = {
  PLANEJADA: "neutral",
  CONFIRMADA: "info",
  REALIZADA: "success",
  EM_EDICAO: "warning",
  ENTREGUE: "accent",
};

function toFormValues(c: CaptureRow): CaptureFormValues {
  return {
    clientId: c.clientId,
    projectId: c.projectId,
    date: c.date,
    location: c.location,
    status: c.status,
    videomaker: c.videomaker,
    photographer: c.photographer,
    storymaker: c.storymaker,
    droneOperator: c.droneOperator,
    videoCount: c.videoCount,
    photoCount: c.photoCount,
    scriptNotes: c.scriptNotes,
    equipment: c.equipment,
    videomakerUserId: c.videomakerUserId,
    photographerUserId: c.photographerUserId,
    storymakerUserId: c.storymakerUserId,
    droneOperatorUserId: c.droneOperatorUserId,
  };
}

const DONE = ["REALIZADA", "EM_EDICAO", "ENTREGUE"];
const TZ = "America/Sao_Paulo";

function dayKey(iso: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date(iso));
}

function dayLabel(key: string) {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date());
  const tomorrow = new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date(Date.now() + 86400000));
  const yesterday = new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date(Date.now() - 86400000));
  if (key === today) return "Hoje";
  if (key === tomorrow) return "Amanhã";
  if (key === yesterday) return "Ontem";
  return new Date(`${key}T12:00:00-03:00`).toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", timeZone: TZ });
}

function initials(name: string) {
  return name.split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("");
}

function FeeEditor({ crew, onSaved }: { crew: CaptureRow["crew"]; onSaved: () => void }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  if (crew.length === 0) return null;
  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-border p-4">
      <p className="text-sm font-medium text-text-primary">Cachês desta captação</p>
      <p className="text-xs text-text-tertiary">Calculados quando a captação é marcada como realizada (sozinho ou em dupla). Ajuste se precisar.</p>
      {crew.map((m) => (
        <div key={m.id} className="flex items-center justify-between gap-3 py-1.5">
          <div className="min-w-0">
            <p className="truncate text-sm text-text-primary">{m.name}</p>
            <p className="text-xs text-text-tertiary">
              {CAPTURE_CREW_ROLE_LABELS[m.role as keyof typeof CAPTURE_CREW_ROLE_LABELS] ?? m.role}
              {m.status === "RECUSADO" ? " · recusou" : ""}
              {m.paid ? " · pago na folha" : m.feeManual ? " · valor ajustado" : ""}
            </p>
          </div>
          {m.paid ? (
            <span className="lb-figures text-sm text-text-secondary">{formatCurrency(m.fee ?? 0)}</span>
          ) : (
            <input
              type="number"
              min={0}
              step="1"
              defaultValue={m.fee ?? ""}
              placeholder="—"
              disabled={pending || m.status === "RECUSADO"}
              onBlur={(e) => {
                const raw = e.target.value.trim();
                const value = raw === "" ? null : Number(raw);
                if (value === m.fee) return;
                setError(null);
                start(async () => {
                  const res = await setCaptureFeeAction(m.id, value);
                  if (!res.ok) setError(res.error ?? "Não foi possível salvar.");
                  else onSaved();
                });
              }}
              className="lb-figures h-9 w-28 rounded-xl border border-border bg-card-elevated px-3 text-right text-sm text-text-primary focus:border-accent focus:outline-none"
            />
          )}
        </div>
      ))}
      {error && <p className="text-xs text-error">{error}</p>}
    </div>
  );
}

export function CapturesView({
  captures,
  clients,
  projects,
  crewAccounts,
  permissions,
}: {
  captures: CaptureRow[];
  clients: { id: string; companyName: string }[];
  projects: { id: string; name: string }[];
  crewAccounts: { userId: string; name: string; role: string }[];
  permissions: { canCreate: boolean; canEdit: boolean; canDelete: boolean; canSeeFees: boolean };
}) {
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [tab, setTab] = useState<"proximas" | "realizadas" | "todas">("proximas");
  const [pending, start] = useTransition();
  const editing = editingId ? captures.find((c) => c.id === editingId) : null;

  const [now] = useState(() => Date.now());
  const monthKey = new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date(now)).slice(0, 7);
  const todayKey = new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date(now));
  const weekEnd = new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date(now + 7 * 86400000));

  const stats = useMemo(() => {
    const upcoming = captures.filter((c) => !DONE.includes(c.status) && dayKey(c.date) >= todayKey);
    const week = upcoming.filter((c) => dayKey(c.date) <= weekEnd);
    const doneMonth = captures.filter((c) => DONE.includes(c.status) && dayKey(c.date).startsWith(monthKey));
    const fees = doneMonth.flatMap((c) => c.crew).reduce((s, m) => s + (m.status !== "RECUSADO" ? (m.fee ?? 0) : 0), 0);
    const pendingAccept = upcoming.flatMap((c) => c.crew).filter((m) => m.status === "PENDENTE").length;
    return { upcoming: upcoming.length, week: week.length, doneMonth: doneMonth.length, fees, pendingAccept };
  }, [captures, todayKey, weekEnd, monthKey]);

  const visible = useMemo(() => {
    const list =
      tab === "proximas"
        ? captures.filter((c) => !DONE.includes(c.status))
        : tab === "realizadas"
          ? captures.filter((c) => DONE.includes(c.status)).sort((a, b) => b.date.localeCompare(a.date))
          : [...captures].sort((a, b) => b.date.localeCompare(a.date));
    const groups = new Map<string, CaptureRow[]>();
    for (const c of list) {
      const k = dayKey(c.date);
      groups.set(k, [...(groups.get(k) ?? []), c]);
    }
    return [...groups.entries()];
  }, [captures, tab]);

  function quickStatus(id: string, status: string) {
    start(async () => {
      await setCaptureStatusAction(id, status);
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard tone="accent" label="Próximas" value={String(stats.upcoming)} caption={`${stats.week} nos próximos 7 dias`} icon={<Camera />} />
        <MetricCard label="Aguardando aceite" value={String(stats.pendingAccept)} caption="pessoas escaladas sem resposta" icon={<Clock />} />
        <MetricCard label="Realizadas no mês" value={String(stats.doneMonth)} caption="captações concluídas" icon={<CheckCircle2 />} />
        {permissions.canSeeFees ? (
          <MetricCard label="Cachês do mês" value={formatCurrency(stats.fees)} caption="entram na folha de cada pessoa" />
        ) : (
          <MetricCard label="Clientes atendidos" value={String(new Set(captures.filter((c) => dayKey(c.date).startsWith(monthKey)).map((c) => c.clientId)).size)} caption="neste mês" />
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1.5">
          {(
            [
              ["proximas", "Próximas"],
              ["realizadas", "Realizadas"],
              ["todas", "Todas"],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              type="button"
              onClick={() => setTab(k)}
              className={cn("rounded-full px-4 py-1.5 text-sm", tab === k ? "bg-ink text-ink-on" : "border border-border text-text-secondary hover:text-text-primary")}
            >
              {label}
            </button>
          ))}
        </div>
        {permissions.canCreate && (
          <Button onClick={() => setCreating(true)} disabled={clients.length === 0}>
            <Plus size={16} /> Nova captação
          </Button>
        )}
      </div>

      {clients.length === 0 && <p className="text-sm text-text-tertiary">Cadastre um cliente antes de agendar uma captação.</p>}

      {visible.length === 0 ? (
        <EmptyState
          icon={<Camera size={28} />}
          title={tab === "realizadas" ? "Nenhuma captação realizada ainda" : "Nenhuma captação agendada"}
          description={tab === "realizadas" ? undefined : "Agende a captação, escale a equipe e acompanhe até a entrega."}
          action={
            permissions.canCreate && tab !== "realizadas" && (
              <Button onClick={() => setCreating(true)}>
                <Plus size={16} /> Agendar captação
              </Button>
            )
          }
        />
      ) : (
        <div className="flex flex-col gap-6">
          {visible.map(([key, items]) => (
            <section key={key} className="flex flex-col gap-2.5">
              <p className={cn("text-xs font-medium uppercase tracking-[0.08em]", key === todayKey ? "text-accent-light" : "text-text-tertiary")}>{dayLabel(key)}</p>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                {items.map((c) => {
                  const done = DONE.includes(c.status);
                  const activeCrew = c.crew.filter((m) => m.status !== "RECUSADO");
                  const feeTotal = activeCrew.reduce((s, m) => s + (m.fee ?? 0), 0);
                  return (
                    <article
                      key={c.id}
                      className={cn("flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 transition-colors", permissions.canEdit && "cursor-pointer hover:border-text-tertiary/40")}
                      onClick={() => permissions.canEdit && setEditingId(c.id)}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="lb-figures text-lg font-semibold leading-tight text-text-primary">
                            {new Date(c.date).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: TZ })}
                          </p>
                          <p className="truncate text-sm font-medium text-text-primary">{c.clientName}</p>
                          {c.location && (
                            <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-text-tertiary">
                              <MapPin size={12} className="shrink-0" /> {c.location}
                            </p>
                          )}
                        </div>
                        <Badge tone={STATUS_TONE[c.status] ?? "neutral"}>{CAPTURE_STATUS_LABELS[c.status as keyof typeof CAPTURE_STATUS_LABELS] ?? c.status}</Badge>
                      </div>

                      <div className="flex flex-wrap gap-1.5">
                        {c.crew.length === 0 ? (
                          <span className="text-xs text-text-tertiary">Ninguém escalado ainda</span>
                        ) : (
                          c.crew.map((m) => (
                            <span
                              key={m.id}
                              className={cn("inline-flex items-center gap-1.5 rounded-full border border-border py-0.5 pl-0.5 pr-2.5 text-xs", m.status === "RECUSADO" ? "text-text-tertiary line-through" : "text-text-secondary")}
                              title={`${CAPTURE_CREW_ROLE_LABELS[m.role as keyof typeof CAPTURE_CREW_ROLE_LABELS] ?? m.role} · ${m.status === "ACEITO" ? "aceitou" : m.status === "RECUSADO" ? "recusou" : "aguardando resposta"}`}
                            >
                              <span className="relative flex h-6 w-6 items-center justify-center rounded-full bg-card-elevated text-[10px] font-semibold text-text-primary">
                                {initials(m.name)}
                                <span className={cn("absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full ring-2 ring-card", ASSIGNMENT_STATUS_DOT[m.status])} />
                              </span>
                              {m.name.split(" ")[0]}
                              {permissions.canSeeFees && m.fee !== null && m.status !== "RECUSADO" && <span className="lb-figures text-text-tertiary">· {formatCurrency(m.fee)}</span>}
                            </span>
                          ))
                        )}
                      </div>

                      {permissions.canEdit && (
                        <div className="mt-auto flex items-center justify-between gap-2 border-t border-border pt-3" onClick={(e) => e.stopPropagation()}>
                          {done ? (
                            <span className="text-xs text-text-tertiary">{permissions.canSeeFees && feeTotal > 0 ? `Cachês: ${formatCurrency(feeTotal)}` : "Concluída"}</span>
                          ) : (
                            <span className="text-xs text-text-tertiary">{activeCrew.length === 1 ? "1 pessoa" : `${activeCrew.length} pessoas`}</span>
                          )}
                          {!done ? (
                            <Button size="sm" variant="secondary" disabled={pending} onClick={() => quickStatus(c.id, "REALIZADA")}>
                              <CheckCircle2 size={14} /> Marcar como realizada
                            </Button>
                          ) : c.status === "REALIZADA" ? (
                            <Button size="sm" variant="ghost" disabled={pending} onClick={() => quickStatus(c.id, "EM_EDICAO")}>
                              Em edição
                            </Button>
                          ) : c.status === "EM_EDICAO" ? (
                            <Button size="sm" variant="ghost" disabled={pending} onClick={() => quickStatus(c.id, "ENTREGUE")}>
                              Marcar entregue
                            </Button>
                          ) : null}
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}

      <Drawer open={creating} onClose={() => setCreating(false)} title="Nova captação">
        <CaptureForm
          action={createCaptureAction}
          clients={clients}
          projects={projects}
          crewAccounts={crewAccounts}
          submitLabel="Agendar captação"
          onSuccess={() => setCreating(false)}
        />
      </Drawer>

      <Drawer open={!!editing} onClose={() => setEditingId(null)} title={editing ? `Captação · ${editing.clientName}` : ""}>
        {editing && (
          <div className="flex flex-col gap-5">
            {permissions.canSeeFees && <FeeEditor key={editing.id + editing.crew.map((m) => m.fee).join()} crew={editing.crew} onSaved={() => {}} />}
            <CaptureForm
              key={editing.id}
              action={updateCaptureAction.bind(null, editing.id)}
              defaultValues={toFormValues(editing)}
              clients={clients}
              projects={projects}
              crewAccounts={crewAccounts}
              submitLabel="Salvar alterações"
            />
            {permissions.canDelete && (
              <Button
                variant="danger"
                disabled={pending}
                onClick={() => {
                  if (!confirm("Excluir esta captação? Cachês ainda não pagos saem da folha junto.")) return;
                  start(async () => {
                    const res = await deleteCaptureAction(editing.id);
                    if (res.ok) setEditingId(null);
                    else alert(res.error);
                  });
                }}
              >
                <Trash2 size={15} /> Excluir captação
              </Button>
            )}
          </div>
        )}
      </Drawer>
    </div>
  );
}
