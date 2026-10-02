"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Check,
  CircleDashed,
  Copy,
  Download,
  ExternalLink,
  Eye,
  FileSignature,
  FileText,
  MessageCircle,
  Pencil,
  RefreshCw,
  Send,
  Trash2,
  Files,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { formatCurrency } from "@/lib/format";
import type { QuoteBreakdown } from "@/lib/pricing/engine";
import { PROPOSAL_STATUS_LABELS } from "@/lib/validation/proposals";
import { documentLabel } from "@/lib/documents";
import { duplicateQuoteAction, markQuoteSentAction, sendQuoteWhatsAppAction, setQuoteStatusAction } from "@/lib/actions/quote-actions";
import { deleteProposalAction } from "@/lib/actions/proposal-actions";
import { generateContractAction, refreshContractSignatureAction, sendContractForSignatureAction } from "@/lib/actions/quote-contract-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { QuoteSummary } from "../quote-summary";

type Tone = "neutral" | "success" | "warning" | "error" | "info" | "accent";

interface Signer {
  role: "CONTRATANTE" | "CONTRATADA";
  name: string | null;
  email: string | null;
  signedAt: string | null;
  rejectedAt: string | null;
  viewedAt: string | null;
}

interface DetailProposal {
  id: string;
  title: string;
  status: string;
  party: { kind: "client" | "lead"; id: string; name: string } | null;
  recipientName: string | null;
  recipientPhone: string | null;
  createdBy: string | null;
  createdAt: string;
  sentAt: string | null;
  validUntil: string | null;
  viewedAt: string | null;
  lastViewedAt: string | null;
  viewCount: number;
  response: "ACEITA" | "AJUSTE" | "RECUSADA" | null;
  responseMessage: string | null;
  respondedAt: string | null;
  paymentLines: string[];
  signer: { personType: "PF" | "PJ" | null; representativeDoc: string | null; name: string; document: string; representative: string | null; email: string; phone: string; address: string; paymentDay: number | null } | null;
  notes: string | null;
  legacy: boolean;
  legacyValue: number;
  items: { id: string; name: string; billing: "MENSAL" | "PONTUAL"; quantity: number; unitPrice: number; monthlyFee: number | null }[];
  currency: string;
  contract: {
    id: string;
    status: string;
    signatureStatus: string | null;
    signatureLink: string | null;
    signatureSentAt: string | null;
    signedAt: string | null;
    signedFileUrl: string | null;
    signers: Signer[];
  } | null;
}

const STATUS_TONE: Record<string, Tone> = {
  RASCUNHO: "neutral",
  ENVIADA: "info",
  EM_NEGOCIACAO: "warning",
  ACEITA: "success",
  RECUSADA: "error",
  EXPIRADA: "neutral",
};

function when(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
}

function waLink(phone: string, text: string): string {
  const digits = phone.replace(/\D/g, "");
  const full = digits.length <= 11 ? `55${digits}` : digits;
  return `https://wa.me/${full}?text=${encodeURIComponent(text)}`;
}

const card = "flex flex-col gap-4 rounded-3xl border border-border bg-card p-5 sm:p-6";

