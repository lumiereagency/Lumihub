import "server-only";
import { db } from "@/lib/db";
import { directorIds, notifyUsers } from "@/lib/notifications/notify";
import type { MediaItem } from "@/lib/content/media";
import { getAccessToken, readTokens } from "./accounts";
import { getSocialApp } from "./apps";
import { isSocialNetwork, NETWORK_LABEL } from "./networks";
import { publishFacebook } from "./publishers/facebook";
import { publishInstagram } from "./publishers/instagram";
import { publishLinkedin } from "./publishers/linkedin";
import { publishReddit } from "./publishers/reddit";
import { publishThreads } from "./publishers/threads";
import { publishTiktok } from "./publishers/tiktok";
import { publishTwitter } from "./publishers/twitter";
import { publishYoutube } from "./publishers/youtube";
import { PublishError, type PublishInput, type PublishResult } from "./publishers/types";

const MAX_ATTEMPTS = 3;
const STUCK_MINUTES = 30;
const PER_RUN = 6;

// Conta de teste: só existe com SOCIAL_SIMULATE=1 e nunca fala com a rede.
export function simulationEnabled(): boolean {
  return process.env.SOCIAL_SIMULATE === "1";
}

async function simulated(i: PublishInput): Promise<PublishResult> {
  if (!simulationEnabled()) throw new PublishError("Conta de teste desativada neste servidor.", true);
  if (/FALHAR/i.test(i.caption)) throw new PublishError("Falha simulada pedida na legenda.", true);
  return { externalId: `sim-${i.targetId}`, externalUrl: `https://example.com/simulado/${i.targetId}` };
}

async function dispatch(i: PublishInput): Promise<PublishResult> {
  if (i.account.externalId.startsWith("sim_")) return simulated(i);
  switch (i.account.network) {
    case "FACEBOOK":
      return publishFacebook(i);
    case "INSTAGRAM":
      return publishInstagram(i);
    case "YOUTUBE":
      return publishYoutube(i);
    case "TIKTOK":
      return publishTiktok(i);
    case "TWITTER":
      return publishTwitter(i);
    case "THREADS":
      return publishThreads(i);
    case "LINKEDIN":
      return publishLinkedin(i);
    case "REDDIT":
      return publishReddit(i);
    default:
      throw new PublishError("Rede sem publicação automática.", true);
  }
}

// Recalcula o estado do post a partir dos destinos.
export async function syncPostStatus(postId: string): Promise<void> {
  const targets = await db.contentPostTarget.findMany({ where: { postId, status: { not: "CANCELADO" } }, select: { status: true, publishedAt: true } });
  const post = await db.contentPost.findUnique({ where: { id: postId }, select: { status: true } });
  if (!post || ["RASCUNHO", "AGUARDANDO", "AJUSTE"].includes(post.status)) return;
  if (targets.length === 0) {
    if (post.status === "AGENDADO" || post.status === "FALHOU") await db.contentPost.update({ where: { id: postId }, data: { status: "APROVADO" } });
    return;
  }
  const open = targets.some((t) => t.status === "AGENDADO" || t.status === "PUBLICANDO");
  const failed = targets.some((t) => t.status === "FALHOU");
  const allDone = targets.every((t) => t.status === "PUBLICADO");
  if (allDone) await db.contentPost.update({ where: { id: postId }, data: { status: "PUBLICADO", publishedAt: new Date() } });
  else if (open) await db.contentPost.update({ where: { id: postId }, data: { status: "AGENDADO" } });
  else if (failed) await db.contentPost.update({ where: { id: postId }, data: { status: "FALHOU" } });
}

