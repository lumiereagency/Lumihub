import "server-only";
import { db } from "@/lib/db";
import { sendWhatsApp } from "@/lib/integrations/whatsapp";
import { isChannelConnected } from "@/lib/integrations/messaging";
import { isSendingWindow } from "@/lib/billing/reminders";
import { appUrl } from "@/lib/billing/charge";
import { addDays, brasiliaDay, dueDay } from "@/lib/billing/dates";
import { notifyUsers } from "@/lib/notifications/notify";

// ACOMPANHAMENTO AUTOMÁTICO DE ORÇAMENTOS
// Depois que o orçamento sai, a base cuida do "e aí, viu?" por WhatsApp:
//   NAO_ABRIU  1 dia depois do envio, se o cliente ainda não abriu
//   ABRIU      1 dia depois de abrir, se não respondeu
//   TOQUE      3 dias depois do envio, se ainda sem resposta
//   VENCE      2 dias antes de a proposta vencer
// Travas: só orçamentos enviados depois de o recurso ser ligado; para quando o
// cliente responde (aceita/recusa/negocia), o lead fecha ou perde, ou alguém
// pausa; no máximo 1 mensagem por orçamento e por telefone por dia; não manda
// se o vendedor já falou com o lead hoje; segunda a sábado, 9h–18h; sem
// acúmulo (passo que ficou para trás por mais de 1 dia é descartado).

export const FOLLOW_UP_STEPS = ["NAO_ABRIU", "ABRIU", "TOQUE", "VENCE"] as const;
export type FollowUpStep = (typeof FOLLOW_UP_STEPS)[number];

export const FOLLOW_UP_LABELS: Record<FollowUpStep, string> = {
  NAO_ABRIU: "Lembrete: ainda não abriu",
  ABRIU: "Perguntar se ficou alguma dúvida",
  TOQUE: "Novo toque",
  VENCE: "Aviso: proposta vencendo",
};

const MAX_PER_RUN = 10;
const MAX_ATTEMPTS = 3;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface PlanInput {
  sentAt: Date;
  viewedAt: Date | null;
  viewCount: number;
  validUntil: Date | null;
}

// Passos com o dia em que valem (dia de calendário em Brasília) e a condição de abertura.
export function planSteps(p: PlanInput): { step: FollowUpStep; day: string }[] {
  const sent = brasiliaDay(p.sentAt);
  const steps: { step: FollowUpStep; day: string }[] = [];
  if (p.viewCount === 0) steps.push({ step: "NAO_ABRIU", day: addDays(sent, 1) });
  else if (p.viewedAt) steps.push({ step: "ABRIU", day: addDays(brasiliaDay(p.viewedAt), 1) });
  steps.push({ step: "TOQUE", day: addDays(sent, 3) });
  if (p.validUntil) {
    const day = addDays(dueDay(p.validUntil), -2);
    if (day > addDays(sent, 1)) steps.push({ step: "VENCE", day });
  }
  return steps;
}

const PRIORITY: Record<FollowUpStep, number> = { VENCE: 4, TOQUE: 3, ABRIU: 2, NAO_ABRIU: 1 };

export function followUpMessage(step: FollowUpStep, v: { name: string; seller: string; title: string; link: string; validUntil: string | null; company: string }): string {
  const hi = `Oi, ${v.name}! Aqui é ${v.seller}, da ${v.company}.`;
  switch (step) {
    case "NAO_ABRIU":
      return `${hi}\nTe enviei ontem o orçamento "${v.title}" e queria saber se chegou direitinho. Fica aqui o link, caso tenha se perdido na conversa:\n\n${v.link}\n\nQualquer dúvida é só responder por aqui. 😊`;
    case "ABRIU":
      return `${hi}\nVi que você deu uma olhada no orçamento "${v.title}". Ficou alguma dúvida? Posso ajustar o que for preciso para fazer sentido para você.\n\n${v.link}`;
    case "TOQUE":
      return `${hi}\nPassando para saber o que achou do orçamento "${v.title}". Se quiser, a gente conversa rapidinho e eu ajusto a proposta.\n\n${v.link}`;
    case "VENCE":
      return `${hi}\nSó um aviso: a proposta "${v.title}" vale até ${v.validUntil ?? "os próximos dias"}. Se quiser garantir as condições, é só aceitar pelo link. Se precisar de mais prazo, me avisa.\n\n${v.link}`;
  }
}

export interface FollowUpReport {
  sent: number;
  failed: number;
  outsideWindow: boolean;
}

