import { EmptyState } from "@/components/ui/empty-state";
import { History } from "lucide-react";

const ACTION_LABELS: Record<string, string> = {
  MEDIA_EVENT_CREATED: "Culto/evento criado",
  MEDIA_EVENT_UPDATED: "Culto/evento atualizado",
  MEDIA_EVENT_CANCELLED: "Culto/evento cancelado",
  MEDIA_EVENT_DEFAULT_REQUIREMENTS_UPDATED: "Template de culto atualizado",
  MEDIA_EVENT_RECURRENCE_CREATED: "Série recorrente criada",
  MEDIA_EVENT_RECURRENCE_PAUSED: "Série recorrente pausada",
  MEDIA_EVENT_RECURRENCE_REACTIVATED: "Série recorrente reativada",
  MEDIA_SCHEDULE_CREATED: "Escala criada",
  MEDIA_SCHEDULE_PUBLISHED: "Escala publicada",
  MEDIA_ASSIGNMENT_FILLED: "Vaga preenchida",
  MEDIA_ASSIGNMENT_MEMBER_REPLACED: "Membro substituído na escala",
  MEDIA_ASSIGNMENT_CLEARED: "Vaga reaberta",
  MEDIA_SWAP_REQUESTED: "Troca solicitada",
  MEDIA_SWAP_ACCEPTED_BY_TARGET: "Troca aceita pelo substituto",
  MEDIA_SWAP_REJECTED_BY_TARGET: "Troca recusada pelo substituto",
  MEDIA_SWAP_APPROVED: "Troca aprovada pela liderança",
  MEDIA_SWAP_REJECTED_BY_LEADER: "Troca recusada pela liderança",
  MEDIA_SWAP_CANCELLED: "Troca cancelada",
  MEDIA_ATTENDANCE_CONFIRMED: "Presença confirmada",
  MEDIA_CHECKIN: "Check-in registrado",
};

interface AuditEntry {
  id: string;
  action: string;
  createdAt: Date;
  userName: string | null;
  metadata: unknown;
}

export function AuditHistoryList({ entries }: { entries: AuditEntry[] }) {
  if (entries.length === 0) {
    return <EmptyState icon={<History size={28} />} title="Nenhum evento registrado ainda" />;
  }

  return (
    <div className="flex flex-col divide-y divide-border rounded-2xl border border-border">
      {entries.map((entry) => (
        <div key={entry.id} className="flex items-start justify-between gap-3 px-4 py-3 text-sm">
          <div>
            <p className="text-text-primary">{ACTION_LABELS[entry.action] ?? entry.action}</p>
            <p className="text-xs text-text-tertiary">{entry.userName ?? "Sistema"}</p>
          </div>
          <span className="whitespace-nowrap text-xs text-text-tertiary">{entry.createdAt.toLocaleString("pt-BR")}</span>
        </div>
      ))}
    </div>
  );
}
