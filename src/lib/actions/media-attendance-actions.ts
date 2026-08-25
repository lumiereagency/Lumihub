"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireMediaMember } from "@/lib/auth/guard";
import { confirmAttendance, checkInMember } from "@/lib/media/schedule/attendance-service";
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

export async function checkInAction(assignmentId: string): Promise<ActionState> {
  const user = await requireMediaMember();
  const member = await db.mediaMember.findUniqueOrThrow({ where: { userId: user.id } });

  const result = await checkInMember(user.organizationId, user.id, assignmentId, member.id);

  revalidatePath("/midia/minha-escala");
  return result;
}
