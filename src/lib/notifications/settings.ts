// Preferências de notificação por pessoa. Nulo no banco = padrão: tudo ligado
// e silêncio das 22h às 7h (horário de Brasília). Arquivo sem dependência de
// servidor para poder ser usado também na tela de perfil.

export const NOTIFICATION_CATEGORIES = [
  { key: "tarefas", label: "Tarefas", description: "Quando te colocam numa tarefa ou comentam nela, e as que vencem no dia." },
  { key: "comercial", label: "Comercial", description: "Orçamento aberto, aceito ou recusado, contrato assinado, comissões e follow-ups do dia." },
  { key: "financeiro", label: "Financeiro", description: "Contas a pagar e cobranças que vencem no dia ou atrasaram, no resumo da manhã." },
  { key: "alertas", label: "Alertas urgentes", description: "Novos alertas urgentes da Central de Alertas." },
  { key: "operacao", label: "Captações e agenda", description: "Captações para aceitar, captação em 1 hora e compromissos em 30 minutos." },
  { key: "midia", label: "Mídia ADESF", description: "Escalas, trocas e confirmações da equipe de mídia." },
  { key: "resumo", label: "Resumo da manhã", description: "Às 8h, o que vence no dia numa notificação só (segue as escolhas acima)." },
] as const;

export type NotificationCategory = (typeof NOTIFICATION_CATEGORIES)[number]["key"];

export interface NotificationSettings {
  disabled: NotificationCategory[];
  quiet: boolean;
  quietStart: number;
  quietEnd: number;
}

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = { disabled: [], quiet: true, quietStart: 22, quietEnd: 7 };

const KEYS = new Set<string>(NOTIFICATION_CATEGORIES.map((c) => c.key));

export function parseNotificationSettings(raw: unknown): NotificationSettings {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_NOTIFICATION_SETTINGS };
  const r = raw as Record<string, unknown>;
  const hour = (v: unknown, d: number) => (typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= 23 ? v : d);
  return {
    disabled: Array.isArray(r.disabled) ? (r.disabled.filter((k) => typeof k === "string" && KEYS.has(k)) as NotificationCategory[]) : [],
    quiet: typeof r.quiet === "boolean" ? r.quiet : DEFAULT_NOTIFICATION_SETTINGS.quiet,
    quietStart: hour(r.quietStart, DEFAULT_NOTIFICATION_SETTINGS.quietStart),
    quietEnd: hour(r.quietEnd, DEFAULT_NOTIFICATION_SETTINGS.quietEnd),
  };
}

// Hora atual em Brasília (0–23).
export function brasiliaHour(date = new Date()): number {
  return Number(new Intl.DateTimeFormat("en-US", { hour: "numeric", hourCycle: "h23", timeZone: "America/Sao_Paulo" }).format(date));
}

export function isQuietNow(s: NotificationSettings, date = new Date()): boolean {
  if (!s.quiet || s.quietStart === s.quietEnd) return false;
  const h = brasiliaHour(date);
  return s.quietStart > s.quietEnd ? h >= s.quietStart || h < s.quietEnd : h >= s.quietStart && h < s.quietEnd;
}
