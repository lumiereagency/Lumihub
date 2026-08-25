import { Badge } from "@/components/ui/badge";

const DAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

interface RecurringSlot {
  id: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
}

interface Exception {
  id: string;
  date: Date;
  startTime: string;
  endTime: string;
  available: boolean;
  reason: string | null;
}

// Visão somente leitura da disponibilidade de um membro — usada tanto pela
// tela administrativa quanto pela gestão de equipe do LÍDER dentro do
// portal (§33: "DISPONIBILIDADE — Recorrente / Exceções específicas").
export function MemberAvailabilityView({ recurring, exceptions }: { recurring: RecurringSlot[]; exceptions: Exception[] }) {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-text-tertiary">Recorrente</p>
        {recurring.length === 0 ? (
          <p className="text-sm text-text-tertiary">Este membro ainda não informou disponibilidade.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {recurring.map((s) => (
              <Badge key={s.id} tone="neutral">
                {DAY_LABELS[s.dayOfWeek]} {s.startTime}–{s.endTime}
              </Badge>
            ))}
          </div>
        )}
      </div>

      {exceptions.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-text-tertiary">Exceções específicas</p>
          <div className="flex flex-col gap-1">
            {exceptions.map((e) => (
              <div key={e.id} className="flex items-center gap-2 text-sm">
                <span className="text-text-primary">{e.date.toLocaleDateString("pt-BR", { timeZone: "UTC" })}</span>
                <span className="text-text-tertiary">
                  {e.startTime}–{e.endTime}
                  {e.reason ? ` · ${e.reason}` : ""}
                </span>
                <Badge tone={e.available ? "success" : "neutral"}>{e.available ? "Disponível" : "Indisponível"}</Badge>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
