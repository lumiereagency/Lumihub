"use client";

import { useEffect, useState, useTransition } from "react";
import { History, PhoneCall } from "lucide-react";
import { cn } from "@/lib/cn";
import { CONTACT_OUTCOMES, CONTACT_OUTCOME_LABELS, LEAD_STAGE_LABELS, type ContactOutcome } from "@/lib/validation/crm";
import { getLeadHistoryAction, logLeadContactAction, type LeadHistoryItem } from "@/lib/actions/crm-actions";
import { formatDate } from "@/lib/format";

const NEXT_OPTIONS: { label: string; days: number | null }[] = [
  { label: "Amanhã", days: 1 },
  { label: "Em 3 dias", days: 3 },
  { label: "Em 1 semana", days: 7 },
  { label: "Em 15 dias", days: 15 },
  { label: "Sem data", days: null },
];

const DEFAULT_NEXT: Record<ContactOutcome, number | null> = {
  SEM_RESPOSTA: 1,
  CONVERSOU: 3,
  REUNIAO: 7,
  PROPOSTA: 3,
  SEM_INTERESSE: null,
};

const OUTCOME_TONE: Record<ContactOutcome, string> = {
  SEM_RESPOSTA: "peer-checked:bg-text-secondary peer-checked:text-card",
  CONVERSOU: "peer-checked:bg-info peer-checked:text-white",
  REUNIAO: "peer-checked:bg-accent peer-checked:text-white",
  PROPOSTA: "peer-checked:bg-success peer-checked:text-white",
  SEM_INTERESSE: "peer-checked:bg-error peer-checked:text-white",
};

function stageLabel(value: unknown): string {
  return typeof value === "string" ? (LEAD_STAGE_LABELS[value as keyof typeof LEAD_STAGE_LABELS] ?? value) : "";
}

function describe(item: LeadHistoryItem): string {
  const m = item.metadata;
  switch (item.action) {
    case "LEAD_CREATED":
      return m.source === "import" ? "importou de planilha" : "cadastrou o lead";
    case "LEAD_CONTACTED":
      return `registrou contato: ${CONTACT_OUTCOME_LABELS[m.outcome as ContactOutcome] ?? "contato"}`;
    case "LEAD_STAGE_CHANGED":
      return `moveu de ${stageLabel(m.from)} para ${stageLabel(m.to)}`;
    case "LEAD_UPDATED":
      return "atualizou os dados";
    case "LEAD_CONVERTED_TO_CLIENT":
      return "converteu em cliente";
    default:
      return "alterou o lead";
  }
}

