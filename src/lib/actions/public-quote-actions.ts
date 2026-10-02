"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { convertLeadToClient, fillClientGaps } from "@/lib/crm/convert";
import { LEAD_STAGES } from "@/lib/validation/crm";
import { formatDocument, isValidCnpj, isValidCpf, onlyDigits } from "@/lib/documents";

// Ações da página pública do orçamento (/orcamento/[token]): sem login. O
// token de 24 caracteres aleatórios é a única credencial, e ele só permite
// responder aquele orçamento — nunca ler ou alterar mais nada.

type Result = { ok: true } | { ok: false; error: string };

const signerSchema = z
  .object({
    personType: z.enum(["PF", "PJ"]),
    name: z.string().trim().min(3, "Informe o nome completo.").max(160),
    document: z.string().trim().transform(onlyDigits),
    representative: z.string().trim().max(120).optional(),
    representativeDoc: z.string().trim().transform(onlyDigits).optional(),
    email: z.string().trim().email("Informe um e-mail válido."),
    phone: z
      .string()
      .trim()
      .refine((v) => v.replace(/\D/g, "").length >= 10, "Informe o WhatsApp com DDD."),
    address: z.string().trim().min(8, "Informe o endereço completo.").max(300),
    paymentDay: z.number().int().min(1).max(28).nullable().optional(),
  })
  .superRefine((v, ctx) => {
    if (v.personType === "PF") {
      if (!isValidCpf(v.document)) ctx.addIssue({ code: "custom", path: ["document"], message: "Confira o CPF: os números não batem." });
      return;
    }
    if (!isValidCnpj(v.document)) ctx.addIssue({ code: "custom", path: ["document"], message: "Confira o CNPJ: os números não batem." });
    if (!v.representative || v.representative.length < 3) ctx.addIssue({ code: "custom", path: ["representative"], message: "Informe quem vai assinar pela empresa." });
    if (v.representativeDoc && !isValidCpf(v.representativeDoc)) ctx.addIssue({ code: "custom", path: ["representativeDoc"], message: "Confira o CPF de quem assina." });
  });

const responseSchema = z.discriminatedUnion("response", [
  z.object({
    response: z.literal("ACEITA"),
    choice: z.object({ oneTime: z.string().max(20).nullable().optional(), monthly: z.string().max(20).nullable().optional() }),
    signer: signerSchema,
    message: z.string().trim().max(1500).optional(),
  }),
  z.object({ response: z.literal("AJUSTE"), message: z.string().trim().min(3, "Conte o que você gostaria de ajustar.").max(1500) }),
  z.object({ response: z.literal("RECUSADA"), message: z.string().trim().max(1500).optional() }),
]);

export type QuoteResponseInput = z.input<typeof responseSchema>;

async function notifyTeam(organizationId: string, proposal: { id: string; createdByUserId: string | null; leadId: string | null }, title: string, body: string) {
  const [admins, lead] = await Promise.all([
    db.user.findMany({
      where: { organizationId, isActive: true, deletedAt: null, OR: [{ isOwner: true }, { role: { key: "ADMIN" } }] },
      select: { id: true },
    }),
    proposal.leadId ? db.lead.findUnique({ where: { id: proposal.leadId }, select: { ownerUserId: true } }) : null,
  ]);
  const ids = new Set([...admins.map((a) => a.id), proposal.createdByUserId, lead?.ownerUserId].filter((v): v is string => !!v));
  if (!ids.size) return;
  await db.notification.createMany({
    data: [...ids].map((userId) => ({ organizationId, userId, title, body, link: `/propostas/${proposal.id}` })),
  });
}

