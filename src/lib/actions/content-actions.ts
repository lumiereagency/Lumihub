"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth/guard";
import { permKey } from "@/lib/auth/permissions";
import { audit } from "@/lib/audit";
import { sendWhatsApp } from "@/lib/integrations/whatsapp";
import { deleteLocalFile } from "@/lib/storage/local";
import { appUrl } from "@/lib/billing/charge";
import { FORMATS, NETWORKS, parseVideoLink, type MediaItem } from "@/lib/content/media";
import { saveContentImage } from "@/lib/content/images";

// Calendário de conteúdo: quem tem o Workspace trabalha aqui.
const VIEW = permKey("TASKS", "VIEW");
const CREATE = permKey("TASKS", "CREATE");
const EDIT = permKey("TASKS", "EDIT");
const DELETE = permKey("TASKS", "DELETE");

type Res = { ok: boolean; error?: string };

function revalidate(batchId?: string) {
  revalidatePath("/conteudo");
  if (batchId) revalidatePath(`/conteudo/${batchId}`);
}

export async function createBatchAction(clientId: string, name: string): Promise<Res & { id?: string }> {
  const user = await requirePermission(CREATE);
  const clean = String(name ?? "").trim().slice(0, 80);
  if (clean.length < 2) return { ok: false, error: "Dê um nome ao lote (ex.: Novembro 2026)." };
  const client = await db.client.findFirst({ where: { id: clientId, organizationId: user.organizationId, deletedAt: null }, select: { id: true } });
  if (!client) return { ok: false, error: "Cliente não encontrado." };
  const batch = await db.contentBatch.create({
    data: { organizationId: user.organizationId, clientId, name: clean, publicToken: randomBytes(18).toString("base64url"), createdByUserId: user.id },
  });
  await audit({ organizationId: user.organizationId, userId: user.id, action: "CONTENT_BATCH_CREATED", entityType: "ContentBatch", entityId: batch.id });
  revalidate();
  return { ok: true, id: batch.id };
}

export async function deleteBatchAction(batchId: string): Promise<Res> {
  const user = await requirePermission(DELETE);
  const batch = await db.contentBatch.findFirst({ where: { id: batchId, organizationId: user.organizationId }, include: { posts: true } });
  if (!batch) return { ok: false, error: "Lote não encontrado." };
  for (const p of batch.posts) await removeImages(user.organizationId, p.media);
  await db.contentBatch.delete({ where: { id: batchId } });
  revalidate();
  return { ok: true };
}

async function removeImages(organizationId: string, media: unknown) {
  for (const m of (media as MediaItem[]) ?? []) if (m.storageKey) await deleteLocalFile(organizationId, m.storageKey).catch(() => {});
}

const postSchema = z.object({
  title: z.string().trim().min(2, "Dê um título ao post.").max(120),
  caption: z.string().trim().max(2200).optional(),
  network: z.enum(NETWORKS),
  format: z.enum(FORMATS),
  scheduledFor: z.string().optional(),
});

