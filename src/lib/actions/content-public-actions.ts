"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { notifyUsers } from "@/lib/notifications/notify";
import { directorIds } from "@/lib/notifications/notify";

// Página pública /aprovacao/<token>: o token aleatório do lote é a credencial.
// O cliente só mexe nos posts do próprio lote, e só nos que aguardam resposta.

async function load(token: string, postId: string) {
  if (typeof token !== "string" || token.length < 16 || token.length > 64) return null;
  const post = await db.contentPost.findFirst({
    where: { id: postId, batch: { publicToken: token } },
    include: { batch: { include: { client: { select: { companyName: true } } } } },
  });
  return post;
}

async function tell(post: NonNullable<Awaited<ReturnType<typeof load>>>, title: string, body: string) {
  const ids = new Set<string>([...(await directorIds(post.organizationId))]);
  for (const id of [post.createdByUserId, post.batch.createdByUserId]) if (id) ids.add(id);
  await notifyUsers({ organizationId: post.organizationId, userIds: [...ids], title, body, link: `/conteudo/${post.batchId}`, category: "tarefas" });
}

export async function approvePostAction(token: string, postId: string): Promise<{ ok: boolean; error?: string }> {
  const post = await load(token, postId);
  if (!post) return { ok: false, error: "Link inválido." };
  if (["APROVADO", "AGENDADO", "FALHOU", "PUBLICADO"].includes(post.status)) return { ok: true };
  if (post.status !== "AGUARDANDO") return { ok: false, error: "Este post ainda não está liberado para aprovação." };
  await db.contentPost.update({
    where: { id: post.id },
    data: { status: "APROVADO", approvedAt: new Date(), feedback: null, events: { create: { kind: "APROVADO", actor: "Cliente" } } },
  });
  await tell(post, "Post aprovado ✅", `${post.batch.client.companyName} aprovou "${post.title}"${post.scheduledFor ? "" : ""}.`);
  revalidatePath(`/conteudo/${post.batchId}`);
  return { ok: true };
}

export async function requestAdjustmentAction(token: string, postId: string, topics: string[], comment: string): Promise<{ ok: boolean; error?: string }> {
  const post = await load(token, postId);
  if (!post) return { ok: false, error: "Link inválido." };
  if (!["AGUARDANDO", "APROVADO", "AGENDADO", "FALHOU"].includes(post.status)) return { ok: false, error: "Este post não pode mais receber ajuste por aqui." };
  const text = String(comment ?? "").trim().slice(0, 1000);
  if (text.length < 3) return { ok: false, error: "Escreva o que gostaria de mudar." };
  const allowed = ["Legenda", "Vídeo ou imagem", "Data e hora", "Outro"];
  const tags = (Array.isArray(topics) ? topics : []).filter((t) => allowed.includes(t)).slice(0, 4);
  const note = `${tags.length ? `[${tags.join(", ")}] ` : ""}${text}`;
  await db.contentPost.update({
    where: { id: post.id },
    data: { status: "AJUSTE", feedback: note, feedbackAt: new Date(), approvedAt: null, events: { create: { kind: "AJUSTE", actor: "Cliente", note } } },
  });
  // Pediu mudança depois de aprovar: o que estava agendado deixa de valer.
  await db.contentPostTarget.updateMany({ where: { postId: post.id, status: { in: ["AGENDADO", "FALHOU"] } }, data: { status: "CANCELADO" } });
  await tell(post, "Cliente pediu ajuste ✏️", `${post.batch.client.companyName} sobre "${post.title}": ${note.slice(0, 140)}`);
  revalidatePath(`/conteudo/${post.batchId}`);
  return { ok: true };
}
