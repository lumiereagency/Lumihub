// Brasil não observa horário de verão desde 2019, então um offset fixo é
// seguro e evita depender do fuso do processo Node (o servidor roda em
// UTC) — sem isso, um <input type="datetime-local"> sem fuso ("2026-08-25
// T12:00") era interpretado como UTC no servidor e exibido de volta já
// convertido pro fuso do navegador, saindo 3h adiantado ao salvar.
const BR_OFFSET = "-03:00";
const BR_OFFSET_MS = 3 * 60 * 60 * 1000;

// Usar em z.preprocess() antes de z.coerce.date() em campos vindos de um
// <input type="datetime-local">.
export function parseLocalDateTime(value: unknown): unknown {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) {
    return `${value}:00${BR_OFFSET}`;
  }
  return value;
}

// Popula o defaultValue de um <input type="datetime-local"> a partir de um
// ISO em UTC, convertendo pro horário de Brasília (o input não entende
// fuso — precisa receber os dígitos já no horário local certo).
export function toBrazilDateTimeInputValue(iso: string | null): string {
  if (!iso) return "";
  const brazilLocal = new Date(new Date(iso).getTime() - BR_OFFSET_MS);
  return brazilLocal.toISOString().slice(0, 16);
}

// Extrai a data (AAAA-MM-DD) no calendário de Brasília de um instante —
// para reconstruir corretamente "que dia era, em Brasília" a partir de um
// horário já salvo, mesmo que esse horário tenha sido salvo errado antes
// (ex: uma ocorrência gerada com o bug de fuso corrigido abaixo).
export function brazilDateKey(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

// Combina uma data (AAAA-MM-DD, já em termos de calendário — de
// recurrence.startDate/cursor, que são @db.Date puros, ou de brazilDateKey())
// com um horário "HH:mm" para produzir o instante UTC correto que
// representa esse horário em Brasília. Usar SEMPRE isto (nunca
// `date.setHours(h, m)`) para montar o horário de uma ocorrência — o
// servidor roda em UTC, então `setHours` monta o horário errado em UTC
// puro, sem o offset de -03:00, e todo culto "às 19h" acaba salvo e
// exibido às 16h. Foi exatamente o bug corrigido aqui: a criação de
// séries recorrentes nunca passava pelo mesmo `parseLocalDateTime` que já
// protege o formulário de culto avulso.
export function combineBrazilDateAndTime(dateKey: string, hhmm: string): Date {
  return new Date(`${dateKey}T${hhmm}:00${BR_OFFSET}`);
}
