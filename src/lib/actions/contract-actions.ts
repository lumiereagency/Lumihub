"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth/guard";
import { permKey } from "@/lib/auth/permissions";
import { audit } from "@/lib/audit";
import {
  contractSchema,
  contractTemplateSchema,
  renderContractBody,
  RECURRENCE_LABELS,
} from "@/lib/validation/contracts";
import { formatCurrency, formatDate } from "@/lib/format";
import { createContractReceivable, nextCycleOnOrAfter, nextPaymentDayOnOrAfter } from "@/lib/billing/recurring";
import type { ActionState } from "@/lib/actions/auth-actions";
import type { Prisma } from "@/generated/prisma/client";

type TxClient = Prisma.TransactionClient;

// Contrato aprovado (status ATIVO) gera receita — Fase 26, princípio de
// integração entre módulos. Gera apenas a primeira cobrança aqui; as
// parcelas seguintes de contratos recorrentes são geradas pela rodada
// diária em @/lib/billing/recurring (Fase 46, completa a régua da Fase 9).
// Início/término do contrato só contam a duração dele — quem ancora a
// cobrança é o "dia do pagamento" (se informado); sem ele, cai no início
// do contrato. De qualquer forma a data nunca fica no passado: se a
// referência já passou, avança para a próxima ocorrência igual ou
// posterior a hoje.
async function generateInitialReceivable(tx: TxClient, contractId: string) {
  const existing = await tx.accountReceivable.findFirst({ where: { contractId } });
  if (existing) return;

  const contract = await tx.contract.findUniqueOrThrow({ where: { id: contractId } });
  const dueDate = contract.paymentDay
    ? nextPaymentDayOnOrAfter(contract.paymentDay)
    : nextCycleOnOrAfter(contract.startDate, contract.recurrence);

  await createContractReceivable(
    tx,
    contract,
    dueDate,
    contract.recurrence === "UNICO"
      ? "Gerado automaticamente na ativação do contrato."
      : "Primeira cobrança gerada automaticamente na ativação do contrato.",
  );
}

// Contrato ativo com data de término → Agenda (Fase 26): mantém um evento
// de vencimento sincronizado, permitindo alertar sobre renovação/expiração.
async function syncContractExpiryEvent(tx: TxClient, contractId: string) {
  const contract = await tx.contract.findUniqueOrThrow({ where: { id: contractId } });
  const existing = await tx.calendarEvent.findFirst({ where: { contractId, type: "CONTRATO" } });

  const shouldHaveEvent = contract.status === "ATIVO" && contract.endDate;

  if (!shouldHaveEvent) {
    if (existing) await tx.calendarEvent.delete({ where: { id: existing.id } });
    return;
  }

  const data = {
    title: `Vencimento de contrato — ${contract.title}`,
    startAt: contract.endDate as Date,
    clientId: contract.clientId,
  };

  if (existing) {
    await tx.calendarEvent.update({ where: { id: existing.id }, data });
  } else {
    await tx.calendarEvent.create({
      data: { organizationId: contract.organizationId, type: "CONTRATO", contractId: contract.id, ...data },
    });
  }
}

function buildGeneratedBody(
  bodyTemplate: string,
  contract: { title: string; value: unknown; recurrence: string; startDate: Date; endDate?: Date | null },
  client: { companyName: string; cnpj: string | null; contactName: string | null },
  organizationName: string,
  currency: string,
): string {
  return renderContractBody(bodyTemplate, {
    clientName: client.companyName,
    clientCnpj: client.cnpj,
    clientContact: client.contactName,
    title: contract.title,
    valueLabel: formatCurrency(Number(contract.value), currency),
    recurrenceLabel: RECURRENCE_LABELS[contract.recurrence as keyof typeof RECURRENCE_LABELS] ?? contract.recurrence,
    startDateLabel: formatDate(contract.startDate),
    endDateLabel: contract.endDate ? formatDate(contract.endDate) : "indeterminado",
    organizationName,
  });
}

function parseContractForm(formData: FormData) {
  return contractSchema.safeParse({
    clientId: formData.get("clientId"),
    templateId: formData.get("templateId"),
    title: formData.get("title"),
    type: formData.get("type") || "CLIENTE",
    value: formData.get("value"),
    recurrence: formData.get("recurrence") || "UNICO",
    startDate: formData.get("startDate"),
    endDate: formData.get("endDate"),
    paymentDay: formData.get("paymentDay"),
    status: formData.get("status") || "RASCUNHO",
  });
}