async function notifyResult(targetId: string, ok: boolean, detail: string) {
  const target = await db.contentPostTarget.findUnique({
    where: { id: targetId },
    include: { account: { select: { name: true, network: true, client: { select: { companyName: true } } } }, post: { select: { id: true, title: true, batchId: true, createdByUserId: true } } },
  });
  if (!target) return;
  const net = isSocialNetwork(target.account.network) ? NETWORK_LABEL[target.account.network] : target.account.network;
  const people = [target.post.createdByUserId, target.createdByUserId];
  const link = `/conteudo/${target.post.batchId}`;
  if (ok) {
    await notifyUsers({ organizationId: target.organizationId, userIds: people.filter((x): x is string => !!x), title: "Post publicado ✓", body: `“${target.post.title}” foi ao ar no ${net} de ${target.account.client.companyName}.`, link, category: "operacao", dedupeKey: `social-ok:${targetId}` });
  } else {
    const dirs = await directorIds(target.organizationId);
    await notifyUsers({ organizationId: target.organizationId, userIds: [...dirs, ...people.filter((x): x is string => !!x)], title: "Falha ao publicar", body: `“${target.post.title}” não saiu no ${net} de ${target.account.client.companyName}: ${detail}`, link, category: "alertas", dedupeKey: `social-fail:${targetId}:${target.attempts}` });
  }
}

export async function publishTarget(targetId: string): Promise<{ ok: boolean; error?: string }> {
  // Reserva o destino: se outro processo já pegou, não duplica a publicação.
  const claimed = await db.contentPostTarget.updateMany({ where: { id: targetId, status: "AGENDADO" }, data: { status: "PUBLICANDO", attempts: { increment: 1 } } });
  if (claimed.count === 0) return { ok: false, error: "Este destino não está pronto para publicar." };

  const target = await db.contentPostTarget.findUniqueOrThrow({
    where: { id: targetId },
    include: { account: true, post: { include: { batch: { select: { publicToken: true } } } } },
  });
  try {
    if (target.account.status !== "ATIVA") throw new PublishError("A conta do cliente precisa ser reconectada.", true);
    const media = (target.post.media as unknown as MediaItem[]) ?? [];
    const options = (target.options as { format?: string; subreddit?: string } | null) ?? {};
    const app = target.network === "TIKTOK" ? await getSocialApp(target.organizationId, "tiktok") : null;
    const redditApp = target.network === "REDDIT" ? await getSocialApp(target.organizationId, "reddit") : null;
    const accessToken = target.account.externalId.startsWith("sim_") ? "sim" : await getAccessToken(target.account);
    const result = await dispatch({
      targetId,
      postId: target.postId,
      batchToken: target.post.batch.publicToken,
      account: target.account,
      accessToken,
      title: target.post.title,
      caption: target.caption?.trim() ? target.caption : (target.post.caption ?? ""),
      format: options.format ?? target.post.format,
      media,
      tiktokAudited: !!app?.audited,
      subreddit: options.subreddit ?? null,
      redditAgent: redditApp ? `web:lumibase:1.0 (by /u/${redditApp.redditUser})` : null,
    });
    await db.contentPostTarget.update({ where: { id: targetId }, data: { status: "PUBLICADO", externalId: result.externalId, externalUrl: result.externalUrl, publishedAt: new Date(), lastError: null, nextAttemptAt: null } });
    await db.contentPostEvent.create({ data: { postId: target.postId, kind: "PUBLICADO", actor: "Lumibase", note: `Publicado no ${NETWORK_LABEL[target.account.network as keyof typeof NETWORK_LABEL] ?? target.account.network}${result.externalUrl ? `: ${result.externalUrl}` : ""}` } });
    await syncPostStatus(target.postId);
    await notifyResult(targetId, true, "");
    return { ok: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erro desconhecido.";
    const permanent = e instanceof PublishError && e.permanent;
    const final = permanent || target.attempts >= MAX_ATTEMPTS;
    await db.contentPostTarget.update({
      where: { id: targetId },
      data: final ? { status: "FALHOU", lastError: message, nextAttemptAt: null } : { status: "AGENDADO", lastError: message, nextAttemptAt: new Date(Date.now() + target.attempts * 10 * 60_000) },
    });
    if (final) {
      await db.contentPostEvent.create({ data: { postId: target.postId, kind: "FALHA", actor: "Lumibase", note: message } });
      await syncPostStatus(target.postId);
      await notifyResult(targetId, false, message);
    }
    return { ok: false, error: message };
  }
}

let running = false;

// Publica o que já está na hora. Roda em segundo plano (vídeo grande leva minutos).
export async function runDuePublications(): Promise<{ started: boolean; due: number }> {
  if (running) return { started: false, due: 0 };
  running = true;
  try {
    // Publicação interrompida no meio (reinício do servidor): não repete, para não duplicar.
    const stuck = await db.contentPostTarget.findMany({ where: { status: "PUBLICANDO", updatedAt: { lt: new Date(Date.now() - STUCK_MINUTES * 60_000) } }, select: { id: true, postId: true } });
    for (const s of stuck) {
      await db.contentPostTarget.update({ where: { id: s.id }, data: { status: "FALHOU", lastError: "Interrompido no meio do envio. Confira na rede antes de tentar de novo, para não duplicar." } });
      await syncPostStatus(s.postId);
      await notifyResult(s.id, false, "Interrompido no meio do envio. Confira na rede antes de tentar de novo.");
    }
    const now = new Date();
    const due = await db.contentPostTarget.findMany({
      where: { status: "AGENDADO", scheduledFor: { lte: now }, OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }] },
      orderBy: { scheduledFor: "asc" },
      take: PER_RUN,
      select: { id: true },
    });
    void (async () => {
      try {
        for (const t of due) await publishTarget(t.id);
      } catch (e) {
        console.error("[social] publicação falhou", (e as Error).message);
      } finally {
        running = false;
      }
    })();
    if (due.length === 0) running = false;
    return { started: due.length > 0, due: due.length };
  } catch (e) {
    running = false;
    throw e;
  }
}