export async function respondToQuoteAction(token: string, input: QuoteResponseInput): Promise<Result> {
  if (typeof token !== "string" || token.length < 16 || token.length > 64) return { ok: false, error: "Link inválido." };
  const parsed = responseSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Confira os dados." };
  const d = parsed.data;

  const proposal = await db.proposal.findUnique({ where: { publicToken: token } });
  if (!proposal) return { ok: false, error: "Este orçamento não está mais disponível." };
  if (proposal.status === "ACEITA") return { ok: false, error: "Este orçamento já foi aceito. Se quiser mudar algo, fale com a gente pelo WhatsApp." };
  if (proposal.validUntil && proposal.validUntil.getTime() < Date.now() && d.response === "ACEITA") {
    return { ok: false, error: "A validade deste orçamento terminou. Peça uma atualização pelo botão \"Quero ajustar\" ou fale com a gente." };
  }

  const now = new Date();
  const who = proposal.recipientName?.split(" ")[0] ?? "O cliente";

  if (d.response === "ACEITA") {
    const pf = d.signer.personType === "PF";
    const signer = {
      ...d.signer,
      document: formatDocument(d.signer.document),
      // Pessoa física assina por si mesma; só empresa tem representante.
      representative: pf ? null : d.signer.representative,
      representativeDoc: pf || !d.signer.representativeDoc ? null : formatDocument(d.signer.representativeDoc),
    };
    await db.proposal.update({
      where: { id: proposal.id },
      data: {
        status: "ACEITA",
        response: "ACEITA",
        responseMessage: d.message || null,
        respondedAt: now,
        chosenPayment: JSON.stringify(d.choice),
        signerData: signer,
      },
    });

    // Fechou: o lead vira cliente já com os dados que ele mesmo preencheu.
    const extras = {
      companyName: signer.name,
      contactName: pf ? signer.name : signer.representative || proposal.recipientName,
      cnpj: signer.document,
      email: signer.email,
      phone: signer.phone,
      address: signer.address,
    };
    let clientId = proposal.clientId;
    if (proposal.leadId) {
      const converted = await convertLeadToClient(proposal.organizationId, proposal.leadId, extras);
      if (converted) clientId = converted.clientId;
    } else if (clientId) {
      await fillClientGaps(clientId, extras);
    }
    if (clientId && clientId !== proposal.clientId) await db.proposal.update({ where: { id: proposal.id }, data: { clientId } });

    await notifyTeam(proposal.organizationId, proposal, "Orçamento aceito! 🎉", `${who} aceitou "${proposal.title}". Já dá para gerar o contrato.`);
  } else {
    await db.proposal.update({
      where: { id: proposal.id },
      data: {
        status: d.response === "AJUSTE" ? "EM_NEGOCIACAO" : "RECUSADA",
        response: d.response,
        responseMessage: d.message || null,
        respondedAt: now,
      },
    });
    if (d.response === "AJUSTE" && proposal.leadId) {
      const lead = await db.lead.findUnique({ where: { id: proposal.leadId } });
      if (lead && LEAD_STAGES.indexOf(lead.stage) < LEAD_STAGES.indexOf("NEGOCIACAO")) {
        await db.lead.update({ where: { id: lead.id }, data: { stage: "NEGOCIACAO", lastContactAt: now } });
      }
    }
    await notifyTeam(
      proposal.organizationId,
      proposal,
      d.response === "AJUSTE" ? "Cliente pediu ajuste no orçamento" : "Orçamento recusado",
      `${who} ${d.response === "AJUSTE" ? "quer ajustar" : "recusou"} "${proposal.title}"${d.message ? `: "${d.message.slice(0, 140)}"` : "."}`,
    );
  }

  await audit({
    organizationId: proposal.organizationId,
    userId: null,
    action: "PROPOSAL_CLIENT_RESPONSE",
    entityType: "Proposal",
    entityId: proposal.id,
    metadata: { response: d.response },
  });

  revalidatePath(`/orcamento/${token}`);
  revalidatePath("/propostas");
  revalidatePath(`/propostas/${proposal.id}`);
  revalidatePath("/crm");
  return { ok: true };
}
