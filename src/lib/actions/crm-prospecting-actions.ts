"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth/guard";
import { permKey } from "@/lib/auth/permissions";
import { audit } from "@/lib/audit";
import { searchYoutubeProspects, type YoutubeProspect } from "@/lib/integrations/youtube";
import type { ActionState } from "@/lib/actions/auth-actions";

export async function searchYoutubeProspectsAction(
  query: string,
  minSubscribers?: number,
): Promise<{ prospects: YoutubeProspect[] } | { error: string }> {
  const user = await requirePermission(permKey("CRM", "CREATE"));

  const trimmed = query.trim();
  if (!trimmed) return { error: "Informe um nicho ou palavra-chave pra buscar." };

  return searchYoutubeProspects(user.organizationId, trimmed, { minSubscribers });
}

// Importa um canal encontrado na busca pra dentro do funil como Lead —
// nunca automático: o funcionário decide quais candidatos valem a pena
// depois de olhar a lista (§ pedido do usuário sobre manter um humano no
// meio do processo, mesmo padrão já usado nas outras automações do sistema).
export async function importYoutubeProspectAction(prospect: YoutubeProspect): Promise<ActionState> {
  const user = await requirePermission(permKey("CRM", "CREATE"));

  const existing = await db.lead.findFirst({
    where: { organizationId: user.organizationId, deletedAt: null, website: prospect.channelUrl },
  });
  if (existing) return { error: "Este canal já está cadastrado no funil." };

  const uploadNote =
    prospect.daysSinceLastUpload === null
      ? "sem dados de upload recente"
      : `último vídeo há ${prospect.daysSinceLastUpload} dia(s)`;
  const shortsNote = prospect.shortsRatio === null ? "sem dados de Shorts" : `${Math.round(prospect.shortsRatio * 100)}% dos últimos uploads são Shorts`;

  const lead = await db.lead.create({
    data: {
      organizationId: user.organizationId,
      company: prospect.title,
      website: prospect.channelUrl,
      segment: "Criador de conteúdo / figura pública",
      source: "Prospecção IA (YouTube)",
      temperature: prospect.temperature,
      notes: `${prospect.subscriberCount.toLocaleString("pt-BR")} inscritos · ${prospect.videoCount.toLocaleString("pt-BR")} vídeos · ${uploadNote} · ${shortsNote}.`,
    },
  });

  await audit({
    organizationId: user.organizationId,
    userId: user.id,
    action: "LEAD_CREATED",
    entityType: "Lead",
    entityId: lead.id,
    metadata: { company: lead.company, source: "youtube_prospecting", channelId: prospect.channelId },
  });

  revalidatePath("/crm");
  revalidatePath("/crm/prospeccao-ia");
  return { success: `${prospect.title} adicionado ao funil.` };
}
