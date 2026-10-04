// Datas de vencimento são "dia do calendário", não instante. Registros
// antigos foram salvos como meia-noite UTC (o que em Brasília vira 21h do
// dia anterior); os novos ficam ao meio-dia de Brasília. Estas funções leem
// os dois jeitos sem deslocar o dia.

export function brasiliaDay(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(date);
}

export function dueDay(date: Date): string {
  const utcMidnight = date.getUTCHours() === 0 && date.getUTCMinutes() === 0 && date.getUTCSeconds() === 0;
  return utcMidnight ? date.toISOString().slice(0, 10) : brasiliaDay(date);
}

export function addDays(day: string, n: number): string {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

// Meio-dia em Brasília do dia informado (instante sem ambiguidade de fuso).
export function noonOf(day: string): Date {
  return new Date(`${day}T12:00:00-03:00`);
}

export function formatDueDate(date: Date): string {
  const [y, m, d] = dueDay(date).split("-");
  return `${d}/${m}/${y}`;
}

// "2026-10-10" vindo de <input type="date"> → meio-dia de Brasília.
export function parseDateInput(value: unknown): unknown {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T12:00:00-03:00` : value;
}
