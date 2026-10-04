import { isValidCpf } from "@/lib/documents";

// Pix "copia e cola" (BR Code estático do Banco Central) com valor fixo.
// Gerado aqui mesmo, sem banco intermediário e sem taxa: qualquer app de
// banco lê. Como é estático, a confirmação do pagamento continua sendo do
// time (comprovante) — baixa automática exige um banco/gateway com API.

function tlv(id: string, value: string): string {
  return `${id}${String(value.length).padStart(2, "0")}${value}`;
}

// CRC16-CCITT (polinômio 0x1021, início 0xFFFF), exigido no campo 63.
function crc16(payload: string): string {
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let b = 0; b < 8; b++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

// Nome e cidade do recebedor: sem acento, até 25 e 15 caracteres.
function plain(text: string, max: number): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9 .-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max)
    .trim();
}

// Chave no formato que o Pix espera: CPF/CNPJ só números, telefone com +55,
// e-mail em minúsculas, chave aleatória como está.
export function normalizePixKey(raw: string): string {
  const key = raw.trim();
  if (key.includes("@")) return key.toLowerCase();
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(key)) return key.toLowerCase();
  if (key.startsWith("+")) return `+${key.replace(/\D/g, "")}`;
  const digits = key.replace(/\D/g, "");
  if (digits.length === 14) return digits; // CNPJ
  if (digits.length === 11 && isValidCpf(digits)) return digits; // CPF
  if (digits.length === 10 || digits.length === 11) return `+55${digits}`; // celular/fixo com DDD
  if (digits.length === 13 && digits.startsWith("55")) return `+${digits}`;
  return key;
}

export function buildPixCode(input: { key: string; name: string; city: string; amount?: number; txid?: string; description?: string }): string {
  const account = tlv("00", "br.gov.bcb.pix") + tlv("01", normalizePixKey(input.key)) + (input.description ? tlv("02", plain(input.description, 40)) : "");
  const txid = (input.txid ?? "").replace(/[^A-Za-z0-9]/g, "").slice(-25) || "***";
  const payload =
    tlv("00", "01") +
    tlv("26", account) +
    tlv("52", "0000") +
    tlv("53", "986") +
    (input.amount && input.amount > 0 ? tlv("54", input.amount.toFixed(2)) : "") +
    tlv("58", "BR") +
    tlv("59", plain(input.name, 25) || "RECEBEDOR") +
    tlv("60", plain(input.city, 15) || "BRASIL") +
    tlv("62", tlv("05", txid)) +
    "6304";
  return payload + crc16(payload);
}

// "Goiânia/GO" ou "Av. X, 100 — Goiânia/GO" → "Goiânia".
export function cityFrom(text: string | null | undefined): string {
  if (!text) return "";
  const last = text.split(/[—,-]/).pop() ?? text;
  return last.split("/")[0].trim();
}
