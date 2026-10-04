import "server-only";
import webpush from "web-push";
import { db } from "@/lib/db";

// Chaves VAPID identificam este servidor para os serviços de push (Google,
// Apple, Mozilla). Podem vir do .env; se não vierem, são geradas uma única
// vez e guardadas no banco — assim o deploy não exige configuração manual e
// as inscrições dos aparelhos continuam válidas entre reinícios.
const VAPID_KEY = "vapid_keys";
let cached: { publicKey: string; privateKey: string } | null = null;

export async function getVapidKeys(): Promise<{ publicKey: string; privateKey: string }> {
  if (cached) return cached;
  if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    cached = { publicKey: process.env.VAPID_PUBLIC_KEY, privateKey: process.env.VAPID_PRIVATE_KEY };
    return cached;
  }
  const stored = await db.systemSetting.findUnique({ where: { key: VAPID_KEY } });
  if (stored) {
    cached = JSON.parse(stored.value);
    return cached!;
  }
  const keys = webpush.generateVAPIDKeys();
  // Dois processos gerando ao mesmo tempo: fica a primeira gravada.
  await db.systemSetting.createMany({ data: [{ key: VAPID_KEY, value: JSON.stringify(keys) }], skipDuplicates: true });
  const saved = await db.systemSetting.findUniqueOrThrow({ where: { key: VAPID_KEY } });
  cached = JSON.parse(saved.value);
  return cached!;
}

export interface PushPayload {
  title: string;
  body: string;
  url: string;
  tag?: string;
}

// Envia para todos os aparelhos dos usuários e apaga inscrições que o serviço
// de push diz não existirem mais (app desinstalado, permissão revogada).
export async function sendPushToUsers(userIds: string[], payload: PushPayload): Promise<{ sent: number; failed: number }> {
  if (userIds.length === 0) return { sent: 0, failed: 0 };
  const subs = await db.pushSubscription.findMany({ where: { userId: { in: userIds } } });
  if (subs.length === 0) return { sent: 0, failed: 0 };
  const { publicKey, privateKey } = await getVapidKeys();
  const subject = process.env.VAPID_SUBJECT ?? `mailto:${process.env.VAPID_CONTACT ?? "contato@lumibase.tech"}`;
  const body = JSON.stringify(payload);
  let sent = 0;
  let failed = 0;
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, body, {
          vapidDetails: { subject, publicKey, privateKey },
          TTL: 60 * 60 * 12,
          urgency: "high",
        });
        sent++;
        await db.pushSubscription.update({ where: { id: s.id }, data: { lastUsedAt: new Date() } }).catch(() => {});
      } catch (e) {
        failed++;
        const status = (e as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          await db.pushSubscription.delete({ where: { id: s.id } }).catch(() => {});
        } else {
          console.error("[push] falha ao enviar", status, (e as Error).message);
        }
      }
    }),
  );
  return { sent, failed };
}
