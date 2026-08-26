import { XCircle } from "lucide-react";
import { db } from "@/lib/db";
import { mediaThemeStyle } from "@/lib/media/theme";
import { resolveOrganizationByPublicToken } from "@/lib/media/schedule/public-schedule-link-service";
import { PublicScheduleCalendar, type PublicCalendarEvent } from "@/components/media/public-schedule-calendar";

export const dynamic = "force-dynamic";

// Página pública (sem login) — o token é a única autorização, mesmo modelo
// de confiança do link de redefinir senha. Sempre lê direto do banco a cada
// acesso (nada de cache): assim que uma escala é publicada ou uma troca é
// aprovada, quem abrir (ou recarregar) o link já vê o resultado atual.
export default async function PublicScheduleCalendarPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const organization = await resolveOrganizationByPublicToken(token);

  if (!organization) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-background px-4">
        <div className="w-full max-w-[420px] rounded-2xl border border-border bg-card p-6 text-center">
          <XCircle size={32} className="mx-auto mb-3 text-error" />
          <p className="text-sm text-text-secondary">Este link não é válido ou foi desativado.</p>
        </div>
      </div>
    );
  }

  const brand = await db.mediaBrandSettings.findUnique({ where: { organizationId: organization.id } });

  const now = new Date();
  const rangeStart = new Date(now.getTime() - 45 * 24 * 60 * 60 * 1000);
  const rangeEnd = new Date(now.getTime() + 180 * 24 * 60 * 60 * 1000);

  const events = await db.mediaEvent.findMany({
    where: {
      organizationId: organization.id,
      status: { not: "ARCHIVED" },
      startAt: { gte: rangeStart, lte: rangeEnd },
    },
    include: {
      assignments: {
        where: { schedule: { status: "PUBLISHED" } },
        include: { function: true, member: { include: { user: { select: { name: true } } } } },
        orderBy: { function: { displayOrder: "asc" } },
      },
    },
    orderBy: { startAt: "asc" },
  });

  const calendarEvents: PublicCalendarEvent[] = events
    .filter((e) => e.assignments.length > 0)
    .map((e) => ({
      id: e.id,
      name: e.name,
      startAt: e.startAt.toISOString(),
      location: e.location,
      assignments: e.assignments.map((a) => ({
        functionName: a.function.name,
        memberName: a.member?.user.name ?? null,
      })),
    }));

  const brandName = brand?.environmentName ?? "MÍDIA ADESF";

  return (
    <div className="min-h-screen w-full bg-background" style={mediaThemeStyle(brand)}>
      <div className="w-full py-10 text-center text-[var(--lh-accent-on)]" style={{ background: "var(--lh-accent-gradient)" }}>
        {brand?.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={brand.logoUrl} alt={brandName} className="mx-auto mb-3 h-12 w-auto object-contain" />
        ) : (
          <div className="mx-auto mb-3 h-12 w-12 rounded-2xl bg-black/10" />
        )}
        <h1 className="text-xl font-semibold tracking-tight">Escala de cultos — {brandName}</h1>
        <p className="mx-auto mt-1 max-w-[420px] text-sm opacity-90">Quem está servindo em cada culto, sempre atualizado.</p>
      </div>

      <div className="mx-auto max-w-[720px] px-4 py-8">
        <PublicScheduleCalendar events={calendarEvents} />
      </div>
    </div>
  );
}
