// Dias úteis no Brasil: segunda a sexta, menos feriados nacionais (inclui
// Carnaval e Corpus Christi, quando os bancos não abrem). Datas tratadas
// como "dia do calendário" (YYYY-MM-DD), sem fuso.

export type PayDayMode = "FIXED" | "BUSINESS_DAY" | "LAST_BUSINESS_DAY";

export const PAY_DAY_MODE_LABELS: Record<PayDayMode, string> = {
  FIXED: "Dia fixo do mês",
  BUSINESS_DAY: "Dia útil do mês (ex: 5º dia útil)",
  LAST_BUSINESS_DAY: "Último dia útil do mês",
};

function iso(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

// Domingo de Páscoa (algoritmo de Meeus/Jones/Butcher).
function easter(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(year, month - 1, day));
}

const cache = new Map<number, Set<string>>();

export function nationalHolidays(year: number): Set<string> {
  const hit = cache.get(year);
  if (hit) return hit;
  const fixed = ["01-01", "04-21", "05-01", "09-07", "10-12", "11-02", "11-15", "11-20", "12-25"].map((md) => `${year}-${md}`);
  const e = easter(year);
  const shift = (days: number) => {
    const d = new Date(e);
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
  };
  const set = new Set([...fixed, shift(-48), shift(-47), shift(-2), shift(60)]); // Carnaval (seg/ter), Sexta-feira Santa, Corpus Christi
  cache.set(year, set);
  return set;
}

export function isBusinessDay(day: string): boolean {
  const d = new Date(`${day}T12:00:00Z`);
  const wd = d.getUTCDay();
  return wd !== 0 && wd !== 6 && !nationalHolidays(d.getUTCFullYear()).has(day);
}

function daysInMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

// Dia de pagamento de um mês (m = 1–12) conforme a regra da pessoa.
export function payDayOf(year: number, month: number, mode: PayDayMode, n: number | null | undefined): string {
  const last = daysInMonth(year, month);
  if (mode === "LAST_BUSINESS_DAY") {
    for (let d = last; d >= 1; d--) if (isBusinessDay(iso(year, month, d))) return iso(year, month, d);
  }
  if (mode === "BUSINESS_DAY") {
    const target = Math.max(1, Math.min(n ?? 5, 23));
    let count = 0;
    for (let d = 1; d <= last; d++) {
      if (isBusinessDay(iso(year, month, d)) && ++count === target) return iso(year, month, d);
    }
  }
  return iso(year, month, Math.min(Math.max(n ?? 5, 1), last));
}

export function describePayRule(mode: PayDayMode, n: number | null | undefined): string {
  if (mode === "LAST_BUSINESS_DAY") return "último dia útil";
  if (mode === "BUSINESS_DAY") return `${n ?? 5}º dia útil`;
  return n ? `todo dia ${n}` : "sem dia definido";
}

export function parsePayDayMode(v: unknown): PayDayMode {
  return v === "BUSINESS_DAY" || v === "LAST_BUSINESS_DAY" ? v : "FIXED";
}
