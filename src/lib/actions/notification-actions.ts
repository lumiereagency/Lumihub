"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/guard";

// Genérico (não específico do Mídia ADESF) — sempre escopado ao próprio
// usuário da sessão, nunca aceita um userId do cliente.
export async function markNotificationReadAction(notificationId: string): Promise<void> {
  const user = await requireUser();

  await db.notification.updateMany({
    where: { id: notificationId, userId: user.id, readAt: null },
    data: { readAt: new Date() },
  });

  revalidatePath("/midia/notificacoes");
}

export async function markAllNotificationsReadAction(): Promise<void> {
  const user = await requireUser();

  await db.notification.updateMany({
    where: { userId: user.id, readAt: null },
    data: { readAt: new Date() },
  });

  revalidatePath("/midia/notificacoes");
}
