import { CheckCircle2, Clock, XCircle } from "lucide-react";
import { db } from "@/lib/db";
import { formatDateTime } from "@/lib/format";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CAPTURE_CREW_ROLE_LABELS, type CaptureCrewRole } from "@/lib/validation/capture-assignments";
import { acceptCaptureAssignmentAction, declineCaptureAssignmentAction } from "@/lib/actions/capture-assignment-actions";

// Aceite de escala (Fase 46) — aparece na tela inicial de quem tem
// captações pendentes de resposta, sem depender de app nativo/push.
export async function PendingCaptureAssignments({ userId }: { userId: string }) {
  const pending = await db.captureAssignment.findMany({
    where: { userId, status: "PENDENTE" },
    include: { capture: { include: { client: { select: { companyName: true } } } } },
    orderBy: { capture: { date: "asc" } },
  });

  if (pending.length === 0) return null;

  return (
    <Card className="border-accent/25 bg-card-elevated">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Clock size={16} className="text-accent" />
          <CardTitle>Captações aguardando seu aceite</CardTitle>
        </div>
      </CardHeader>
      <div className="flex flex-col gap-3">
        {pending.map((a) => (
          <div
            key={a.id}
            className="flex flex-col gap-3 rounded-[10px] border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <div>
              <p className="text-sm font-medium text-text-primary">
                {CAPTURE_CREW_ROLE_LABELS[a.role as CaptureCrewRole]} — {a.capture.client.companyName}
              </p>
              <p className="text-xs text-text-tertiary">
                {formatDateTime(a.capture.date)}
                {a.capture.location ? ` · ${a.capture.location}` : ""}
              </p>
            </div>
            <div className="flex gap-2">
              <form action={declineCaptureAssignmentAction.bind(null, a.id)}>
                <Button type="submit" variant="outline" size="sm">
                  <XCircle size={14} /> Recusar
                </Button>
              </form>
              <form action={acceptCaptureAssignmentAction.bind(null, a.id)}>
                <Button type="submit" variant="primary" size="sm">
                  <CheckCircle2 size={14} /> Aceitar
                </Button>
              </form>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
