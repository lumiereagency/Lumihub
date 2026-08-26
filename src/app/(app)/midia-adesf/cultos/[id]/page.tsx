import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/auth/guard";
import { permKey } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MEDIA_EVENT_STATUS_LABELS, MEDIA_EVENT_STATUS_TONE } from "@/lib/media/labels";
import { AuditHistoryList } from "@/components/media/audit-history-list";
import { cancelEventAction, saveEventRequirementsAsDefaultAction, updateEventAction } from "@/lib/actions/media-event-actions";
import { EventForm } from "../event-form";
import { RequestAvailabilityButton } from "./request-availability-button";

export default async function MediaAdesfEventDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermission(permKey("MEDIA_ADESF", "VIEW"));
  const { id } = await params;

  const event = await db.mediaEvent.findFirst({
    where: { id, organizationId: user.organizationId },
    include: { requirements: true },
  });
  if (!event) notFound();

  const [allFunctions, auditEntries] = await Promise.all([
    db.mediaFunction.findMany({ where: { organizationId: user.organizationId, active: true }, orderBy: { displayOrder: "asc" } }),
    db.auditLog.findMany({
      where: { organizationId: user.organizationId, entityType: { in: ["MediaEvent", "MediaScheduleAssignment"] }, entityId: id },
      include: { user: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title={event.name}
        description={event.type}
        actions={
          <div className="flex items-center gap-2">
            <Badge tone={MEDIA_EVENT_STATUS_TONE[event.status]}>{MEDIA_EVENT_STATUS_LABELS[event.status]}</Badge>
            {event.status !== "CANCELLED" && <RequestAvailabilityButton eventId={event.id} />}
            {event.status !== "CANCELLED" && (
              <form action={cancelEventAction.bind(null, event.id)}>
                <Button type="submit" variant="danger" size="sm">
                  Cancelar evento
                </Button>
              </form>
            )}
          </div>
        }
      />

      <section>
        <h2 className="mb-3 text-lg font-semibold text-text-primary">Editar</h2>
        <EventForm
          action={updateEventAction.bind(null, event.id)}
          defaultValues={{
            name: event.name,
            type: event.type,
            startAt: event.startAt.toISOString(),
            endAt: event.endAt?.toISOString() ?? null,
            location: event.location,
            description: event.description,
            administrativeNotes: event.administrativeNotes,
            requirements: event.requirements.map((r) => ({ functionId: r.functionId, requiredQuantity: r.requiredQuantity, mandatory: r.mandatory })),
          }}
          allFunctions={allFunctions.map((f) => ({ id: f.id, name: f.name }))}
          submitLabel="Salvar alterações"
        />
        <form action={saveEventRequirementsAsDefaultAction.bind(null, event.id)} className="mt-2">
          <button type="submit" className="text-xs text-accent-light hover:underline">
            Salvar estas funções como padrão para novos cultos
          </button>
        </form>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-text-primary">Histórico</h2>
        <AuditHistoryList
          entries={auditEntries.map((e) => ({ id: e.id, action: e.action, createdAt: e.createdAt, userName: e.user?.name ?? null, metadata: e.metadata }))}
        />
      </section>
    </div>
  );
}
