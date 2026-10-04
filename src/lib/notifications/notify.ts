import "server-only";
import { after } from "next/server";
import { db } from "@/lib/db";
import { sendPushToUsers } from "@/lib/notifications/push";
import { isQuietNow, parseNotificationSettings, type NotificationCategory } from "@/lib/notifications/settings";

// Ponto único de aviso para pessoas da equipe: grava na caixa de notificações
// (sino) e manda push para os aparelhos de quem ativou, respeitando as
// categorias desligadas e o horário de silêncio de cada um. Regra de negócio
// chama só isto — nunca o push direto.

export interface NotifyInput {
  organizationId: string;
  userIds: (string | null | undefined)[];
  title: string;
  body: string;
  link?: string | null;
  category: NotificationCategory;
  // Avisos automáticos que não podem se repetir (ex: "task-due:<id>:<dia>"); vira uma chave por pessoa.
  dedupeKey?: string;
  // Ignora o horário de silêncio (ex: resumo da manhã, que já tem hora certa).
  ignoreQuiet?: boolean;
}

function runAfter(fn: () => Promise<unknown>) {
  // Dentro de uma requisição o push sai depois da resposta (não atrasa a tela);
  // fora dela (scripts, rotina) roda na hora.
  try {
    after(fn);
  } catch {
    return fn();
  }
}

export async function notifyUsers(input: NotifyInput): Promise<string[]> {
  const ids = [...new Set(input.userIds.filter((v): v is string => !!v))];
  if (ids.length === 0) return [];

  const created: string[] = [];
  for (const userId of ids) {
    try {
      await db.notification.create({
        data: {
          organizationId: input.organizationId,
          userId,
          title: input.title,
          body: input.body,
          link: input.link ?? null,
          category: input.category,
          dedupeKey: input.dedupeKey ? `${input.dedupeKey}:${userId}` : null,
        },
      });
      created.push(userId);
    } catch (e) {
      // Chave repetida = esse aviso já foi dado para essa pessoa.
      if ((e as { code?: string }).code !== "P2002") throw e;
    }
  }
  if (created.length > 0) await runAfter(() => pushToUsers(created, input));
  return created;
}

// Push sem gravar de novo na caixa (para quem já gravou a notificação, ex: dentro de uma transação).
export async function pushToUsers(userIds: string[], input: Pick<NotifyInput, "title" | "body" | "link" | "category" | "ignoreQuiet">): Promise<void> {
  try {
    const users = await db.user.findMany({
      where: { id: { in: userIds }, isActive: true, deletedAt: null },
      select: { id: true, notificationSettings: true },
    });
    const now = new Date();
    const targets = users
      .filter((u) => {
        const s = parseNotificationSettings(u.notificationSettings);
        if (s.disabled.includes(input.category)) return false;
        return input.ignoreQuiet || !isQuietNow(s, now);
      })
      .map((u) => u.id);
    await sendPushToUsers(targets, { title: input.title, body: input.body, url: input.link || "/dashboard", tag: input.category });
  } catch (e) {
    console.error("[push] erro ao notificar", (e as Error).message);
  }
}

export function deferPush(userIds: string[], input: Pick<NotifyInput, "title" | "body" | "link" | "category">) {
  if (userIds.length > 0) return runAfter(() => pushToUsers(userIds, input));
}

// Donos e administradores ativos (quem decide e acompanha tudo).
export async function directorIds(organizationId: string): Promise<string[]> {
  const users = await db.user.findMany({
    where: { organizationId, isActive: true, deletedAt: null, OR: [{ isOwner: true }, { role: { key: "ADMIN" } }] },
    select: { id: true },
  });
  return users.map((u) => u.id);
}
