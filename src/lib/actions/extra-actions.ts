"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser, isDirector, hasPermission } from "@/lib/auth/guard";
import { permKey } from "@/lib/auth/permissions";
import { audit } from "@/lib/audit";
import { formatCurrency } from "@/lib/format";
import { noonOf } from "@/lib/billing/dates";
import { competenceLabel, competenceOf, syncPayroll } from "@/lib/payroll/folha";
import { EXTRA_KINDS, extraKindLabel } from "@/lib/payroll/extra-kinds";
import { notifyUsers } from "@/lib/notifications/notify";

// Extras: bonificar alguém por um serviço além do fixo. Quem lança é a
// diretoria (ou quem edita contas a pagar) — é dinheiro da folha.

async function requireExtrasManager() {
  const user = await requireUser();
  if (!isDirector(user) && !hasPermission(user, permKey("PAYABLES", "EDIT"))) return null;
  return user;
}

const month = z.string().regex(/^\d{4}-\d{2}$/, "Escolha o mês.");
const createSchema = z
  .object({
    teamMemberId: z.string().min(1, "Escolha a pessoa."),
    kind: z.enum(EXTRA_KINDS),
    description: z.string().trim().min(2, "Descreva o extra.").max(160),
    amount: z.coerce.number().positive("Informe o valor.").max(1_000_000),
    recurring: z.boolean(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    startMonth: month.optional(),
    endMonth: month.optional().or(z.literal("")),
    clientName: z.string().trim().max(120).optional(),
  })
  .refine((v) => (v.recurring ? !!v.startMonth : !!v.date), { message: "Informe quando foi feito." })
  .refine((v) => !v.recurring || !v.endMonth || !v.startMonth || v.endMonth >= v.startMonth, { message: "O mês final vem depois do inicial." });

export type ExtraInput = z.input<typeof createSchema>;

function revalidate() {
  revalidatePath("/extras", "layout");
  revalidatePath("/equipe/pagamentos");
  revalidatePath("/dashboard");
}

export async function createExtraAction(input: ExtraInput): Promise<{ ok: boolean; error?: string }> {
  const user = await requireExtrasManager();
  if (!user) return { ok: false, error: "Só a diretoria lança extras." };
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Confira os dados." };
  const v = parsed.data;
  const member = await db.teamMember.findFirst({ where: { id: v.teamMemberId, organizationId: user.organizationId } });
  if (!member) return { ok: false, error: "Pessoa não encontrada na equipe." };

  const date = v.recurring ? noonOf(`${v.startMonth}-01`) : noonOf(v.date!);
  const bonus = await db.extraBonus.create({
    data: {
      organizationId: user.organizationId,
      teamMemberId: member.id,
      kind: v.kind,
      description: v.description,
      amount: v.amount,
      recurring: v.recurring,
      date,
      endCompetence: v.recurring && v.endMonth ? v.endMonth : null,
      clientName: v.clientName || null,
      createdById: user.id,
    },
  });
  await syncPayroll(user.organizationId);

  // Dá gás: a pessoa fica sabendo na hora que ganhou.
  if (member.userId) {
    const comp = competenceOf(date);
    await notifyUsers({
      organizationId: user.organizationId,
      userIds: [member.userId],
      title: `Você ganhou um extra de ${formatCurrency(v.amount)} 🎉`,
      body: `${extraKindLabel(v.kind)} · ${v.description}. ${v.recurring ? "Entra todo mês nos seus ganhos." : `Já está no seu mês de ${competenceLabel(comp)}.`}`,
      link: "/dashboard",
      category: "operacao",
    });
  }
  await audit({ organizationId: user.organizationId, userId: user.id, action: "EXTRA_CREATED", entityType: "ExtraBonus", entityId: bonus.id, metadata: { kind: v.kind, amount: v.amount, recurring: v.recurring, member: member.name } });
  revalidate();
  return { ok: true };
}

// Lançamentos já pagos são histórico: nunca mudam.
async function paidPayableIds(payableIds: (string | null)[]) {
  const ids = payableIds.filter((x): x is string => !!x);
  if (!ids.length) return new Set<string>();
  const paid = await db.accountPayable.findMany({ where: { id: { in: ids }, status: "PAGO" }, select: { id: true } });
  return new Set(paid.map((p) => p.id));
}

const updateSchema = z.object({
  description: z.string().trim().min(2, "Descreva o extra.").max(160),
  amount: z.coerce.number().positive("Informe o valor.").max(1_000_000),
  endMonth: month.optional().or(z.literal("")),
  clientName: z.string().trim().max(120).optional(),
});

export async function updateExtraAction(id: string, input: z.input<typeof updateSchema>): Promise<{ ok: boolean; error?: string }> {
  const user = await requireExtrasManager();
  if (!user) return { ok: false, error: "Só a diretoria altera extras." };
  const parsed = updateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Confira os dados." };
  const bonus = await db.extraBonus.findFirst({ where: { id, organizationId: user.organizationId }, include: { entries: true } });
  if (!bonus) return { ok: false, error: "Extra não encontrado." };
  const v = parsed.data;
  const end = bonus.recurring && v.endMonth ? v.endMonth : null;
  if (end && end < competenceOf(bonus.date)) return { ok: false, error: "O mês final vem depois do inicial." };

  const paid = await paidPayableIds(bonus.entries.map((e) => e.payableId));
  const open = bonus.entries.filter((e) => !e.payableId || !paid.has(e.payableId));
  await db.$transaction([
    db.extraBonus.update({ where: { id }, data: { description: v.description, amount: v.amount, endCompetence: end, clientName: v.clientName || null } }),
    // Novo valor vale para o que ainda não foi pago.
    db.extraBonusEntry.updateMany({ where: { id: { in: open.map((e) => e.id) } }, data: { amount: v.amount } }),
    // Meses depois do novo fim (ainda não pagos) saem da folha.
    db.extraBonusEntry.deleteMany({ where: { id: { in: open.filter((e) => end && e.competence > end).map((e) => e.id) } } }),
  ]);
  await syncPayroll(user.organizationId);
  await audit({ organizationId: user.organizationId, userId: user.id, action: "EXTRA_UPDATED", entityType: "ExtraBonus", entityId: id, metadata: { amount: v.amount, end } });
  revalidate();
  return { ok: true };
}

// Recorrente: para de entrar depois do mês atual (o deste mês continua).
export async function endExtraAction(id: string): Promise<{ ok: boolean; error?: string }> {
  const user = await requireExtrasManager();
  if (!user) return { ok: false, error: "Só a diretoria altera extras." };
  const bonus = await db.extraBonus.findFirst({ where: { id, organizationId: user.organizationId, recurring: true }, include: { entries: true } });
  if (!bonus) return { ok: false, error: "Extra não encontrado." };
  const end = competenceOf(new Date());
  const paid = await paidPayableIds(bonus.entries.map((e) => e.payableId));
  await db.$transaction([
    db.extraBonus.update({ where: { id }, data: { endCompetence: end } }),
    db.extraBonusEntry.deleteMany({ where: { id: { in: bonus.entries.filter((e) => e.competence > end && (!e.payableId || !paid.has(e.payableId))).map((e) => e.id) } } }),
  ]);
  await syncPayroll(user.organizationId);
  await audit({ organizationId: user.organizationId, userId: user.id, action: "EXTRA_ENDED", entityType: "ExtraBonus", entityId: id, metadata: { end } });
  revalidate();
  return { ok: true };
}

export async function deleteExtraAction(id: string): Promise<{ ok: boolean; error?: string }> {
  const user = await requireExtrasManager();
  if (!user) return { ok: false, error: "Só a diretoria exclui extras." };
  const bonus = await db.extraBonus.findFirst({ where: { id, organizationId: user.organizationId }, include: { entries: true } });
  if (!bonus) return { ok: false, error: "Extra não encontrado." };
  const paid = await paidPayableIds(bonus.entries.map((e) => e.payableId));
  const paidEntries = bonus.entries.filter((e) => e.payableId && paid.has(e.payableId));
  if (paidEntries.length > 0) {
    return {
      ok: false,
      error: bonus.recurring
        ? "Este extra já foi pago em algum mês. Use “Encerrar” para ele parar de entrar."
        : `Este extra já foi pago na folha de ${competenceLabel(paidEntries[0].competence)}. Desfaça o pagamento da folha antes de excluir.`,
    };
  }
  await db.extraBonus.delete({ where: { id } });
  await syncPayroll(user.organizationId);
  await audit({ organizationId: user.organizationId, userId: user.id, action: "EXTRA_DELETED", entityType: "ExtraBonus", entityId: id, metadata: { kind: bonus.kind, amount: Number(bonus.amount) } });
  revalidate();
  return { ok: true };
}
