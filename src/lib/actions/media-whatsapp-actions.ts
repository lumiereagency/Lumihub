"use server";

import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth/guard";
import { permKey } from "@/lib/auth/permissions";
import { sendWhatsApp } from "@/lib/integrations/whatsapp";
import { createAvailabilityRequestToken, sendScheduleConfirmationRequests } from "@/lib/media/tokens/action-tokens";
import { formatDate } from "@/lib/format";
import type { ActionState } from "@/lib/actions/auth-actions";

const MANAGE = permKey("MEDIA_ADESF", "MANAGE");

function appUrl(): string {
  return process.env.APP_URL ?? "http://localhost:3000";
}

// Ambos os disparos abaixo são sempre iniciados pela liderança (nunca
// automáticos) e reaproveitam o mesmo sendWhatsApp/Integration já usado
// pelo restante da LUMIBASE — se não houver conta conectada em
// Configurações → Integrações, cai no mesmo fallback "pendente" (loga e
// segue) que os outros módulos já têm, sem quebrar o fluxo.

// Envia o disparo único de confirmação da escala do mês (§ pedido do
// usuário: um link só por membro, listando todos os dias, para minimizar
// custo de disparos) — usada tanto pelo botão manual quanto automaticamente
// logo após publicar a escala.
export async function sendScheduleWhatsAppAction(scheduleId: string): Promise<ActionState> {
  const admin = await requirePermission(MANAGE);

  const schedule = await db.mediaSchedule.findFirst({ where: { id: scheduleId, organizationId: admin.organizationId } });
  if (!schedule) return { error: "Escala não encontrada." };

  const { sent, withoutPhone, failed } = await sendScheduleConfirmationRequests(scheduleId, admin.organizationId);

  if (sent === 0 && withoutPhone === 0 && failed === 0) return { error: "Nenhum membro com atribuição nesta escala." };
  const notes = [withoutPhone > 0 && `${withoutPhone} sem telefone cadastrado`, failed > 0 && `${failed} falha(s) no envio (WhatsApp desconectado?)`]
    .filter(Boolean)
    .join(", ");
  return { success: notes ? `Enviado para ${sent} membro(s). ${notes}.` : `Enviado para ${sent} membro(s).` };
}

// Pergunta de disponibilidade para um culto específico (§ "perguntar
// disponibilidade" pedido pelo usuário) — manda o link de um clique
// (/midia/acao/[token]) só para quem é habilitado em alguma função exigida
// pelo evento, evitando incomodar quem nunca serviria ali de qualquer jeito.
export async function requestAvailabilityViaWhatsAppAction(eventId: string): Promise<ActionState> {
  const admin = await requirePermission(MANAGE);

  const event = await db.mediaEvent.findFirst({
    where: { id: eventId, organizationId: admin.organizationId },
    include: { requirements: true },
  });
  if (!event) return { error: "Evento não encontrado." };
  if (event.requirements.length === 0) return { error: "Este evento ainda não tem funções configuradas." };

  const memberFunctions = await db.mediaMemberFunction.findMany({
    where: {
      functionId: { in: event.requirements.map((r) => r.functionId) },
      member: { organizationId: admin.organizationId, status: "ACTIVE" },
    },
    include: { member: { include: { user: { select: { name: true } } } } },
    distinct: ["memberId"],
  });

  let sent = 0;
  let withoutPhone = 0;
  for (const mf of memberFunctions) {
    if (!mf.member.phone) {
      withoutPhone++;
      continue;
    }
    const token = await createAvailabilityRequestToken(admin.organizationId, mf.memberId, eventId);
    const message = `Olá, ${mf.member.user.name}! Você está disponível para servir em ${event.name} no dia ${formatDate(event.startAt)}? Responda aqui: ${appUrl()}/midia/acao/${token}`;
    await sendWhatsApp({ organizationId: admin.organizationId, to: mf.member.phone, message });
    sent++;
  }

  if (sent === 0 && withoutPhone === 0) return { error: "Nenhum membro habilitado para as funções deste evento." };
  return {
    success: withoutPhone > 0 ? `Pergunta enviada para ${sent} membro(s). ${withoutPhone} sem telefone cadastrado.` : `Pergunta enviada para ${sent} membro(s).`,
  };
}
