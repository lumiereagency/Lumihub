"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { hasPermission, requireUser } from "@/lib/auth/guard";
import { permKey } from "@/lib/auth/permissions";
import type { CurrentUser } from "@/lib/auth/session";
import { audit } from "@/lib/audit";
import { loadContractData } from "@/lib/contracts/contract-data";
import { renderContractPdf } from "@/lib/contracts/contract-pdf";
import { syncContractSignature, type StoredSigner } from "@/lib/contracts/signature-sync";
import { createAutentiqueDocument, getAutentiqueCredentials } from "@/lib/integrations/autentique";
import { sendWhatsApp } from "@/lib/integrations/whatsapp";
import { fillTemplate, getPricingSettings } from "@/lib/pricing/settings";

type Fail = { ok: false; error: string };

const NO_PERMISSION: Fail = { ok: false, error: "Seu perfil não tem permissão para gerar ou enviar contratos." };

async function contractUser(): Promise<CurrentUser | null> {
  const user = await requireUser();
  return hasPermission(user, permKey("CONTRACTS", "CREATE")) || hasPermission(user, permKey("CRM", "MANAGE")) ? user : null;
}

function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

function revalidate(proposalId: string) {
  revalidatePath(`/propostas/${proposalId}`);
  revalidatePath("/propostas");
  revalidatePath("/contratos");
}

// Cria (uma vez) o registro do contrato a partir do orçamento aceito.
// Não gera cobranças: o financeiro continua sendo lançado pela equipe.
export async function generateContractAction(proposalId: string): Promise<{ ok: true; contractId: string } | Fail> {
  const user = await contractUser();
  if (!user) return NO_PERMISSION;
  const proposal = await db.proposal.findFirst({ where: { id: proposalId, organizationId: user.organizationId }, include: { contract: true } });
  if (!proposal) return { ok: false, error: "Orçamento não encontrado." };
  if (proposal.contract) return { ok: true, contractId: proposal.contract.id };
  if (proposal.status !== "ACEITA") return { ok: false, error: "O contrato é gerado depois que o cliente aceita o orçamento." };
  if (!proposal.clientId) return { ok: false, error: "Este orçamento ainda não está ligado a um cliente." };

  const monthly = Number(proposal.monthlyTotal ?? 0);
  const oneTime = Number(proposal.oneTimeTotal ?? 0);
  const signer = (proposal.signerData ?? {}) as { paymentDay?: number | null };
  const start = new Date();
  const contract = await db.contract.create({
    data: {
      organizationId: user.organizationId,
      clientId: proposal.clientId,
      proposalId: proposal.id,
      title: `Contrato · ${proposal.title}`,
      type: "CLIENTE",
      value: monthly > 0 ? monthly : oneTime,
      recurrence: monthly > 0 ? "MENSAL" : "UNICO",
      startDate: start,
      endDate: monthly > 0 && proposal.minMonths ? addMonths(start, proposal.minMonths) : null,
      paymentDay: monthly > 0 ? (signer.paymentDay ?? 10) : null,
      status: "RASCUNHO",
    },
  });

  await audit({ organizationId: user.organizationId, userId: user.id, action: "CONTRACT_CREATED", entityType: "Contract", entityId: contract.id, metadata: { proposalId } });
  revalidate(proposalId);
  return { ok: true, contractId: contract.id };
}

export async function buildContractMessageAction(proposalId: string): Promise<{ ok: true; message: string; phone: string | null } | Fail> {
  const user = await contractUser();
  if (!user) return NO_PERMISSION;
  const proposal = await db.proposal.findFirst({ where: { id: proposalId, organizationId: user.organizationId }, include: { contract: true } });
  if (!proposal?.contract) return { ok: false, error: "Gere o contrato primeiro." };
  const settings = await getPricingSettings(user.organizationId);
  const signer = (proposal.signerData ?? {}) as { phone?: string; representative?: string };
  const message = fillTemplate(settings.contractMessage, {
    nome: (signer.representative || proposal.recipientName || "").split(" ")[0] || "tudo bem",
    vendedor: user.name.split(" ")[0],
    titulo: proposal.title,
    link: proposal.contract.signatureLink ?? "{link}",
    validade: "",
  });
  return { ok: true, message, phone: signer.phone || proposal.recipientPhone };
}

