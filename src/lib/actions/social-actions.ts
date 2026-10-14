"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth/guard";
import { permKey } from "@/lib/auth/permissions";
import { audit } from "@/lib/audit";
import { decryptSecret, encryptSecret } from "@/lib/integrations/vault";
import type { MediaItem } from "@/lib/content/media";
import { sealTokens } from "@/lib/social/accounts";
import { getSocialApp } from "@/lib/social/apps";
import { hasBlockingError, runChecks, type MediaProbe } from "@/lib/social/checks";
import type { Candidate } from "@/lib/social/connect";
import { driveFileId, probeDriveVideo } from "@/lib/social/drive";
import { defaultTargetFormat, isSocialNetwork, NETWORK_LABEL, type SocialNetwork } from "@/lib/social/networks";
import { runDuePublications, simulationEnabled, syncPostStatus } from "@/lib/social/publish";
import { toBrtLocalInput } from "@/lib/social/time";
import { readLocalFile } from "@/lib/storage/local";

const EDIT = permKey("TASKS", "EDIT");

type Res = { ok: boolean; error?: string };

function refresh(clientId?: string, batchId?: string) {
  if (clientId) revalidatePath(`/clientes/${clientId}/redes`);
  if (batchId) revalidatePath(`/conteudo/${batchId}`);
}

// ───────── Contas conectadas ─────────

export async function saveConnectedAccountsAction(sessionId: string, keys: string[]): Promise<Res> {
  const user = await requirePermission(EDIT);
  const session = await db.socialConnectSession.findFirst({ where: { id: sessionId, organizationId: user.organizationId, userId: user.id, expiresAt: { gt: new Date() } } });
  if (!session) return { ok: false, error: "A escolha expirou. Conecte a rede de novo." };
  const candidates = JSON.parse(decryptSecret({ encryptedValue: session.payloadEnc, iv: session.payloadIv, authTag: session.payloadTag })) as Candidate[];
  const chosen = candidates.filter((c) => keys.includes(c.key));
  if (chosen.length === 0) return { ok: false, error: "Marque ao menos uma conta." };
  for (const c of chosen) {
    const sealed = sealTokens(c.tokens);
    const data = {
      name: c.name,
      avatarUrl: c.avatarUrl,
      status: "ATIVA",
      statusMessage: null,
      tokenEnc: sealed.encryptedValue,
      tokenIv: sealed.iv,
      tokenTag: sealed.authTag,
      meta: c.meta,
      expiresAt: c.tokens.accessExpiresAt ? new Date(c.tokens.accessExpiresAt) : null,
      connectedByUserId: user.id,
    };
    await db.socialAccount.upsert({
      where: { clientId_network_externalId: { clientId: session.clientId, network: c.network, externalId: c.externalId } },
      create: { ...data, organizationId: user.organizationId, clientId: session.clientId, network: c.network, externalId: c.externalId },
      update: data,
    });
  }
  await db.socialConnectSession.delete({ where: { id: session.id } });
  await audit({ organizationId: user.organizationId, userId: user.id, action: "SOCIAL_ACCOUNT_CONNECTED", entityType: "Client", entityId: session.clientId, metadata: { accounts: chosen.map((c) => `${c.network}:${c.name}`) } });
  refresh(session.clientId);
  return { ok: true };
}

export async function disconnectAccountAction(accountId: string): Promise<Res> {
  const user = await requirePermission(EDIT);
  const account = await db.socialAccount.findFirst({ where: { id: accountId, organizationId: user.organizationId } });
  if (!account) return { ok: false, error: "Conta não encontrada." };
  const affected = await db.contentPostTarget.findMany({ where: { accountId, status: { in: ["AGENDADO", "FALHOU"] } }, select: { postId: true } });
  await db.contentPostTarget.updateMany({ where: { accountId, status: { in: ["AGENDADO", "FALHOU"] } }, data: { status: "CANCELADO" } });
  for (const t of affected) await syncPostStatus(t.postId);
  await db.socialAccount.delete({ where: { id: accountId } });
  await audit({ organizationId: user.organizationId, userId: user.id, action: "SOCIAL_ACCOUNT_DISCONNECTED", entityType: "Client", entityId: account.clientId, metadata: { network: account.network, name: account.name } });
  refresh(account.clientId);
  return { ok: true };
}