export async function runQuoteFollowUps(organizationId?: string, opts: { ignoreWindow?: boolean } = {}): Promise<FollowUpReport> {
  if (!opts.ignoreWindow && !isSendingWindow()) return { sent: 0, failed: 0, outsideWindow: true };
  const today = brasiliaDay(new Date());
  const yesterday = addDays(today, -1);
  const dayStart = new Date(`${today}T00:00:00-03:00`);

  const settingsRows = await db.pricingSettings.findMany({
    where: { quoteFollowUp: true, ...(organizationId ? { organizationId } : {}) },
    select: { organizationId: true, quoteFollowUpSince: true },
  });
  let sent = 0;
  let failed = 0;
  let first = true;

  for (const st of settingsRows) {
    if (!(await isChannelConnected(st.organizationId, "WHATSAPP"))) continue;
    const proposals = await db.proposal.findMany({
      where: {
        organizationId: st.organizationId,
        status: { in: ["ENVIADA", "EM_NEGOCIACAO"] },
        response: null,
        followUpPaused: false,
        publicToken: { not: null },
        recipientPhone: { not: null },
        sentAt: { gte: st.quoteFollowUpSince },
        AND: [
          { OR: [{ validUntil: null }, { validUntil: { gte: new Date() } }] },
          // Lead fechado ou perdido encerra o acompanhamento (orçamento sem lead segue).
          { OR: [{ leadId: null }, { lead: { is: { stage: { notIn: ["FECHADO", "PERDIDO"] } } } }] },
        ],
      },
      include: {
        followUps: true,
        createdBy: { select: { id: true, name: true } },
        lead: { select: { id: true, lastContactAt: true, ownerUserId: true } },
        organization: { select: { name: true } },
      },
      take: 200,
    });

    const phonesToday = new Set<string>();
    const doneToday = await db.proposalFollowUp.findMany({
      where: { status: "ENVIADO", sentAt: { gte: dayStart }, proposal: { organizationId: st.organizationId } },
      select: { proposalId: true, proposal: { select: { recipientPhone: true } } },
    });
    const proposalsToday = new Set(doneToday.map((d) => d.proposalId));
    for (const d of doneToday) if (d.proposal.recipientPhone) phonesToday.add(d.proposal.recipientPhone.replace(/\D/g, ""));

    for (const p of proposals) {
      if (sent + failed >= MAX_PER_RUN) break;
      if (!p.sentAt || !p.recipientPhone) continue;
      const digits = p.recipientPhone.replace(/\D/g, "");
      if (digits.length < 10) continue;
      if (proposalsToday.has(p.id) || phonesToday.has(digits)) continue;
      // O vendedor já falou com o lead hoje: a base não se mete.
      if (p.lead?.lastContactAt && brasiliaDay(p.lead.lastContactAt) === today) continue;

      const done = new Map(p.followUps.map((f) => [f.step, f]));
      const due = planSteps({ sentAt: p.sentAt, viewedAt: p.viewedAt, viewCount: p.viewCount, validUntil: p.validUntil })
        .filter((s) => s.day <= today && s.day >= yesterday)
        .filter((s) => {
          const f = done.get(s.step);
          return !f || (f.status === "FALHOU" && f.attempts < MAX_ATTEMPTS);
        })
        .sort((a, b) => PRIORITY[b.step] - PRIORITY[a.step])[0];
      if (!due) continue;

      if (!first) await sleep(6000 + Math.floor(Math.random() * 6000));
      first = false;

      const seller = p.createdBy?.name.split(" ")[0] ?? "a equipe";
      const body = followUpMessage(due.step, {
        name: (p.recipientName ?? "").split(" ")[0] || "tudo bem",
        seller,
        title: p.title,
        link: `${appUrl()}/orcamento/${p.publicToken}`,
        validUntil: p.validUntil ? new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo" }).format(p.validUntil) : null,
        company: p.organization.name,
      });
      const result = await sendWhatsApp({ organizationId: st.organizationId, to: digits, message: body });
      const prev = done.get(due.step);
      const ok = result.delivered;
      await db.proposalFollowUp.upsert({
        where: { proposalId_step: { proposalId: p.id, step: due.step } },
        create: { proposalId: p.id, step: due.step, status: ok ? "ENVIADO" : "FALHOU", sentAt: new Date(), messageBody: ok ? body : `${body}\n\n[Falha: ${result.error ?? "sem canal"}]` },
        update: { status: ok ? "ENVIADO" : "FALHOU", attempts: (prev?.attempts ?? 0) + 1, sentAt: new Date(), messageBody: ok ? body : `${body}\n\n[Falha: ${result.error ?? "sem canal"}]` },
      });
      if (ok) {
        sent++;
        phonesToday.add(digits);
        if (p.lead) await db.lead.update({ where: { id: p.lead.id }, data: { lastContactAt: new Date() } });
        const to = p.createdBy?.id ?? p.lead?.ownerUserId;
        if (to) {
          await notifyUsers({
            organizationId: st.organizationId,
            userIds: [to],
            title: "Acompanhamento enviado 📨",
            body: `${FOLLOW_UP_LABELS[due.step]} — ${p.recipientName ?? "cliente"}, "${p.title}".`,
            link: `/propostas/${p.id}`,
            category: "comercial",
            dedupeKey: `quote-follow:${p.id}:${due.step}`,
          });
        }
      } else failed++;
    }

    await notifyCooling(st.organizationId, st.quoteFollowUpSince);
  }
  return { sent, failed, outsideWindow: false };
}

// Orçamento parado há 5 dias sem resposta: avisa o vendedor uma vez.
async function notifyCooling(organizationId: string, since: Date) {
  const limit = new Date(Date.now() - 5 * 24 * 3600_000);
  const cold = await db.proposal.findMany({
    where: { organizationId, status: { in: ["ENVIADA", "EM_NEGOCIACAO"] }, response: null, sentAt: { lte: limit, gte: since } },
    select: { id: true, title: true, recipientName: true, createdByUserId: true, viewCount: true },
    take: 50,
  });
  for (const p of cold) {
    if (!p.createdByUserId) continue;
    await notifyUsers({
      organizationId,
      userIds: [p.createdByUserId],
      title: "Orçamento esfriando 🧊",
      body: `${p.recipientName ?? "O cliente"} ${p.viewCount ? "viu" : "ainda não abriu"} "${p.title}" e não respondeu há 5 dias. Vale uma ligação.`,
      link: `/propostas/${p.id}`,
      category: "comercial",
      dedupeKey: `quote-cold:${p.id}`,
    });
  }
}