// Gera o PDF, cria o documento no Autentique (cliente + representante da
// Lumière) e, se pedido, manda o link de assinatura pelo WhatsApp.
export async function sendContractForSignatureAction(
  proposalId: string,
  options: { sendWhatsApp: boolean; phone?: string; message?: string },
): Promise<{ ok: true; link: string | null; whatsapp: "sent" | "skipped" | "failed"; whatsappError?: string } | Fail> {
  const user = await contractUser();
  if (!user) return NO_PERMISSION;
  const proposal = await db.proposal.findFirst({ where: { id: proposalId, organizationId: user.organizationId }, include: { contract: true } });
  if (!proposal?.contract) return { ok: false, error: "Gere o contrato primeiro." };
  const contract = proposal.contract;
  if (contract.signatureStatus === "SIGNED") return { ok: false, error: "Este contrato já foi assinado." };

  const credentials = await getAutentiqueCredentials(user.organizationId);
  if (!credentials) return { ok: false, error: "Conecte o Autentique em Configurações → Integrações para enviar para assinatura." };

  let link = contract.signatureLink;
  if (!contract.signatureDocumentId) {
    const data = await loadContractData(user.organizationId, proposalId);
    if (!data) return { ok: false, error: "Não foi possível montar o contrato." };
    const settings = await getPricingSettings(user.organizationId);
    const pdf = await renderContractPdf(data);
    const clientSignerName = data.contratante.representative ? `${data.contratante.representative} (${data.contratante.name})` : data.contratante.name;

    const signers: ({ name: string } | { email: string })[] = [{ name: clientSignerName.slice(0, 120) }];
    if (settings.company.representativeEmail) signers.push({ email: settings.company.representativeEmail });

    let doc;
    try {
      doc = await createAutentiqueDocument({
        credentials,
        name: `Contrato ${data.code} · ${data.contratante.name}`.slice(0, 180),
        message: `Contrato de ${proposal.title} com a ${settings.company.legalName}.`,
        pdf,
        fileName: `contrato-${data.code}.pdf`,
        signers,
      });
    } catch (err) {
      await db.integrationLog.create({
        data: { organizationId: user.organizationId, integrationId: credentials.integrationId, direction: "SAIDA", eventType: "AUTENTIQUE_CREATE_DOCUMENT", status: "FALHA", errorMessage: (err as Error).message.slice(0, 500) },
      });
      return { ok: false, error: (err as Error).message };
    }

    const repEmail = settings.company.representativeEmail?.toLowerCase();
    const stored: StoredSigner[] = doc.signers
      .filter((s) => (s.email ? s.email.toLowerCase() === repEmail : true))
      .map((s) => ({
        publicId: s.publicId,
        role: s.email && s.email.toLowerCase() === repEmail ? "CONTRATADA" : "CONTRATANTE",
        name: s.name,
        email: s.email,
        link: s.link,
        signedAt: s.signedAt,
        rejectedAt: s.rejectedAt,
      }));
    link = stored.find((s) => s.role === "CONTRATANTE")?.link ?? null;

    await db.contract.update({
      where: { id: contract.id },
      data: {
        signatureProvider: "AUTENTIQUE",
        signatureDocumentId: doc.id,
        signatureLink: link,
        signatureSigners: stored as unknown as object,
        signatureStatus: "PENDING",
        signatureSentAt: new Date(),
        status: "AGUARDANDO_ASSINATURA",
      },
    });
    await db.integrationLog.create({
      data: { organizationId: user.organizationId, integrationId: credentials.integrationId, direction: "SAIDA", eventType: "AUTENTIQUE_CREATE_DOCUMENT", status: "SUCESSO", payload: { documentId: doc.id, sandbox: credentials.sandbox } },
    });
    await audit({ organizationId: user.organizationId, userId: user.id, action: "CONTRACT_SENT_FOR_SIGNATURE", entityType: "Contract", entityId: contract.id, metadata: { provider: "AUTENTIQUE", sandbox: credentials.sandbox } });
  }

  let whatsapp: "sent" | "skipped" | "failed" = "skipped";
  let whatsappError: string | undefined;
  if (options.sendWhatsApp && link) {
    const phone = (options.phone ?? "").replace(/\D/g, "");
    const message = (options.message ?? "").replaceAll("{link}", link).trim();
    if (phone.length < 10 || !message) {
      whatsapp = "failed";
      whatsappError = "Informe o WhatsApp com DDD e a mensagem.";
    } else {
      const result = await sendWhatsApp({ organizationId: user.organizationId, to: phone, message: message.includes(link) ? message : `${message}\n\n${link}` });
      whatsapp = result.delivered ? "sent" : "failed";
      whatsappError = result.pending ? "WhatsApp da Lumière desconectado." : result.error;
    }
  }

  revalidate(proposalId);
  return { ok: true, link, whatsapp, whatsappError };
}

export async function refreshContractSignatureAction(proposalId: string): Promise<{ ok: true; status: string } | Fail> {
  const user = await contractUser();
  if (!user) return NO_PERMISSION;
  const proposal = await db.proposal.findFirst({ where: { id: proposalId, organizationId: user.organizationId }, include: { contract: true } });
  if (!proposal?.contract?.signatureDocumentId) return { ok: false, error: "O contrato ainda não foi enviado para assinatura." };
  try {
    const result = await syncContractSignature(proposal.contract.id);
    if (!result) return { ok: false, error: "Não foi possível consultar o Autentique agora." };
    revalidate(proposalId);
    return { ok: true, status: result.status };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}
