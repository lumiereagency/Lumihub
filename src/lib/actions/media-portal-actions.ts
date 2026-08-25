"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireMediaMember } from "@/lib/auth/guard";
import { audit } from "@/lib/audit";
import { isAllowedMediaImageType, saveMediaImage, deleteMediaImageByUrl } from "@/lib/storage/media-files";
import { myMediaProfileSchema, availabilityRecurringSchema, availabilityExceptionSchema } from "@/lib/validation/media";
import type { ActionState } from "@/lib/actions/auth-actions";

// Todas as ações abaixo são "self-service": nunca recebem um memberId vindo
// do cliente — o alvo é sempre derivado da sessão (requireMediaMember()),
// o que elimina IDOR por construção (não há parâmetro para adulterar).

export async function updateMyMediaProfileAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireMediaMember();

  const parsed = myMediaProfileSchema.safeParse({
    name: formData.get("name"),
    phone: formData.get("phone"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Verifique os dados informados." };

  await db.$transaction([
    db.user.update({ where: { id: user.id }, data: { name: parsed.data.name } }),
    db.mediaMember.update({ where: { userId: user.id }, data: { phone: parsed.data.phone || null } }),
  ]);

  await audit({
    organizationId: user.organizationId,
    userId: user.id,
    action: "MEDIA_PROFILE_UPDATED",
    entityType: "MediaMember",
    entityId: user.media!.id,
  });

  revalidatePath("/midia/perfil");
  return { success: "Perfil atualizado." };
}

export async function uploadMyMediaAvatarAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireMediaMember();

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Selecione uma imagem." };
  if (file.size > 5 * 1024 * 1024) return { error: "A imagem deve ter no máximo 5MB." };
  if (!isAllowedMediaImageType(file.type)) return { error: "Formato não suportado. Use PNG, JPG ou WEBP." };

  const previousUrl = user.avatarUrl;
  const url = await saveMediaImage(user.organizationId, file);
  await db.user.update({ where: { id: user.id }, data: { avatarUrl: url } });
  if (previousUrl) await deleteMediaImageByUrl(previousUrl);

  await audit({
    organizationId: user.organizationId,
    userId: user.id,
    action: "MEDIA_AVATAR_UPDATED",
    entityType: "MediaMember",
    entityId: user.media!.id,
  });

  revalidatePath("/midia/perfil");
  return { success: "Foto atualizada." };
}

// Substitui toda a disponibilidade recorrente do membro em uma tacada só —
// a UI envia a grade semanal inteira (7 dias) a cada salvamento, então
// delete + recreate é mais simples e seguro do que reconciliar diffs.
export async function updateMyAvailabilityAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireMediaMember();

  const raw = formData.get("slots");
  let slotsInput: unknown;
  try {
    slotsInput = JSON.parse(typeof raw === "string" ? raw : "[]");
  } catch {
    return { error: "Dados de disponibilidade inválidos." };
  }

  const parsed = availabilityRecurringSchema.safeParse({ slots: slotsInput });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Verifique os horários informados." };

  await db.$transaction([
    db.mediaAvailabilityRecurring.deleteMany({ where: { memberId: user.media!.id } }),
    ...(parsed.data.slots.length > 0
      ? [
          db.mediaAvailabilityRecurring.createMany({
            data: parsed.data.slots.map((slot) => ({ memberId: user.media!.id, ...slot })),
          }),
        ]
      : []),
  ]);

  await audit({
    organizationId: user.organizationId,
    userId: user.id,
    action: "MEDIA_AVAILABILITY_UPDATED",
    entityType: "MediaMember",
    entityId: user.media!.id,
  });

  revalidatePath("/midia/disponibilidade");
  return { success: "Disponibilidade atualizada." };
}

export async function addMyAvailabilityExceptionAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireMediaMember();

  const parsed = availabilityExceptionSchema.safeParse({
    date: formData.get("date"),
    startTime: formData.get("startTime"),
    endTime: formData.get("endTime"),
    available: formData.get("available"),
    reason: formData.get("reason"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Verifique os dados informados." };

  await db.mediaAvailabilityException.create({
    data: {
      memberId: user.media!.id,
      date: new Date(`${parsed.data.date}T00:00:00`),
      startTime: parsed.data.startTime,
      endTime: parsed.data.endTime,
      available: parsed.data.available,
      reason: parsed.data.reason || null,
    },
  });

  await audit({
    organizationId: user.organizationId,
    userId: user.id,
    action: "MEDIA_AVAILABILITY_EXCEPTION_ADDED",
    entityType: "MediaMember",
    entityId: user.media!.id,
  });

  revalidatePath("/midia/disponibilidade");
  return { success: "Exceção adicionada." };
}

export async function deleteMyAvailabilityExceptionAction(exceptionId: string): Promise<void> {
  const user = await requireMediaMember();

  // IDOR: mesmo sendo uma ação "self-service", o id da exceção vem do
  // cliente — confirma que ela pertence ao próprio membro antes de excluir.
  await db.mediaAvailabilityException.deleteMany({ where: { id: exceptionId, memberId: user.media!.id } });

  revalidatePath("/midia/disponibilidade");
}
