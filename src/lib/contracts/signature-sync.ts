import "server-only";
import { db } from "@/lib/db";
import { syncContractFinance } from "@/lib/finance/sync";
import { audit } from "@/lib/audit";
import { getAutentiqueCredentials, getAutentiqueDocument, type AutentiqueSigner } from "@/lib/integrations/autentique";
import { notifyUsers } from "@/lib/notifications/notify";

export interface StoredSigner {
  publicId: string;
  role: "CONTRATANTE" | "CONTRATADA";
  name: string | null;
  email: string | null;
  link: string | null;
  signedAt: string | null;
  rejectedAt: string | null;
  viewedAt?: string | null;
}

// Lê o estado real do documento direto na API do Autentique (nunca confia só
// no corpo do webhook) e atualiza contrato, proposta e avisos da equipe.
export async function syncContractSignature(contractId: string): Promise<{ status: string } | null> {
  const contract = await db.contract.findUnique({
    where: { id: contractId },
    include: { proposal: { select: { id: true, createdByUserId: true, title: true } }, client: { select: { companyName: true } } },
  });
  if (!contract?.signatureDocumentId) return null;
  const credentials = await getAutentiqueCredentials(contract.organizationId);
  if (!credentials) return null;

  const doc = await getAutentiqueDocument(credentials, contract.signatureDocumentId);
  if (!doc) return null;

  const stored = (contract.signatureSigners ?? []) as unknown as StoredSigner[];
  const byId = new Map<string, AutentiqueSigner>(doc.signers.map((s) => [s.publicId, s]));
  const signers = stored.map((s) => {
    const fresh = byId.get(s.publicId);
    return fresh ? { ...s, signedAt: fresh.signedAt, rejectedAt: fresh.rejectedAt, viewedAt: fresh.viewedAt ?? null, link: s.link ?? fresh.link } : s;
  });

  const allSigned = signers.length > 0 && signers.every((s) => s.signedAt);
  const rejected = signers.some((s) => s.rejectedAt);
  const status = allSigned ? "SIGNED" : rejected ? "REJECTED" : signers.some((s) => s.signedAt) ? "PARTIAL" : "PENDING";
  const changed = status !== contract.signatureStatus;

  await db.contract.update({
    where: { id: contract.id },
    data: {
      signatureSigners: signers as unknown as object,
      signatureStatus: status,
      ...(allSigned
        ? { status: "ATIVO", signedAt: contract.signedAt ?? new Date(), signedFileUrl: doc.signedFileUrl ?? contract.signedFileUrl }
        : {}),
    },
  });

  // Assinado = contrato ativo: já gera a primeira cobrança no financeiro.
  if (allSigned) await db.$transaction((tx) => syncContractFinance(tx, contract.id));

  if (changed && (status === "SIGNED" || status === "REJECTED")) {
    const admins = await db.user.findMany({
      where: { organizationId: contract.organizationId, isActive: true, deletedAt: null, OR: [{ isOwner: true }, { role: { key: "ADMIN" } }] },
      select: { id: true },
    });
    const ids = new Set([...admins.map((a) => a.id), contract.proposal?.createdByUserId].filter((v): v is string => !!v));
    const signed = status === "SIGNED";
    await notifyUsers({
      organizationId: contract.organizationId,
      userIds: [...ids],
      title: signed ? "Contrato assinado ✍️" : "Contrato recusado na assinatura",
      body: `${contract.client.companyName} ${signed ? "assinou" : "recusou"} "${contract.title}".`,
      link: contract.proposal ? `/propostas/${contract.proposal.id}` : "/contratos",
      category: "comercial",
    });
    await audit({
      organizationId: contract.organizationId,
      userId: null,
      action: signed ? "CONTRACT_SIGNED" : "CONTRACT_SIGNATURE_REJECTED",
      entityType: "Contract",
      entityId: contract.id,
    });
  }

  return { status };
}
