import "server-only";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/format";
import { findDuplicateIn } from "@/lib/crm/dedupe";

export async function loadDedupePool(organizationId: string) {
  return db.lead.findMany({
    where: { organizationId, deletedAt: null },
    select: {
      id: true,
      company: true,
      instagram: true,
      createdAt: true,
      createdBy: { select: { name: true } },
      owner: { select: { name: true } },
    },
  });
}

export type DedupePool = Awaited<ReturnType<typeof loadDedupePool>>;

export function describeDuplicate(dup: NonNullable<ReturnType<typeof findDuplicateIn<DedupePool[number]>>>): string {
  const lead = dup.match;
  const who = lead.owner?.name ?? lead.createdBy?.name;
  const by = lead.createdBy ? ` por ${lead.createdBy.name}` : "";
  const reason = dup.reason === "instagram" ? "mesmo Instagram" : "mesmo nome";
  return `Esse negócio já está no CRM (${reason}): "${lead.company}", cadastrado${by} em ${formatDate(lead.createdAt)}${who ? ` — responsável: ${who}` : ""}.`;
}

export async function findLeadDuplicate(
  organizationId: string,
  input: { company: string; instagram?: string | null },
  excludeId?: string,
): Promise<string | null> {
  const pool = await loadDedupePool(organizationId);
  const dup = findDuplicateIn(pool, input, excludeId);
  return dup ? describeDuplicate(dup) : null;
}
