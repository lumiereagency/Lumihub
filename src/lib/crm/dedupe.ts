const LEGAL_SUFFIXES = new Set(["ltda", "me", "epp", "eireli", "sa", "mei", "ss"]);

// "Studio Aurora LTDA.", "studio  aurora" e "Stúdio Aurora" viram a mesma chave.
export function normalizeLeadName(value: string | null | undefined): string | null {
  if (!value) return null;
  const words = value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);
  while (words.length > 1 && LEGAL_SUFFIXES.has(words[words.length - 1])) words.pop();
  const key = words.join(" ");
  return key || null;
}

// Aceita "@perfil", "perfil", "instagram.com/perfil" ou o link completo.
export function normalizeInstagram(value: string | null | undefined): string | null {
  if (!value) return null;
  let raw = value.trim().toLowerCase();
  const fromUrl = raw.match(/instagram\.com\/([^/?#\s]+)/);
  if (fromUrl) raw = fromUrl[1];
  raw = raw.replace(/^@+/, "").replace(/[/?#].*$/, "");
  if (["p", "reel", "reels", "stories", "explore"].includes(raw)) return null;
  const handle = raw.replace(/[^a-z0-9._]/g, "");
  return handle.length >= 2 ? handle : null;
}

export interface DedupeCandidate {
  id: string;
  company: string;
  instagram: string | null;
}

export function findDuplicateIn<T extends DedupeCandidate>(
  pool: T[],
  input: { company: string; instagram?: string | null },
  excludeId?: string,
): { match: T; reason: "nome" | "instagram" } | null {
  const name = normalizeLeadName(input.company);
  const insta = normalizeInstagram(input.instagram);
  for (const lead of pool) {
    if (lead.id === excludeId) continue;
    if (insta && normalizeInstagram(lead.instagram) === insta) return { match: lead, reason: "instagram" };
    if (name && normalizeLeadName(lead.company) === name) return { match: lead, reason: "nome" };
  }
  return null;
}
