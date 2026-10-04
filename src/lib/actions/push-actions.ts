"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/guard";
import { sendPushToUsers } from "@/lib/notifications/push";
import { NOTIFICATION_CATEGORIES, parseNotificationSettings, type NotificationSettings } from "@/lib/notifications/settings";

// Tudo aqui é sempre do próprio usuário da sessão — nunca aceita userId do cliente.

const subscriptionSchema = z.object({
  endpoint: z.string().url().max(1000),
  keys: z.object({ p256dh: z.string().min(10).max(300), auth: z.string().min(8).max(100) }),
});

export async function savePushSubscriptionAction(input: unknown, userAgent?: string): Promise<{ ok: boolean }> {
  const user = await requireUser();
  const parsed = subscriptionSchema.safeParse(input);
  if (!parsed.success) return { ok: false };
  const { endpoint, keys } = parsed.data;
  // O mesmo aparelho pode trocar de pessoa (sair e entrar com outra conta): a inscrição passa para quem está logado.
  await db.pushSubscription.upsert({
    where: { endpoint },
    create: { userId: user.id, endpoint, p256dh: keys.p256dh, auth: keys.auth, userAgent: userAgent?.slice(0, 300) ?? null },
    update: { userId: user.id, p256dh: keys.p256dh, auth: keys.auth, userAgent: userAgent?.slice(0, 300) ?? undefined },
  });
  return { ok: true };
}

export async function removePushSubscriptionAction(endpoint: string): Promise<void> {
  const user = await requireUser();
  if (typeof endpoint !== "string") return;
  await db.pushSubscription.deleteMany({ where: { endpoint, userId: user.id } });
}

export async function sendTestPushAction(): Promise<{ ok: boolean; sent: number; error?: string }> {
  const user = await requireUser();
  const { sent } = await sendPushToUsers([user.id], {
    title: "Notificações ativadas ✨",
    body: `Tudo certo, ${user.name.split(" ")[0]}. É assim que a LUMIBASE vai te avisar.`,
    url: "/configuracoes/perfil",
  });
  if (sent === 0) return { ok: false, sent, error: "Nenhum aparelho ativo recebeu. Ative as notificações neste aparelho e tente de novo." };
  return { ok: true, sent };
}

const settingsSchema = z.object({
  disabled: z.array(z.enum(NOTIFICATION_CATEGORIES.map((c) => c.key) as [string, ...string[]])).max(20),
  quiet: z.boolean(),
  quietStart: z.number().int().min(0).max(23),
  quietEnd: z.number().int().min(0).max(23),
});

export async function updateNotificationSettingsAction(input: NotificationSettings): Promise<{ ok: boolean; error?: string }> {
  const user = await requireUser();
  const parsed = settingsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Confira as opções." };
  await db.user.update({ where: { id: user.id }, data: { notificationSettings: parseNotificationSettings(parsed.data) as object } });
  revalidatePath("/configuracoes/perfil");
  return { ok: true };
}

export interface BellItem {
  id: string;
  title: string;
  body: string;
  link: string | null;
  category: string | null;
  createdAt: string;
  read: boolean;
}

export async function getBellAction(): Promise<{ unread: number; items: BellItem[] }> {
  const user = await requireUser();
  const [unread, items] = await Promise.all([
    db.notification.count({ where: { userId: user.id, readAt: null } }),
    db.notification.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 30 }),
  ]);
  return {
    unread,
    items: items.map((n) => ({
      id: n.id,
      title: n.title,
      body: n.body,
      link: n.link,
      category: n.category,
      createdAt: n.createdAt.toISOString(),
      read: !!n.readAt,
    })),
  };
}

export async function getUnreadCountAction(): Promise<number> {
  const user = await requireUser();
  return db.notification.count({ where: { userId: user.id, readAt: null } });
}
