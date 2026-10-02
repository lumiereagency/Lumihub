import "server-only";
import { db } from "@/lib/db";

export interface ClientExtras {
  companyName?: string | null;
  contactName?: string | null;
  cnpj?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
}

// Converte o lead em cliente (ou devolve o cliente já convertido),
// copiando os serviços de interesse. Dados extras (ex: os que o cliente
// preencheu ao aceitar o orçamento) completam o cadastro sem apagar nada.
export async function convertLeadToClient(organizationId: string, leadId: string, extras: ClientExtras = {}): Promise<{ clientId: string; created: boolean } | null> {
  const lead = await db.lead.findFirst({
    where: { id: leadId, organizationId },
    include: { services: { select: { serviceId: true } } },
  });
  if (!lead) return null;

  if (lead.convertedClientId) {
    await fillClientGaps(lead.convertedClientId, extras);
    return { clientId: lead.convertedClientId, created: false };
  }

  const client = await db.$transaction(async (tx) => {
    const created = await tx.client.create({
      data: {
        organizationId,
        companyName: extras.companyName || lead.company,
        contactName: extras.contactName || lead.contactName,
        cnpj: extras.cnpj || null,
        email: extras.email || null,
        phone: extras.phone || lead.phone || lead.whatsapp,
        address: extras.address || null,
        instagram: lead.instagram,
        website: lead.website,
        status: "ATIVO",
        notes: lead.notes,
        services: { create: lead.services.map((s) => ({ serviceId: s.serviceId })) },
      },
    });
    await tx.lead.update({ where: { id: leadId }, data: { stage: "FECHADO", convertedClientId: created.id } });
    return created;
  });

  return { clientId: client.id, created: true };
}

export async function fillClientGaps(clientId: string, extras: ClientExtras): Promise<void> {
  const client = await db.client.findUnique({ where: { id: clientId } });
  if (!client) return;
  const data: Record<string, string> = {};
  if (!client.cnpj && extras.cnpj) data.cnpj = extras.cnpj;
  if (!client.email && extras.email) data.email = extras.email;
  if (!client.phone && extras.phone) data.phone = extras.phone;
  if (!client.address && extras.address) data.address = extras.address;
  if (!client.contactName && extras.contactName) data.contactName = extras.contactName;
  if (Object.keys(data).length) await db.client.update({ where: { id: clientId }, data });
}