export function LeadContactPanel({
  leadId,
  canEdit,
  autoFocus,
  onLogged,
}: {
  leadId: string;
  canEdit: boolean;
  autoFocus: boolean;
  onLogged: (message: string) => void;
}) {
  const [outcome, setOutcome] = useState<ContactOutcome | null>(null);
  const [nextDays, setNextDays] = useState<number | null>(1);
  const [note, setNote] = useState("");
  const [history, setHistory] = useState<LeadHistoryItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    getLeadHistoryAction(leadId).then(setHistory);
  }, [leadId]);

  function save() {
    if (!outcome) return setError("Escolha como foi o contato.");
    startTransition(async () => {
      const result = await logLeadContactAction(leadId, outcome, outcome === "SEM_INTERESSE" ? null : nextDays, note);
      if (!result.ok) return setError(result.error);
      setOutcome(null);
      setNote("");
      setError(null);
      getLeadHistoryAction(leadId).then(setHistory);
      onLogged(outcome === "SEM_INTERESSE" ? "Lead marcado como perdido." : "Contato registrado.");
    });
  }

  return (
    <div className="flex flex-col gap-5">
      {canEdit && (
        <section className={cn("flex flex-col gap-3 rounded-3xl border p-4", autoFocus ? "border-accent/50 bg-accent/5" : "border-border")}>
          <h3 className="flex items-center gap-2 text-sm font-semibold text-text-primary">
            <PhoneCall size={16} className="text-text-tertiary" /> Registrar contato
          </h3>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Como foi o contato">
            {CONTACT_OUTCOMES.map((o) => (
              <label key={o} className="cursor-pointer">
                <input
                  type="radio"
                  name={`outcome-${leadId}`}
                  checked={outcome === o}
                  onChange={() => {
                    setOutcome(o);
                    setNextDays(DEFAULT_NEXT[o]);
                    setError(null);
                  }}
                  className="peer sr-only"
                />
                <span
                  className={cn(
                    "inline-flex h-9 items-center rounded-full border border-border px-3.5 text-sm font-medium text-text-secondary transition-colors peer-checked:border-transparent peer-focus-visible:ring-4 peer-focus-visible:ring-accent/15",
                    OUTCOME_TONE[o],
                  )}
                >
                  {CONTACT_OUTCOME_LABELS[o]}
                </span>
              </label>
            ))}
          </div>
          {outcome && outcome !== "SEM_INTERESSE" && (
            <div className="flex flex-col gap-2">
              <p className="text-xs font-medium text-text-tertiary">Próximo contato</p>
              <div className="flex flex-wrap gap-1.5">
                {NEXT_OPTIONS.map((opt) => (
                  <button
                    key={opt.label}
                    type="button"
                    aria-pressed={nextDays === opt.days}
                    onClick={() => setNextDays(opt.days)}
                    className={cn(
                      "h-8 rounded-full px-3 text-xs font-medium",
                      nextDays === opt.days ? "bg-ink text-ink-on" : "bg-card-elevated text-text-secondary hover:text-text-primary",
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          )}
          {outcome && (
            <textarea
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Anotação rápida (opcional): o que conversaram, objeções, próximos passos…"
              className="w-full resize-none rounded-2xl border border-border bg-card px-3.5 py-2.5 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-4 focus:ring-accent/15"
              aria-label="Anotação do contato"
            />
          )}
          {error && <p className="text-sm text-error">{error}</p>}
          <button
            type="button"
            disabled={pending || !outcome}
            onClick={save}
            className="h-10 rounded-full bg-ink text-sm font-medium text-ink-on hover:opacity-90 disabled:opacity-40"
          >
            {pending ? "Salvando…" : "Salvar contato"}
          </button>
        </section>
      )}

      <section className="flex flex-col gap-3">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-text-primary">
          <History size={16} className="text-text-tertiary" /> Histórico
        </h3>
        {!history ? (
          <p className="text-sm text-text-tertiary">Carregando…</p>
        ) : history.length === 0 ? (
          <p className="text-sm text-text-tertiary">Nenhum registro ainda.</p>
        ) : (
          <ol className="relative flex flex-col gap-4 border-l border-border pl-5">
            {history.map((item) => (
              <li key={item.id} className="relative">
                <span
                  className={cn(
                    "absolute -left-[25px] top-1.5 h-2.5 w-2.5 rounded-full ring-4 ring-card",
                    item.action === "LEAD_CONTACTED" ? "bg-accent" : "bg-text-tertiary",
                  )}
                />
                <p className="text-sm text-text-secondary">
                  <span className="font-medium text-text-primary">{item.userName}</span> {describe(item)}
                </p>
                {typeof item.metadata.note === "string" && (
                  <p className="mt-1 whitespace-pre-wrap rounded-2xl bg-card-elevated px-3 py-2 text-sm text-text-secondary">{item.metadata.note}</p>
                )}
                <p className="mt-0.5 text-xs text-text-tertiary" suppressHydrationWarning>
                  {new Date(item.createdAt).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" })}
                  {typeof item.metadata.nextContactAt === "string" && ` · próximo contato ${formatDate(new Date(item.metadata.nextContactAt))}`}
                  {item.action === "LEAD_CONTACTED" && typeof item.metadata.to === "string" && ` · foi para ${stageLabel(item.metadata.to)}`}
                </p>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
