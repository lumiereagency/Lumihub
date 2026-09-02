import "server-only";
import { db } from "@/lib/db";
import { getValidOAuthAccessToken } from "@/lib/integrations/oauth-tokens";

// Lembrete no Google Calendar de quem confirmou captação/escala (§ pedido
// do usuário: "a cada captação confirmada quanto escala confirmada, você
// criasse um lembrete no calendário dessas pessoas... um dia antes"). Usa a
// ÚNICA conta Google Calendar já conectada pela organização em Configurações
// → Integrações — não pede OAuth de cada membro individualmente. O convite
// vai por e-mail via a própria API do Google (attendees + sendUpdates=all),
// que é como qualquer convite de calendário chega na conta de quem recebe,
// Google ou não; o "lembrete de 1 dia antes" é a notificação nativa do
// evento (reminders.overrides), não um evento separado no dia anterior.
const REMINDER_MINUTES_BEFORE = 24 * 60;

interface CreateEventInput {
  organizationId: string;
  title: string;
  description?: string;
  location?: string | null;
  startAt: Date;
  endAt: Date;
  attendeeEmail: string;
  attendeeName: string;
}

interface CreateEventResult {
  delivered: boolean;
  pending: boolean;
  eventId?: string;
  error?: string;
}

async function getGoogleCalendarIntegration(organizationId: string) {
  return db.integration.findUnique({
    where: { organizationId_provider: { organizationId, provider: "GOOGLE_CALENDAR" } },
  });
}

export async function createGoogleCalendarReminder(input: CreateEventInput): Promise<CreateEventResult> {
  const integration = await getGoogleCalendarIntegration(input.organizationId);
  if (!integration || integration.status !== "CONECTADO") {
    return { delivered: false, pending: true };
  }

  try {
    const accessToken = await getValidOAuthAccessToken(integration.id);
    const res = await fetch("https://www.googleapis.com/calendar/v3/calendars/primary/events?sendUpdates=all", {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        summary: input.title,
        description: input.description,
        location: input.location ?? undefined,
        start: { dateTime: input.startAt.toISOString() },
        end: { dateTime: input.endAt.toISOString() },
        attendees: [{ email: input.attendeeEmail, displayName: input.attendeeName }],
        reminders: { useDefault: false, overrides: [{ method: "popup", minutes: REMINDER_MINUTES_BEFORE }] },
      }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      return { delivered: false, pending: false, error: body?.error?.message ?? `Google recusou (HTTP ${res.status}).` };
    }
    const data = (await res.json()) as { id: string };
    return { delivered: true, pending: false, eventId: data.id };
  } catch (err) {
    console.error("[LUMIBASE][google-calendar:erro] Falha ao criar evento.", err);
    return { delivered: false, pending: false, error: (err as Error).message };
  }
}

// Best-effort: se a atribuição for recusada/cancelada depois de já ter
// criado o lembrete, remove do calendário da pessoa. Nunca lança — perder
// esse cleanup não pode travar o fluxo principal de recusa/cancelamento.
export async function cancelGoogleCalendarReminder(organizationId: string, eventId: string): Promise<void> {
  const integration = await getGoogleCalendarIntegration(organizationId);
  if (!integration || integration.status !== "CONECTADO") return;

  try {
    const accessToken = await getValidOAuthAccessToken(integration.id);
    await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}?sendUpdates=all`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  } catch (err) {
    console.error("[LUMIBASE][google-calendar:erro] Falha ao cancelar evento.", err);
  }
}
