"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireMediaMember } from "@/lib/auth/guard";
import { confirmAttendance, declineAttendance, checkInMember } from "@/lib/media/schedule/attendance-service";
import { triggerSubstituteSearch } from "@/lib/media/tokens/action-tokens";
import type { ActionState } from "@/lib/actions/auth-actions";

// Self-service: memberId sempre vem da sessão, nunca do cliente.

export async function confirmAttendanceAction(assignmentId: string): Promise<ActionState> {
  const user = await requireMediaMember();
  const member = await db.mediaMember.findUniqueOrThrow({ where: { userId: user.id } });

  const result = await confirmAttendance(user.organizationId, user.id, assignmentId, member.id);

  revalidatePath("/midia/minha-escala");
  revalidatePath("/midia/inicio");
  return result;
}

// "Não vou poder" dentro do portal logado (§ pedido do usuário: widget de
// resposta no dashboard) — dispara a MESMA cascata de busca de substituto
// que o link do WhatsApp sem login já dispara, via triggerSubstituteSearch.
export async function declineAttendanceAction(assignmentId: string): Promise<ActionState> {
  const user = await requireMediaMember();
  const member = await db.mediaMember.findUniqueOrThrow({ where: { userId: user.id } });

  const result = await declineAttendance(user.organizationId, user.id, assignmentId, member.id);
  if (result.error) {
    revalidatePath("/midia/minha-escala");
    return result;
  }

  const cascade = await triggerSubstituteSearch(user.organizationId, assignmentId, member.id);

  revalidatePath("/midia/minha-escala");
  revalidatePath("/midia/inicio");
  return { success: cascade.success ?? "Indisponibilidade registrada." };
}

export async function checkInAction(assignmentId: string): Promise<ActionState> {
  const user = await requireMediaMember();
  const member = await db.mediaMember.findUniqueOrThrow({ where: { userId: user.id } });

  const result = await checkInMember(user.organizationId, user.id, assignmentId, member.id);

  revalidatePath("/midia/minha-escala");
  return result;
}
