"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth/guard";
import { permKey } from "@/lib/auth/permissions";
import { audit } from "@/lib/audit";
import { LEAD_STAGES, LEAD_STAGE_LABELS } from "@/lib/validation/crm";
import { findDuplicateIn, normalizeInstagram, normalizeLeadName } from "@/lib/crm/dedupe";
import { describeDuplicate, loadDedupePool } from "@/lib/crm/duplicates";

export interface ImportRow {
  company?: string;
  contactName?: string;
  phone?: string;
  whatsapp?: string;
  instagram?: string;
  website?: string;
  city?: string;
  segment?: string;
  source?: string;
  temperature?: string;
  stage?: string;
  potentialValue?: string;
  nextContactAt?: string;
  notes?: string;
}

export type ImportRowStatus =
  | { status: "novo" }
  | { status: "duplicado"; message: string }
  | { status: "repetido"; message: string }
  | { status: "invalido"; message: string };

const MAX_ROWS = 1000;

function clean(value: unknown, max = 300): string | null {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text ? text.slice(0, max) : null;
}

function plain(value: string): string {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

function parseTemperature(value: string | null) {
  if (!value) return null;
  const v = plain(value);
  if (/(quente|hot|alta)/.test(v)) return "QUENTE" as const;
  if (/(morno|warm|media)/.test(v)) return "MORNO" as const;
  if (/(frio|cold|baixa)/.test(v)) return "FRIO" as const;
  return null;
}

function parseStage(value: string | null) {
  if (!value) return "LEAD" as const;
  const v = plain(value);
  if (/(ganho|fechad|cliente)/.test(v)) return "FECHADO" as const;
  return LEAD_STAGES.find((s) => plain(LEAD_STAGE_LABELS[s]) === v || plain(s) === v) ?? "LEAD";
}

function parseMoney(value: string | null): number | null {
  if (!value) return null;
  let v = value.replace(/[^\d,.-]/g, "");
  if (v.includes(",")) v = v.replace(/\./g, "").replace(",", ".");
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : null;
}

function parseDate(value: string | null): Date | null {
  if (!value) return null;
  const br = value.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/);
  if (br) {
    const year = br[3].length === 2 ? 2000 + Number(br[3]) : Number(br[3]);
    const date = new Date(Date.UTC(year, Number(br[2]) - 1, Number(br[1]), 12));
    return Number.isNaN(date.getTime()) ? null : date;
  }
  const iso = new Date(value);
  if (Number.isNaN(iso.getTime())) return null;
  iso.setUTCHours(12, 0, 0, 0);
  return iso;
}

async function classify(organizationId: string, rows: ImportRow[]) {
  const pool = await loadDedupePool(organizationId);
  const seenNames = new Map<string, number>();
  const seenInsta = new Map<string, number>();

  return rows.map((row, index): ImportRowStatus => {
    const company = clean(row.company, 200);
    if (!company) return { status: "invalido", message: "Sem nome da empresa/lead." };
    const dup = findDuplicateIn(pool, { company, instagram: row.instagram ?? null });
    if (dup) return { status: "duplicado", message: describeDuplicate(dup) };

    const name = normalizeLeadName(company);
    const insta = normalizeInstagram(row.instagram ?? null);
    const repeatedAt = (insta && seenInsta.get(insta)) ?? (name && seenNames.get(name));
    if (repeatedAt) return { status: "repetido", message: `Repetido na planilha (igual à linha ${repeatedAt}).` };
    if (name) seenNames.set(name, index + 2);
    if (insta) seenInsta.set(insta, index + 2);
    return { status: "novo" };
  });
}

export async function previewLeadImportAction(rows: ImportRow[]): Promise<{ statuses: ImportRowStatus[] } | { error: string }> {
  const user = await requirePermission(permKey("CRM", "CREATE"));
  if (!Array.isArray(rows) || rows.length === 0) return { error: "A planilha está vazia." };
  if (rows.length > MAX_ROWS) return { error: `Importe no máximo ${MAX_ROWS} linhas por vez.` };
  return { statuses: await classify(user.organizationId, rows) };
}

export async function importLeadsAction(
  rows: ImportRow[],
  defaultSource: string,
): Promise<{ created: number; skipped: number } | { error: string }> {
  const user = await requirePermission(permKey("CRM", "CREATE"));
  if (!Array.isArray(rows) || rows.length === 0) return { error: "A planilha está vazia." };
  if (rows.length > MAX_ROWS) return { error: `Importe no máximo ${MAX_ROWS} linhas por vez.` };

  const statuses = await classify(user.organizationId, rows);
  const source = clean(defaultSource, 80) ?? "Planilha";
  const toCreate = rows.filter((_, i) => statuses[i].status === "novo");

  const created = await db.$transaction(
    async (tx) => {
      const ids: { id: string; company: string }[] = [];
      for (const row of toCreate) {
        const lead = await tx.lead.create({
          data: {
            organizationId: user.organizationId,
            company: clean(row.company, 200)!,
            contactName: clean(row.contactName, 120),
            phone: clean(row.phone, 40),
            whatsapp: clean(row.whatsapp, 40),
            instagram: clean(row.instagram, 200),
            website: clean(row.website, 300),
            city: clean(row.city, 120),
            segment: clean(row.segment, 120),
            source: clean(row.source, 80) ?? source,
            temperature: parseTemperature(clean(row.temperature)),
            stage: parseStage(clean(row.stage)),
            potentialValue: parseMoney(clean(row.potentialValue)),
            nextContactAt: parseDate(clean(row.nextContactAt)),
            notes: clean(row.notes, 4000),
            ownerUserId: user.id,
            createdByUserId: user.id,
          },
          select: { id: true, company: true },
        });
        ids.push(lead);
      }
      return ids;
    },
    { timeout: 120_000 },
  );

  for (const lead of created) {
    await audit({
      organizationId: user.organizationId,
      userId: user.id,
      action: "LEAD_CREATED",
      entityType: "Lead",
      entityId: lead.id,
      metadata: { company: lead.company, source: "import" },
    });
  }

  revalidatePath("/crm");
  return { created: created.length, skipped: rows.length - created.length };
}