// Cria ou edita um post. Mídia: links de vídeo (um por linha) e imagens enviadas.
export async function savePostAction(batchId: string, postId: string | null, formData: FormData): Promise<Res> {
  const user = await requirePermission(postId ? EDIT : CREATE);
  const batch = await db.contentBatch.findFirst({ where: { id: batchId, organizationId: user.organizationId } });
  if (!batch) return { ok: false, error: "Lote não encontrado." };
  const parsed = postSchema.safeParse({
    title: formData.get("title"),
    caption: formData.get("caption") || undefined,
    network: formData.get("network"),
    format: formData.get("format"),
    scheduledFor: formData.get("scheduledFor") || undefined,
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Confira os dados." };
  const v = parsed.data;

  const existing = postId ? await db.contentPost.findFirst({ where: { id: postId, batchId, organizationId: user.organizationId } }) : null;
  if (postId && !existing) return { ok: false, error: "Post não encontrado." };

  // Mídia: imagens que ficam + vídeos por link + imagens novas.
  const keepKeys = new Set(JSON.parse(String(formData.get("keepImages") ?? "[]")) as string[]);
  const oldMedia = ((existing?.media as unknown as MediaItem[]) ?? []);
  const media: MediaItem[] = oldMedia.filter((m) => m.kind === "image" && m.storageKey && keepKeys.has(m.storageKey));
  for (const m of oldMedia) if (m.kind === "image" && m.storageKey && !keepKeys.has(m.storageKey)) await deleteLocalFile(user.organizationId, m.storageKey).catch(() => {});
  for (const line of String(formData.get("videoLinks") ?? "").split(/\s+/).filter(Boolean)) {
    const item = parseVideoLink(line);
    if (!item) return { ok: false, error: `Não entendi este link de vídeo: ${line.slice(0, 60)}. Use Drive, YouTube ou Vimeo.` };
    media.push(item);
  }
  for (const f of formData.getAll("images")) {
    if (!(f instanceof File) || f.size === 0) continue;
    if (media.filter((m) => m.kind === "image").length >= 10) return { ok: false, error: "No máximo 10 imagens por post." };
    const saved = await saveContentImage(user.organizationId, f);
    if ("error" in saved) return { ok: false, error: saved.error };
    media.push({ kind: "image", url: "", storageKey: saved.storageKey });
  }
  if (media.length === 0) return { ok: false, error: "Adicione ao menos uma imagem ou um link de vídeo." };

  const scheduledFor = v.scheduledFor ? new Date(`${v.scheduledFor}:00-03:00`) : null;
  if (scheduledFor && Number.isNaN(scheduledFor.getTime())) return { ok: false, error: "Data inválida." };
  const data = { title: v.title, caption: v.caption ?? null, network: v.network, format: v.format, scheduledFor, media: media as unknown as object };

  if (!existing) {
    const position = await db.contentPost.count({ where: { batchId } });
    const post = await db.contentPost.create({ data: { ...data, batchId, organizationId: user.organizationId, createdByUserId: user.id, position, events: { create: { kind: "CRIADO", actor: user.name } } } });
    // Lote já enviado: o post novo já nasce aguardando o cliente.
    if (batch.sentAt) await db.contentPost.update({ where: { id: post.id }, data: { status: "AGUARDANDO" } });
  } else {
    // Editou um post que o cliente já viu (ajuste pedido ou aprovado): volta para aprovação.
    const reopen = batch.sentAt && ["AJUSTE", "APROVADO"].includes(existing.status);
    await db.contentPost.update({
      where: { id: existing.id },
      data: { ...data, ...(reopen ? { status: "AGUARDANDO", version: { increment: 1 }, approvedAt: null } : {}), ...(reopen ? { events: { create: { kind: "REVISADO", actor: user.name, note: `Versão ${existing.version + 1} enviada para aprovação` } } } : {}) },
    });
  }
  revalidate(batchId);
  return { ok: true };
}

export async function deletePostAction(postId: string): Promise<Res> {
  const user = await requirePermission(DELETE);
  const post = await db.contentPost.findFirst({ where: { id: postId, organizationId: user.organizationId } });
  if (!post) return { ok: false, error: "Post não encontrado." };
  await removeImages(user.organizationId, post.media);
  await db.contentPost.delete({ where: { id: postId } });
  revalidate(post.batchId);
  return { ok: true };
}

export async function markPublishedAction(postId: string, published: boolean): Promise<Res> {
  const user = await requirePermission(EDIT);
  const post = await db.contentPost.findFirst({ where: { id: postId, organizationId: user.organizationId } });
  if (!post) return { ok: false, error: "Post não encontrado." };
  if (published && post.status !== "APROVADO") return { ok: false, error: "Só posts aprovados podem ser marcados como publicados." };
  await db.contentPost.update({
    where: { id: postId },
    data: { status: published ? "PUBLICADO" : "APROVADO", publishedAt: published ? new Date() : null, events: { create: { kind: published ? "PUBLICADO" : "APROVADO", actor: user.name, note: published ? "Marcado como publicado" : "Publicação desfeita" } } },
  });
  revalidate(post.batchId);
  return { ok: true };
}

function batchMessage(clientName: string, batchName: string, link: string, seller: string): string {
  return `Oi, ${clientName}! Aqui é ${seller}, da Lumière.\nO conteúdo de ${batchName} está pronto para a sua aprovação. É só abrir o link, ver cada post e tocar em aprovar (ou pedir algum ajuste):\n\n${link}\n\nQualquer dúvida, é só responder por aqui. 😊`;
}

// Prévia da mensagem de envio ao cliente.
export async function previewBatchSendAction(batchId: string): Promise<Res & { link?: string; message?: string; phone?: string | null }> {
  const user = await requirePermission(VIEW);
  const batch = await db.contentBatch.findFirst({ where: { id: batchId, organizationId: user.organizationId }, include: { client: { select: { contactName: true, companyName: true, phone: true } } } });
  if (!batch) return { ok: false, error: "Lote não encontrado." };
  const link = `${appUrl()}/aprovacao/${batch.publicToken}`;
  const name = (batch.client.contactName || batch.client.companyName).split(" ")[0];
  return { ok: true, link, phone: batch.client.phone, message: batchMessage(name, batch.name, link, user.name.split(" ")[0]) };
}

async function markSent(batchId: string, organizationId: string, actor: string) {
  const posts = await db.contentPost.findMany({ where: { batchId, organizationId, status: "RASCUNHO" }, select: { id: true } });
  await db.$transaction([
    db.contentBatch.update({ where: { id: batchId }, data: { sentAt: new Date() } }),
    db.contentPost.updateMany({ where: { id: { in: posts.map((p) => p.id) } }, data: { status: "AGUARDANDO" } }),
    db.contentPostEvent.createMany({ data: posts.map((p) => ({ postId: p.id, kind: "ENVIADO", actor })) }),
  ]);
}

export async function sendBatchWhatsAppAction(batchId: string, phone: string, message: string): Promise<Res> {
  const user = await requirePermission(EDIT);
  const batch = await db.contentBatch.findFirst({ where: { id: batchId, organizationId: user.organizationId } });
  if (!batch) return { ok: false, error: "Lote não encontrado." };
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 10) return { ok: false, error: "Informe o WhatsApp do cliente com DDD." };
  if (!message.includes(batch.publicToken)) return { ok: false, error: "A mensagem precisa conter o link de aprovação." };
  const res = await sendWhatsApp({ organizationId: user.organizationId, to: digits, message: message.trim() });
  if (!res.delivered) return { ok: false, error: res.error ?? "O WhatsApp não confirmou o envio. Tente de novo em instantes, ou copie o link." };
  await markSent(batchId, user.organizationId, user.name);
  revalidate(batchId);
  return { ok: true };
}

// Copiou o link e mandou por conta própria.
export async function markBatchSentAction(batchId: string): Promise<Res> {
  const user = await requirePermission(EDIT);
  const batch = await db.contentBatch.findFirst({ where: { id: batchId, organizationId: user.organizationId } });
  if (!batch) return { ok: false, error: "Lote não encontrado." };
  await markSent(batchId, user.organizationId, user.name);
  revalidate(batchId);
  return { ok: true };
}
