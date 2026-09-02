"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth/guard";
import { permKey } from "@/lib/auth/permissions";
import { audit } from "@/lib/audit";
import { clientSchema } from "@/lib/validation/clients";
import type { ActionState } from "@/lib/actions/auth-actions";

function parseClientForm(formData: FormData) {
  return clientSchema.safeParse({
    companyName: formData.get("companyName"),
    cnpj: formData.get("cnpj"),
    contactName: formData.get("contactName"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    address: formData.get("address"),
    instagram: formData.get("instagram"),
    website: formData.get("website"),
    status: formData.get("status") || "ATIVO",
    notes: formData.get("notes"),
  });
}

export async function createClientAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission(permKey("CLIENTS", "CREATE"));

  const parsed = parseClientForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Verifique os dados informados." };
  }

  const client = await db.client.create({
    data: { organizationId: user.organizationId, ...parsed.data },
  });

  await audit({
    organizationId: user.organizationId,
    userId: user.id,
    action: "CLIENT_CREATED",
    entityType: "Client",
    entityId: client.id,
    metadata: { companyName: client.companyName },
  });

  revalidatePath("/clientes");
  return { success: "Cliente cadastrado." };
}

export async function updateClientAction(
  clientId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requirePermission(permKey("CLIENTS", "EDIT"));

  const parsed = parseClientForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Verifique os dados informados." };
  }

  const client = await db.client.findFirst({ where: { id: clientId, organizationId: user.organizationId } });
  if (!client) {
    return { error: "Cliente não encontrado." };
  }

  await db.client.update({ where: { id: clientId }, data: parsed.data });

  await audit({
    organizationId: user.organizationId,
    userId: user.id,
    action: "CLIENT_UPDATED",
    entityType: "Client",
    entityId: clientId,
  });

  revalidatePath("/clientes");
  revalidatePath(`/clientes/${clientId}`);
  return { success: "Cliente atualizado." };
}

// Exclusão lógica (§ pedido do usuário: "ainda não vi a opção de apagar ou
// excluir um cliente") — nunca remove a linha de verdade, só marca
// deletedAt e some das listagens (mesmo padrão já usado em Lead). Contratos,
// propostas, projetos etc. já vinculados ao cliente continuam intactos e
// consultáveis por quem acessa direto pelo registro deles.
export async function deleteClientAction(clientId: string): Promise<ActionState> {
  const user = await requirePermission(permKey("CLIENTS", "DELETE"));

  const client = await db.client.findFirst({ where: { id: clientId, organizationId: user.organizationId, deletedAt: null } });
  if (!client) return { error: "Cliente não encontrado." };

  await db.client.update({ where: { id: clientId }, data: { deletedAt: new Date() } });

  await audit({
    organizationId: user.organizationId,
    userId: user.id,
    action: "CLIENT_DELETED",
    entityType: "Client",
    entityId: clientId,
    metadata: { companyName: client.companyName },
  });

  revalidatePath("/clientes");
  return { success: "Cliente excluído." };
}