export async function createContractAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission(permKey("CONTRACTS", "CREATE"));

  const parsed = parseContractForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Verifique os dados informados." };
  }

  const client = await db.client.findFirst({
    where: { id: parsed.data.clientId, organizationId: user.organizationId },
  });
  if (!client) {
    return { error: "Cliente não encontrado." };
  }

  const organization = await db.organization.findUniqueOrThrow({ where: { id: user.organizationId } });

  let generatedBody: string | null = null;
  if (parsed.data.templateId) {
    const template = await db.contractTemplate.findFirst({
      where: { id: parsed.data.templateId, organizationId: user.organizationId },
    });
    if (template) {
      generatedBody = buildGeneratedBody(template.bodyTemplate, parsed.data, client, organization.name, organization.currency);
    }
  }

  const contract = await db.$transaction(async (tx) => {
    const created = await tx.contract.create({
      data: { organizationId: user.organizationId, ...parsed.data, generatedBody },
    });
    if (created.status === "ATIVO") {
      await generateInitialReceivable(tx, created.id);
    }
    await syncContractExpiryEvent(tx, created.id);
    return created;
  });

  await audit({
    organizationId: user.organizationId,
    userId: user.id,
    action: contract.status === "ATIVO" ? "CONTRACT_ACTIVATED" : "CONTRACT_CREATED",
    entityType: "Contract",
    entityId: contract.id,
    metadata: { title: contract.title, clientId: contract.clientId },
  });

  revalidatePath("/contratos");
  revalidatePath(`/clientes/${contract.clientId}`);
  return { success: "Contrato criado." };
}

export async function updateContractAction(
  contractId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requirePermission(permKey("CONTRACTS", "EDIT"));

  const parsed = parseContractForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Verifique os dados informados." };
  }

  const existing = await db.contract.findFirst({
    where: { id: contractId, organizationId: user.organizationId },
  });
  if (!existing) {
    return { error: "Contrato não encontrado." };
  }

  const client = await db.client.findFirst({
    where: { id: parsed.data.clientId, organizationId: user.organizationId },
  });
  if (!client) {
    return { error: "Cliente não encontrado." };
  }

  const wasActive = existing.status === "ATIVO";
  const becomesActive = parsed.data.status === "ATIVO";

  await db.$transaction(async (tx) => {
    await tx.contract.update({ where: { id: contractId }, data: parsed.data });
    if (!wasActive && becomesActive) {
      await generateInitialReceivable(tx, contractId);
    }
    await syncContractExpiryEvent(tx, contractId);
  });

  await audit({
    organizationId: user.organizationId,
    userId: user.id,
    action: !wasActive && becomesActive ? "CONTRACT_ACTIVATED" : "CONTRACT_UPDATED",
    entityType: "Contract",
    entityId: contractId,
  });

  revalidatePath("/contratos");
  revalidatePath(`/clientes/${parsed.data.clientId}`);
  return { success: "Contrato atualizado." };
}

function parseTemplateForm(formData: FormData) {
  return contractTemplateSchema.safeParse({
    name: formData.get("name"),
    type: formData.get("type") || "CLIENTE",
    bodyTemplate: formData.get("bodyTemplate"),
  });
}

export async function createContractTemplateAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requirePermission(permKey("CONTRACTS", "MANAGE"));

  const parsed = parseTemplateForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Verifique os dados informados." };
  }

  const template = await db.contractTemplate.create({
    data: { organizationId: user.organizationId, ...parsed.data },
  });

  await audit({
    organizationId: user.organizationId,
    userId: user.id,
    action: "CONTRACT_TEMPLATE_CREATED",
    entityType: "ContractTemplate",
    entityId: template.id,
  });

  revalidatePath("/contratos");
  return { success: "Modelo criado." };
}

export async function deleteContractTemplateAction(templateId: string) {
  const user = await requirePermission(permKey("CONTRACTS", "MANAGE"));

  const template = await db.contractTemplate.findFirst({
    where: { id: templateId, organizationId: user.organizationId },
  });
  if (!template) return;

  await db.contractTemplate.delete({ where: { id: templateId } });

  await audit({
    organizationId: user.organizationId,
    userId: user.id,
    action: "CONTRACT_TEMPLATE_DELETED",
    entityType: "ContractTemplate",
    entityId: templateId,
  });

  revalidatePath("/contratos");
}