// Contas que vão vencer ou já venceram: renova o que a rede deixa e avisa a equipe do resto.
export async function checkAccountHealth(): Promise<{ renewed: number; warned: number }> {
  let renewed = 0;
  let warned = 0;
  const soon = new Date(Date.now() + 20 * 86400_000);
  const threads = await db.socialAccount.findMany({ where: { network: "THREADS", status: "ATIVA", expiresAt: { lt: soon } } });
  for (const a of threads) {
    try {
      await getAccessToken(a);
      renewed++;
    } catch {
      // getAccessToken já marcou a conta como expirada.
    }
  }
  const week = new Date(Date.now() + 7 * 86400_000);
  const watch = await db.socialAccount.findMany({
    where: { OR: [{ status: "EXPIRADA" }, { network: "LINKEDIN", status: "ATIVA", expiresAt: { lt: week } }] },
    include: { client: { select: { companyName: true } } },
  });
  for (const a of watch) {
    // LinkedIn sem renovação automática: avisa antes de vencer.
    if (a.status === "ATIVA") {
      if (readTokens(a).refreshToken) continue;
    }
    const net = isSocialNetwork(a.network) ? NETWORK_LABEL[a.network] : a.network;
    const day = (a.expiresAt ?? a.updatedAt).toISOString().slice(0, 10);
    const dirs = await directorIds(a.organizationId);
    const made = await notifyUsers({
      organizationId: a.organizationId,
      userIds: [...dirs, a.connectedByUserId].filter((x): x is string => !!x),
      title: a.status === "EXPIRADA" ? "Conta social precisa reconectar" : "Conta social vai vencer",
      body: `${net} de ${a.client.companyName} (${a.name}): ${a.status === "EXPIRADA" ? "a conexão venceu" : "a conexão vence em breve"}. Reconecte para não perder as publicações agendadas.`,
      link: `/clientes/${a.clientId}/redes`,
      category: "alertas",
      dedupeKey: `social-health:${a.id}:${a.status}:${day}`,
    });
    warned += made.length > 0 ? 1 : 0;
  }
  return { renewed, warned };
}