// Conta de teste (só com SOCIAL_SIMULATE=1): serve para treinar o fluxo sem falar com a rede.
export async function connectSimulatedAccountAction(clientId: string, network: string): Promise<Res> {
  const user = await requirePermission(EDIT);
  if (!simulationEnabled()) return { ok: false, error: "Contas de teste estão desativadas neste servidor." };
  if (!isSocialNetwork(network)) return { ok: false, error: "Rede inválida." };
  const client = await db.client.findFirst({ where: { id: clientId, organizationId: user.organizationId }, select: { id: true } });
  if (!client) return { ok: false, error: "Cliente não encontrado." };
  const sealed = encryptSecret(JSON.stringify({ accessToken: "sim" }));
  await db.socialAccount.upsert({
    where: { clientId_network_externalId: { clientId, network, externalId: `sim_${network.toLowerCase()}` } },
    create: { organizationId: user.organizationId, clientId, network, externalId: `sim_${network.toLowerCase()}`, name: `Conta de teste (${NETWORK_LABEL[network]})`, tokenEnc: sealed.encryptedValue, tokenIv: sealed.iv, tokenTag: sealed.authTag, connectedByUserId: user.id },
    update: { status: "ATIVA", statusMessage: null },
  });
  refresh(clientId);
  return { ok: true };
}

// ───────── Leitura dos arquivos do post (duração, proporção, tamanho) ─────────

async function probeItem(organizationId: string, item: MediaItem): Promise<MediaProbe> {
  if (item.kind === "image") {
    if (!item.storageKey) return { kind: "image", unreadable: "Imagem sem arquivo." };
    try {
      const buf = await readLocalFile(organizationId, item.storageKey);
      const sharp = (await import("sharp")).default;
      const meta = await sharp(buf).metadata();
      return { kind: "image", width: meta.width ?? null, height: meta.height ?? null, sizeBytes: buf.length };
    } catch {
      return { kind: "image", unreadable: "Não consegui ler a imagem." };
    }
  }
  const id = item.provider === "drive" ? driveFileId(item.url) : null;
  if (!id) return { kind: "video", unsupportedLink: true };
  return probeDriveVideo(id);
}

export async function probePostAction(postId: string): Promise<{ ok: boolean; error?: string; probes?: MediaProbe[] }> {
  const user = await requirePermission(permKey("TASKS", "VIEW"));
  const post = await db.contentPost.findFirst({ where: { id: postId, organizationId: user.organizationId }, select: { media: true } });
  if (!post) return { ok: false, error: "Post não encontrado." };
  const media = (post.media as unknown as MediaItem[]) ?? [];
  const probes = await Promise.all(media.map((m) => probeItem(user.organizationId, m)));
  return { ok: true, probes };
}

// ───────── Agendamento ─────────

export interface ScheduleItem {
  accountId: string;
  caption?: string;
  format?: string;
  subreddit?: string;
}

export async function scheduleTargetsAction(postId: string, items: ScheduleItem[], scheduledLocal: string): Promise<Res> {
  const user = await requirePermission(EDIT);
  const post = await db.contentPost.findFirst({ where: { id: postId, organizationId: user.organizationId }, include: { batch: { select: { id: true, clientId: true } } } });
  if (!post) return { ok: false, error: "Post não encontrado." };
  if (!["APROVADO", "AGENDADO", "FALHOU", "PUBLICADO"].includes(post.status)) return { ok: false, error: "O cliente ainda precisa aprovar este post." };
  const when = new Date(`${scheduledLocal}:00-03:00`);
  if (Number.isNaN(when.getTime())) return { ok: false, error: "Escolha a data e o horário." };
  if (items.length === 0) return { ok: false, error: "Escolha ao menos uma rede." };

  const accounts = await db.socialAccount.findMany({ where: { id: { in: items.map((i) => i.accountId) }, clientId: post.batch.clientId, organizationId: user.organizationId } });
  if (accounts.length !== new Set(items.map((i) => i.accountId)).size) return { ok: false, error: "Alguma conta não pertence a este cliente." };

  const media = (post.media as unknown as MediaItem[]) ?? [];
  const probes = await Promise.all(media.map((m) => probeItem(user.organizationId, m)));
  const hasVideo = media.some((m) => m.kind === "video");
  const tiktokApp = accounts.some((a) => a.network === "TIKTOK") ? await getSocialApp(user.organizationId, "tiktok") : null;
  const problems: string[] = [];
  for (const item of items) {
    const account = accounts.find((a) => a.id === item.accountId)!;
    if (!isSocialNetwork(account.network)) continue;
    const format = item.format || defaultTargetFormat(account.network, post.format, hasVideo);
    const checks = runChecks({ network: account.network, format, title: post.title, caption: item.caption?.trim() || post.caption || "", media: probes, account: { status: account.status, statusMessage: account.statusMessage }, scheduledFor: when, tiktokPublic: tiktokApp ? tiktokApp.audited : undefined, subreddit: item.subreddit });
    if (hasBlockingError(checks)) problems.push(`${NETWORK_LABEL[account.network]}: ${checks.find((c) => c.level === "error")?.title}`);
  }
  if (problems.length) return { ok: false, error: `Resolva antes de agendar — ${problems.join("; ")}.` };

  const keep = new Set<string>();
  for (const item of items) {
    const account = accounts.find((a) => a.id === item.accountId)!;
    const format = item.format || defaultTargetFormat(account.network as SocialNetwork, post.format, hasVideo);
    keep.add(account.id);
    const data = { network: account.network, caption: item.caption?.trim() || null, options: { format, ...(item.subreddit ? { subreddit: item.subreddit } : {}) }, scheduledFor: when, status: "AGENDADO", attempts: 0, nextAttemptAt: null, lastError: null, externalId: null, externalUrl: null, publishedAt: null, createdByUserId: user.id };
    const existing = await db.contentPostTarget.findUnique({ where: { postId_accountId: { postId, accountId: account.id } } });
    // Quem já foi publicado não é republicado por engano.
    if (existing?.status === "PUBLICADO" || existing?.status === "PUBLICANDO") continue;
    await db.contentPostTarget.upsert({ where: { postId_accountId: { postId, accountId: account.id } }, create: { ...data, postId, organizationId: user.organizationId, accountId: account.id }, update: data });
  }
  await db.contentPostTarget.updateMany({ where: { postId, accountId: { notIn: [...keep] }, status: { in: ["AGENDADO", "FALHOU"] } }, data: { status: "CANCELADO" } });
  await db.contentPost.update({ where: { id: postId }, data: { scheduledFor: when, status: "AGENDADO" } });
  await db.contentPostEvent.create({ data: { postId, kind: "AGENDADO", actor: user.name, note: `Agendado em ${accounts.map((a) => NETWORK_LABEL[a.network as SocialNetwork] ?? a.network).join(", ")}` } });
  await syncPostStatus(postId);
  refresh(undefined, post.batchId);
  // Horário que já passou: não espera a próxima rodada do cron.
  if (when.getTime() <= Date.now()) await runDuePublications().catch(() => {});
  return { ok: true };
}