export function QuoteDetail({
  proposal,
  quote,
  link,
  quoteMessage,
  contractMessage,
  whatsappConnected,
  autentique,
  companyReady,
  permissions,
  commission,
}: {
  proposal: DetailProposal;
  quote: QuoteBreakdown;
  link: string | null;
  quoteMessage: string;
  contractMessage: string;
  whatsappConnected: boolean;
  autentique: { connected: boolean; sandbox: boolean };
  companyReady: boolean;
  permissions: { canEdit: boolean; canCreate: boolean; canDelete: boolean; canContract: boolean; canManage: boolean };
  commission: { total: number; seller: string | null; lines: { name: string; rule: string; base: number | null; amount: number }[] } | null;
}) {
  const router = useRouter();
  const [phone, setPhone] = useState(proposal.recipientPhone ?? "");
  const [message, setMessage] = useState(quoteMessage);
  const [contractPhone, setContractPhone] = useState(proposal.signer?.phone || proposal.recipientPhone || "");
  const [contractMsg, setContractMsg] = useState(contractMessage);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();
  const accepted = proposal.status === "ACEITA";
  const money = (v: number) => formatCurrency(v, proposal.currency);

  function flash(ok: boolean, text: string) {
    setNotice({ ok, text });
  }

  function copyLink() {
    if (!link) return;
    navigator.clipboard
      .writeText(link)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      })
      .catch(() => flash(false, "O navegador bloqueou a cópia. Selecione o link e copie manualmente."));
    if (proposal.status === "RASCUNHO") startTransition(() => markQuoteSentAction(proposal.id, "link"));
  }

  function sendWhatsApp() {
    startTransition(async () => {
      const result = await sendQuoteWhatsAppAction(proposal.id, phone, message);
      if (!result.ok) return flash(false, result.error);
      flash(true, `Orçamento enviado pelo WhatsApp da Lumière${result.to ? ` para +${result.to}` : ""}.`);
      router.refresh();
    });
  }

  function openWa() {
    if (phone.replace(/\D/g, "").length < 10) return flash(false, "Informe o WhatsApp do cliente com DDD.");
    window.open(waLink(phone, message), "_blank", "noopener");
    startTransition(() => markQuoteSentAction(proposal.id, "wa.me"));
  }

  function generateContract() {
    startTransition(async () => {
      const result = await generateContractAction(proposal.id);
      if (!result.ok) return flash(false, result.error);
      flash(true, "Contrato gerado. Confira o PDF e envie para assinatura.");
      router.refresh();
    });
  }

  function sendContract(viaWhatsApp: boolean) {
    startTransition(async () => {
      const result = await sendContractForSignatureAction(proposal.id, { sendWhatsApp: viaWhatsApp, phone: contractPhone, message: contractMsg });
      if (!result.ok) return flash(false, result.error);
      if (result.whatsapp === "sent") flash(true, "Contrato enviado ao Autentique e link de assinatura mandado no WhatsApp.");
      else if (result.whatsapp === "failed") flash(false, `Contrato criado no Autentique, mas o WhatsApp falhou: ${result.whatsappError ?? "tente de novo"}. Copie o link abaixo.`);
      else flash(true, "Contrato enviado ao Autentique. Copie o link de assinatura abaixo.");
      router.refresh();
    });
  }

  function refreshSignature() {
    startTransition(async () => {
      const result = await refreshContractSignatureAction(proposal.id);
      if (!result.ok) return flash(false, result.error);
      flash(true, result.status === "SIGNED" ? "Contrato assinado por todos!" : "Status atualizado.");
      router.refresh();
    });
  }

  const timeline: { label: string; at: string | null; done: boolean; detail?: string }[] = [
    { label: `Criado${proposal.createdBy ? ` por ${proposal.createdBy.split(" ")[0]}` : ""}`, at: proposal.createdAt, done: true },
    { label: "Enviado ao cliente", at: proposal.sentAt, done: !!proposal.sentAt },
    {
      label: proposal.viewCount ? `Visto ${proposal.viewCount} ${proposal.viewCount === 1 ? "vez" : "vezes"}` : "Ainda não visto",
      at: proposal.lastViewedAt,
      done: proposal.viewCount > 0,
      detail: proposal.viewedAt && proposal.viewCount > 1 ? `primeira vez em ${when(proposal.viewedAt)}` : undefined,
    },
    {
      label: proposal.response === "ACEITA" ? "Aceito pelo cliente" : proposal.response === "AJUSTE" ? "Cliente pediu ajuste" : proposal.response === "RECUSADA" ? "Recusado" : "Aguardando resposta",
      at: proposal.respondedAt,
      done: !!proposal.response,
    },
    ...(accepted
      ? [
          { label: proposal.contract?.signatureSentAt ? "Contrato enviado para assinatura" : "Contrato a enviar", at: proposal.contract?.signatureSentAt ?? null, done: !!proposal.contract?.signatureSentAt },
          { label: "Contrato assinado", at: proposal.contract?.signedAt ?? null, done: proposal.contract?.signatureStatus === "SIGNED" },
        ]
      : []),
  ];

  return (
    <div className="flex flex-col gap-5">
      {/* Cabeçalho */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <Link href="/propostas" className="mb-2 inline-flex items-center gap-1.5 text-sm text-text-tertiary hover:text-text-primary">
            <ArrowLeft size={15} /> Orçamentos
          </Link>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-balance text-2xl font-semibold tracking-tight text-text-primary sm:text-[28px]">{proposal.title}</h1>
            <Badge tone={STATUS_TONE[proposal.status] ?? "neutral"} dot>
              {PROPOSAL_STATUS_LABELS[proposal.status as keyof typeof PROPOSAL_STATUS_LABELS] ?? proposal.status}
            </Badge>
          </div>
          {proposal.party && (
            <p className="mt-1 text-sm text-text-tertiary">
              {proposal.party.kind === "client" ? "Cliente" : "Lead"}:{" "}
              <Link href={proposal.party.kind === "client" ? `/clientes/${proposal.party.id}` : "/crm"} className="text-text-secondary underline-offset-2 hover:underline">
                {proposal.party.name}
              </Link>
              {proposal.recipientName && proposal.recipientName.trim().toLowerCase() !== proposal.party.name.trim().toLowerCase() ? ` · ${proposal.recipientName}` : ""}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {link && (
            <a href={link} target="_blank" rel="noreferrer" className="inline-flex h-11 items-center gap-2 rounded-full border border-border bg-card px-4 text-sm font-medium text-text-primary hover:bg-card-elevated">
              <Eye size={16} /> Ver como cliente
            </a>
          )}
          {permissions.canEdit && !accepted && (
            <Link href={`/propostas/${proposal.id}/editar`} className="inline-flex h-11 items-center gap-2 rounded-full border border-border bg-card px-4 text-sm font-medium text-text-primary hover:bg-card-elevated">
              <Pencil size={16} /> Editar
            </Link>
          )}
          {permissions.canCreate && (
            <Button
              variant="secondary"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const r = await duplicateQuoteAction(proposal.id);
                  if (r.ok) router.push(`/propostas/${r.id}/editar`);
                  else flash(false, r.error);
                })
              }
            >
              <Files size={16} /> <span className="hidden sm:inline">Duplicar</span>
            </Button>
          )}
          {permissions.canDelete && !proposal.contract && (
            <button
              type="button"
              aria-label="Excluir orçamento"
              disabled={pending}
              onClick={() => {
                if (!confirm("Excluir este orçamento? O link enviado ao cliente deixa de funcionar.")) return;
                startTransition(async () => {
                  await deleteProposalAction(proposal.id);
                  router.push("/propostas");
                });
              }}
              className="flex h-11 w-11 items-center justify-center rounded-full border border-border text-text-tertiary hover:bg-error/10 hover:text-error"
            >
              <Trash2 size={16} />
            </button>
          )}
        </div>
      </div>

      {notice && (
        <p role="status" className={cn("rounded-2xl px-4 py-3 text-sm", notice.ok ? "bg-success/10 text-success" : "bg-error/10 text-error")}>
          {notice.text}
        </p>
      )}

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="flex min-w-0 flex-col gap-5">
          {proposal.legacy && (
            <section className={card}>
              <h2 className="text-[17px] font-semibold tracking-tight text-text-primary">Proposta antiga</h2>
              <p className="text-sm text-text-secondary">
                Criada antes dos orçamentos com link, no valor de <strong className="lb-figures">{money(proposal.legacyValue)}</strong>. Edite para montar com os serviços da tabela e gerar o link
                personalizado.
              </p>
            </section>
          )}

          {/* Resposta do cliente */}
          {proposal.response && (
            <section className={cn(card, proposal.response === "ACEITA" && "border-success/40")}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-[17px] font-semibold tracking-tight text-text-primary">Resposta do cliente</h2>
                <span className="text-xs text-text-tertiary">{when(proposal.respondedAt)}</span>
              </div>
              {proposal.responseMessage && <p className="whitespace-pre-wrap rounded-2xl bg-card-elevated px-4 py-3 text-sm text-text-secondary">“{proposal.responseMessage}”</p>}
              {proposal.paymentLines.length > 0 && (
                <div>
                  <p className="mb-1 text-xs font-medium uppercase tracking-wide text-text-tertiary">Forma de pagamento escolhida</p>
                  <ul className="flex flex-col gap-1 text-sm text-text-primary">
                    {proposal.paymentLines.map((l) => (
                      <li key={l} className="lb-figures">
                        {l}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {proposal.signer && (
                <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
                  {[
                    ["Contratante", proposal.signer.personType === "PF" ? "Pessoa física" : proposal.signer.personType === "PJ" ? "Empresa" : null],
                    [proposal.signer.personType === "PF" ? "Nome completo" : "Nome / razão social", proposal.signer.name],
                    [documentLabel(proposal.signer.document), proposal.signer.document],
                    ["Quem assina", proposal.signer.representative],
                    ["CPF de quem assina", proposal.signer.representativeDoc],
                    ["E-mail", proposal.signer.email],
                    ["WhatsApp", proposal.signer.phone],
                    ["Endereço", proposal.signer.address],
                    ["Dia da mensalidade", proposal.signer.paymentDay ? `Dia ${proposal.signer.paymentDay}` : null],
                  ]
                    .filter(([, v]) => v)
                    .map(([k, v]) => (
                      <div key={k as string}>
                        <dt className="text-xs text-text-tertiary">{k}</dt>
                        <dd className="text-text-primary">{v}</dd>
                      </div>
                    ))}
                </dl>
              )}
            </section>
          )}

          {/* Contrato */}
          {accepted && permissions.canContract && (
            <section className={card}>
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-accent/12 text-accent-light">
                  <FileSignature size={18} />
                </span>
                <div>
                  <h2 className="text-[17px] font-semibold tracking-tight text-text-primary">Contrato</h2>
                  <p className="text-sm text-text-tertiary">Gerado com os dados que o cliente preencheu ao aceitar, pronto para assinatura no Autentique.</p>
                </div>
              </div>

              {!companyReady && (
                <p className="rounded-2xl bg-warning/10 px-4 py-3 text-sm text-warning">
                  Falta o CNPJ ou o endereço da Lumière.{" "}
                  {permissions.canManage ? (
                    <Link href="/propostas/configuracoes" className="underline underline-offset-2">
                      Preencher em Taxas e pagamento
                    </Link>
                  ) : (
                    "Peça para a diretoria preencher em Taxas e pagamento."
                  )}
                </p>
              )}

              {!proposal.contract ? (
                <Button onClick={generateContract} disabled={pending} className="w-fit">
                  <FileText size={16} /> Gerar contrato
                </Button>
              ) : (
                <>
                  <div className="flex flex-wrap gap-2">
                    <a href={`/api/propostas/${proposal.id}/contrato`} target="_blank" rel="noreferrer" className="inline-flex h-10 items-center gap-2 rounded-full border border-border px-4 text-sm font-medium text-text-primary hover:bg-card-elevated">
                      <ExternalLink size={15} /> Ver PDF
                    </a>
                    <a href={`/api/propostas/${proposal.id}/contrato?download=1`} className="inline-flex h-10 items-center gap-2 rounded-full border border-border px-4 text-sm font-medium text-text-primary hover:bg-card-elevated">
                      <Download size={15} /> Baixar
                    </a>
                    {proposal.contract.signedFileUrl && (
                      <a href={proposal.contract.signedFileUrl} target="_blank" rel="noreferrer" className="inline-flex h-10 items-center gap-2 rounded-full bg-success/12 px-4 text-sm font-medium text-success">
                        <Check size={15} /> PDF assinado (Autentique)
                      </a>
                    )}
                  </div>

                  {!proposal.contract.signatureSentAt ? (
                    autentique.connected ? (
                      <div className="flex flex-col gap-3 rounded-2xl border border-border p-4">
                        {autentique.sandbox && <p className="text-xs text-warning">Autentique em modo teste: o documento não tem validade jurídica.</p>}
                        <Input label="WhatsApp de quem assina" value={contractPhone} onChange={(e) => setContractPhone(e.target.value)} inputMode="tel" />
                        <Textarea label="Mensagem (o link entra no lugar de {link})" rows={5} value={contractMsg} onChange={(e) => setContractMsg(e.target.value)} />
                        <div className="flex flex-wrap gap-2">
                          <Button onClick={() => sendContract(true)} disabled={pending || !whatsappConnected}>
                            <Send size={16} /> Enviar para assinatura no WhatsApp
                          </Button>
                          <Button variant="secondary" onClick={() => sendContract(false)} disabled={pending}>
                            Só criar o link
                          </Button>
                        </div>
                        {!whatsappConnected && <p className="text-xs text-text-tertiary">WhatsApp da Lumière desconectado — crie o link e envie manualmente.</p>}
                      </div>
                    ) : (
                      <p className="rounded-2xl bg-card-elevated px-4 py-3 text-sm text-text-secondary">
                        Para enviar para assinatura, conecte o Autentique em{" "}
                        <Link href="/configuracoes/integracoes" className="underline underline-offset-2">
                          Configurações → Integrações
                        </Link>
                        .
                      </p>
                    )
                  ) : (
                    <div className="flex flex-col gap-3">
                      <ul className="flex flex-col gap-2">
                        {proposal.contract.signers.map((s, idx) => (
                          <li key={idx} className="flex items-center justify-between gap-3 rounded-2xl bg-card-elevated/60 px-4 py-3">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium text-text-primary">{s.name || s.email || "Signatário"}</p>
                              <p className="text-xs text-text-tertiary">{s.role === "CONTRATADA" ? "Lumière" : "Cliente"}</p>
                            </div>
                            {s.signedAt ? (
                              <Badge tone="success" dot>
                                Assinou {when(s.signedAt)}
                              </Badge>
                            ) : s.rejectedAt ? (
                              <Badge tone="error" dot>
                                Recusou
                              </Badge>
                            ) : (
                              <Badge tone="neutral">
                                <CircleDashed size={12} /> {s.viewedAt ? "Visualizou" : "Pendente"}
                              </Badge>
                            )}
                          </li>
                        ))}
                      </ul>
                      <div className="flex flex-wrap gap-2">
                        {proposal.contract.signatureLink && proposal.contract.signatureStatus !== "SIGNED" && (
                          <>
                            <Button
                              variant="secondary"
                              onClick={() => {
                                const url = proposal.contract!.signatureLink!;
                                navigator.clipboard
                                  .writeText(url)
                                  .then(() => flash(true, "Link de assinatura copiado."))
                                  .catch(() => flash(false, `Copie manualmente: ${url}`));
                              }}
                            >
                              <Copy size={15} /> Copiar link do cliente
                            </Button>
                            {contractPhone && (
                              <a
                                href={waLink(contractPhone, contractMsg.replaceAll("{link}", proposal.contract.signatureLink))}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex h-11 items-center gap-2 rounded-full border border-border px-4 text-sm font-medium text-text-primary hover:bg-card-elevated"
                              >
                                <MessageCircle size={15} /> Reenviar no WhatsApp
                              </a>
                            )}
                          </>
                        )}
                        <Button variant="ghost" onClick={refreshSignature} disabled={pending}>
                          <RefreshCw size={15} /> Atualizar status
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </section>
          )}

          {/* Envio */}
          {!proposal.legacy && link && !accepted && (
            <section className={card}>
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-success/12 text-success">
                  <MessageCircle size={18} />
                </span>
                <div>
                  <h2 className="text-[17px] font-semibold tracking-tight text-text-primary">Enviar ao cliente</h2>
                  <p className="text-sm text-text-tertiary">Um clique manda pelo WhatsApp da Lumière. Dá para ajustar a mensagem antes.</p>
                </div>
              </div>
              <div className="flex items-center gap-2 rounded-2xl border border-border bg-card-elevated/40 p-1.5 pl-4">
                <span className="min-w-0 flex-1 select-all truncate text-sm text-text-secondary">{link}</span>
                <button type="button" onClick={copyLink} className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-card px-3 text-sm font-medium text-text-primary hover:bg-card-elevated">
                  {copied ? <Check size={15} className="text-success" /> : <Copy size={15} />} {copied ? "Copiado" : "Copiar"}
                </button>
              </div>
              <Input label="WhatsApp do cliente" value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" placeholder="(00) 00000-0000" />
              <Textarea label="Mensagem" rows={8} value={message} onChange={(e) => setMessage(e.target.value)} />
              <div className="flex flex-wrap gap-2">
                <Button onClick={sendWhatsApp} disabled={pending || !whatsappConnected || !permissions.canEdit}>
                  <Send size={16} /> {pending ? "Enviando…" : proposal.sentAt ? "Reenviar pelo WhatsApp" : "Enviar pelo WhatsApp"}
                </Button>
                <Button variant="secondary" onClick={openWa} disabled={pending}>
                  <ExternalLink size={16} /> Abrir no meu WhatsApp
                </Button>
              </div>
              {!whatsappConnected && (
                <p className="text-xs text-text-tertiary">
                  O WhatsApp da Lumière está desconectado. Use &quot;Abrir no meu WhatsApp&quot; ou reconecte em{" "}
                  <Link href="/configuracoes/integracoes" className="underline underline-offset-2">
                    Integrações
                  </Link>
                  .
                </p>
              )}
            </section>
          )}

          {permissions.canEdit && !accepted && proposal.status !== "RASCUNHO" && (
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const next = proposal.status === "RECUSADA" ? "ENVIADA" : "RECUSADA";
                  if (next === "RECUSADA" && !confirm("Marcar este orçamento como recusado?")) return;
                  const r = await setQuoteStatusAction(proposal.id, next);
                  if (!r.ok) return flash(false, r.error);
                  router.refresh();
                })
              }
              className="w-fit text-sm text-text-tertiary underline-offset-2 hover:text-text-primary hover:underline"
            >
              {proposal.status === "RECUSADA" ? "Reabrir orçamento" : "Cliente recusou por fora? Marcar como recusado"}
            </button>
          )}

          {proposal.notes && (
            <section className={card}>
              <h2 className="text-sm font-semibold text-text-secondary">Anotações internas</h2>
              <p className="whitespace-pre-wrap text-sm text-text-secondary">{proposal.notes}</p>
            </section>
          )}
        </div>

        <aside className="flex flex-col gap-5">
          <section className={card}>
            <h2 className="text-[17px] font-semibold tracking-tight text-text-primary">Andamento</h2>
            <ol className="relative flex flex-col gap-4 border-l border-border pl-5">
              {timeline.map((t) => (
                <li key={t.label} className="relative">
                  <span className={cn("absolute -left-[25px] top-1 h-2.5 w-2.5 rounded-full ring-4 ring-card", t.done ? "bg-success" : "bg-text-tertiary/40")} />
                  <p className={cn("text-sm", t.done ? "text-text-primary" : "text-text-tertiary")}>{t.label}</p>
                  {t.at && <p className="text-xs text-text-tertiary">{when(t.at)}</p>}
                  {t.detail && <p className="text-xs text-text-tertiary">{t.detail}</p>}
                </li>
              ))}
            </ol>
            {proposal.validUntil && <p className="text-xs text-text-tertiary">Válido até {new Date(proposal.validUntil).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}</p>}
          </section>

          {commission && !proposal.legacy && (
            <section className={card}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-[17px] font-semibold tracking-tight text-text-primary">Comissão</h2>
                  {commission.seller && <p className="text-sm text-text-tertiary">{commission.seller}</p>}
                </div>
                <p className="lb-figures text-xl font-semibold tracking-tight text-text-primary">{money(commission.total)}</p>
              </div>
              {commission.lines.length > 0 ? (
                <ul className="flex flex-col gap-2 text-sm">
                  {commission.lines.map((l, idx) => (
                    <li key={idx} className="flex items-start justify-between gap-3">
                      <span className="min-w-0 text-text-secondary">
                        {l.name}
                        <span className="block text-xs text-text-tertiary">
                          {l.rule}
                          {l.base != null ? ` (${money(l.base)})` : ""}
                        </span>
                      </span>
                      <span className="lb-figures shrink-0 text-text-primary">{money(l.amount)}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-text-tertiary">Nenhum item com comissão definida no catálogo.</p>
              )}
              <p className="rounded-2xl bg-card-elevated/60 px-3 py-2.5 text-xs text-text-secondary">
                Paga de uma vez, depois que o pagamento do cliente é confirmado, mesmo que ele parcele no cartão. Base: valor de tabela (Pix).
              </p>
            </section>
          )}

          {!proposal.legacy && (
            <section className={card}>
              <h2 className="text-[17px] font-semibold tracking-tight text-text-primary">Itens</h2>
              <ul className="flex flex-col gap-2 text-sm">
                {proposal.items.map((i) => (
                  <li key={i.id} className="flex items-start justify-between gap-3">
                    <span className="text-text-secondary">
                      {i.quantity > 1 ? `${i.quantity} × ` : ""}
                      {i.name}
                    </span>
                    <span className="lb-figures shrink-0 text-right text-text-primary">
                      {money(i.unitPrice * i.quantity)}
                      {i.billing === "MENSAL" ? "/mês" : ""}
                      {i.monthlyFee ? <span className="block text-xs text-text-tertiary">+ {money(i.monthlyFee * i.quantity)}/mês</span> : null}
                    </span>
                  </li>
                ))}
              </ul>
              <div className="border-t border-border pt-4">
                <QuoteSummary quote={quote} />
              </div>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}
