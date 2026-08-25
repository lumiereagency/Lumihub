import "server-only";
import { db } from "@/lib/db";

// Camada única de notificação interna do Mídia ADESF — reaproveita o modelo
// `Notification` já existente no LUMIBASE (in-app, por usuário) em vez de
// criar uma tabela paralela. Regra de negócio nunca fala com um canal
// diretamente (§61): quem quiser aviso por e-mail/WhatsApp no futuro troca
// só esta função, sem tocar nos services de domínio que a chamam.
export async function notifyUser(organizationId: string, userId: string, title: string, body: string, link?: string): Promise<void> {
  await db.notification.create({ data: { organizationId, userId, title, body, link } });
}

export async function notifyMediaMember(organizationId: string, memberId: string, title: string, body: string, link?: string): Promise<void> {
  const member = await db.mediaMember.findUnique({ where: { id: memberId }, select: { userId: true } });
  if (!member) return;
  await notifyUser(organizationId, member.userId, title, body, link);
}

// "Líder" aqui é sempre o papel dentro do Mídia ADESF (MediaMember.role =
// LIDER), não qualquer admin do LUMIBASE — é quem de fato opera a escala.
export async function notifyMediaLeaders(organizationId: string, title: string, body: string, link?: string): Promise<void> {
  const leaders = await db.mediaMember.findMany({
    where: { organizationId, role: "LIDER", status: "ACTIVE" },
    select: { userId: true },
  });
  if (leaders.length === 0) return;
  await db.notification.createMany({
    data: leaders.map((l) => ({ organizationId, userId: l.userId, title, body, link })),
  });
}