export async function scheduleAllAction(batchId: string): Promise<Res & { scheduled?: number; skipped?: string[] }> {
  const user = await requirePermission(EDIT);
  const batch = await db.contentBatch.findFirst({ where: { id: batchId, organizationId: user.organizationId }, include: { posts: { where: { status: "APROVADO" }, include: { targets: true } } } });
  if (!batch) return { ok: false, error: "Lote não encontrado." };
  const accounts = await db.socialAccount.findMany({ where: { clientId: batch.clientId, organizationId: user.organizationId, status: "ATIVA" } });
  let scheduled = 0;
  const skipped: string[] = [];
  for (const post of batch.posts) {
    if (!post.scheduledFor) { skipped.push(`“${post.title}”: sem data prevista`); continue; }
    const mine = accounts.filter((a) => a.network === post.network);
    if (mine.length === 0) { skipped.push(`“${post.title}”: nenhuma conta de ${isSocialNetwork(post.network) ? NETWORK_LABEL[post.network] : post.network} conectada`); continue; }
    const local = toBrtLocalInput(post.scheduledFor);
    const r = await scheduleTargetsAction(post.id, mine.map((a) => ({ accountId: a.id })), local);
    if (r.ok) scheduled++;
    else skipped.push(`“${post.title}”: ${r.error?.replace("Resolva antes de agendar — ", "")}`);
  }
  refresh(undefined, batchId);
  return { ok: true, scheduled, skipped };
}

export async function cancelScheduleAction(postId: string): Promise<Res> {
  const user = await requirePermission(EDIT);
  const post = await db.contentPost.findFirst({ where: { id: postId, organizationId: user.organizationId } });
  if (!post) return { ok: false, error: "Post não encontrado." };
  await db.contentPostTarget.updateMany({ where: { postId, status: { in: ["AGENDADO", "FALHOU"] } }, data: { status: "CANCELADO" } });
  await db.contentPostEvent.create({ data: { postId, kind: "AGENDAMENTO_CANCELADO", actor: user.name } });
  await syncPostStatus(postId);
  refresh(undefined, post.batchId);
  return { ok: true };
}

export async function retryTargetAction(targetId: string): Promise<Res> {
  const user = await requirePermission(EDIT);
  const target = await db.contentPostTarget.findFirst({ where: { id: targetId, organizationId: user.organizationId, status: "FALHOU" }, include: { post: { select: { batchId: true } } } });
  if (!target) return { ok: false, error: "Este destino não está com falha." };
  await db.contentPostTarget.update({ where: { id: targetId }, data: { status: "AGENDADO", attempts: 0, nextAttemptAt: null, scheduledFor: new Date(), lastError: null } });
  await syncPostStatus(target.postId);
  refresh(undefined, target.post.batchId);
  await runDuePublications().catch(() => {});
  return { ok: true };
}
