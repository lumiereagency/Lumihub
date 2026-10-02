// Lê valores digitados do jeito brasileiro: "1.800", "1800,50", "1800.5", "R$ 2.290".
export function parseMoney(input: unknown): number | null {
  let raw = String(input ?? "").replace(/[^\d.,-]/g, "").trim();
  if (!raw) return null;
  if (raw.includes(",")) raw = raw.replace(/\./g, "").replace(",", ".");
  else if (/^\d{1,3}(\.\d{3})+$/.test(raw)) raw = raw.replace(/\./g, "");
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}
