"use server";

import crypto from "node:crypto";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth/guard";
import { permKey } from "@/lib/auth/permissions";
import { hashPassword } from "@/lib/auth/password";
import { audit } from "@/lib/audit";
import { sendEmail } from "@/lib/integrations/email";
import { ensureMediaOnlyRole } from "@/lib/media/bootstrap";
import {
  isAllowedMediaImageType,
  saveMediaImage,
  deleteMediaImageByUrl,
} from "@/lib/storage/media-files";
import {
  inviteMediaMemberSchema,
  updateMediaMemberSchema,
  mediaFunctionSchema,
  memberFunctionAssignSchema,
  mediaBrandSettingsSchema,
  mediaAIWeightsSchema,
} from "@/lib/validation/media";
import type { ActionState } from "@/lib/actions/auth-actions";

const CREATE = permKey("MEDIA_ADESF", "CREATE");
const EDIT = permKey("MEDIA_ADESF", "EDIT");
const DELETE = permKey("MEDIA_ADESF", "DELETE");
const MANAGE = permKey("MEDIA_ADESF", "MANAGE");

function appUrl(): string {
  return process.env.APP_URL ?? "http://localhost:3000";
}

async function sendMediaInviteEmail(
  organizationId: string,
  name: string,
  email: string,
) {
  const token = crypto.randomBytes(32).toString("hex");
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  const user = await db.user.findFirstOrThrow({
    where: { organizationId, email },
  });

  await db.passwordResetToken.create({
    data: {
      userId: user.id,
      tokenHash,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });

  const inviteUrl = `${appUrl()}/redefinir-senha/${token}`;
  return sendEmail({
    organizationId,
    to: email,
    subject: "Bem-vindo(a) ao Mídia ADESF — defina sua senha",
    text: `Olá, ${name}. Você foi convidado(a) para a equipe de mídia (Mídia ADESF). Defina sua senha de acesso (link válido por 7 dias): ${inviteUrl}\n\nDepois de definir sua senha, acesse o portal em: ${appUrl()}/midia/login`,
  });
}

// Convida um membro para o Mídia ADESF. Cobre os dois casos exigidos pela
// especificação sem duplicar usuário: e-mail já cadastrado no LUMIBASE só
// ganha o vínculo MediaMember (ACTIVE de imediato — a pessoa já tem senha);
// e-mail novo cria um User "casca" preso a uma role sem nenhuma permissão do
// LUMIBASE (ensureMediaOnlyRole) e segue o mesmo fluxo de convite por
// PasswordResetToken já usado em user-actions.ts.
export async function inviteMediaMemberAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const admin = await requirePermission(CREATE);

  const parsed = inviteMediaMemberSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    role: formData.get("role"),
  });
  if (!parsed.success) {
    return {
      error:
        parsed.error.issues[0]?.message ?? "Verifique os dados informados.",
    };
  }
  const { name, email, phone, role } = parsed.data;

  const existingUser = await db.user.findFirst({
    where: { email, deletedAt: null },
    include: { mediaMember: true },
  });

  if (existingUser) {
    if (existingUser.organizationId !== admin.organizationId) {
      return {
        error: "Já existe uma conta com este e-mail em outra organização.",
      };
    }
    if (existingUser.mediaMember) {
      return { error: "Este usuário já faz parte da equipe de mídia." };
    }

    const member = await db.$transaction(async (tx) => {
      const created = await tx.mediaMember.create({
        data: {
          organizationId: admin.organizationId,
          userId: existingUser.id,
          role,
          phone: phone || null,
          status: "ACTIVE",
          invitedByUserId: admin.id,
          joinedAt: new Date(),
        },
      });
      await tx.mediaInvitation.create({
        data: {
          organizationId: admin.organizationId,
          email,
          role,
          invitedByUserId: admin.id,
          status: "ACCEPTED",
          expiresAt: new Date(),
          acceptedAt: new Date(),
        },
      });
      return created;
    });

    await sendEmail({
      organizationId: admin.organizationId,
      to: email,
      subject: "Você agora tem acesso ao Mídia ADESF",
      text: `Olá, ${existingUser.name}. Sua conta já cadastrada no LUMIBASE agora também tem acesso ao Portal Mídia ADESF. Acesse com seu e-mail e senha atuais em: ${appUrl()}/midia/login`,
    });

    await audit({
      organizationId: admin.organizationId,
      userId: admin.id,
      action: "MEDIA_MEMBER_ADDED",
      entityType: "MediaMember",
      entityId: member.id,
      metadata: { email, role, existingUser: true },
    });

    revalidatePath("/midia-adesf/equipe");
    revalidatePath("/midia/equipe");
    return { success: "Usuário existente vinculado ao Mídia ADESF." };
  }

  const mediaOnlyRole = await ensureMediaOnlyRole(admin.organizationId);
  const randomPassword = crypto.randomBytes(24).toString("hex");

  const member = await db.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        organizationId: admin.organizationId,
        name,
        email,
        roleId: mediaOnlyRole.id,
        passwordHash: await hashPassword(randomPassword),
      },
    });
    const created = await tx.mediaMember.create({
      data: {
        organizationId: admin.organizationId,
        userId: user.id,
        role,
        phone: phone || null,
        status: "INVITED",
        invitedByUserId: admin.id,
      },
    });
    await tx.mediaInvitation.create({
      data: {
        organizationId: admin.organizationId,
        email,
        role,
        invitedByUserId: admin.id,
        status: "INVITED",
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });
    return created;
  });

  const inviteResult = await sendMediaInviteEmail(
    admin.organizationId,
    name,
    email,
  );

  await audit({
    organizationId: admin.organizationId,
    userId: admin.id,
    action: "MEDIA_MEMBER_INVITED",
    entityType: "MediaMember",
    entityId: member.id,
    metadata: { email, role },
  });

  revalidatePath("/midia-adesf/equipe");
  revalidatePath("/midia/equipe");
  if (inviteResult.pending) {
    return {
      success:
        "Membro criado. Nenhum provedor de e-mail conectado — envie o link de acesso manualmente.",
    };
  }
  return { success: "Convite enviado por e-mail." };
}

export async function updateMediaMemberAction(
  memberId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const admin = await requirePermission(EDIT);

  const parsed = updateMediaMemberSchema.safeParse({
    role: formData.get("role"),
    status: formData.get("status"),
    phone: formData.get("phone"),
    administrativeNotes: formData.get("administrativeNotes"),
  });
  if (!parsed.success)
    return {
      error:
        parsed.error.issues[0]?.message ?? "Verifique os dados informados.",
    };

  const member = await db.mediaMember.findFirst({
    where: { id: memberId, organizationId: admin.organizationId },
  });
  if (!member) return { error: "Membro não encontrado." };

  await db.mediaMember.update({
    where: { id: memberId },
    data: {
      role: parsed.data.role,
      status: parsed.data.status,
      phone: parsed.data.phone || null,
      administrativeNotes: parsed.data.administrativeNotes || null,
    },
  });

  await audit({
    organizationId: admin.organizationId,
    userId: admin.id,
    action: "MEDIA_MEMBER_UPDATED",
    entityType: "MediaMember",
    entityId: memberId,
    metadata: { role: parsed.data.role, status: parsed.data.status },
  });

  revalidatePath("/midia-adesf/equipe");
  revalidatePath("/midia/equipe");
  revalidatePath(`/midia-adesf/equipe/${memberId}`);
  revalidatePath(`/midia/equipe/${memberId}`);
  return { success: "Membro atualizado." };
}

export async function removeMediaMemberAction(memberId: string): Promise<void> {
  const admin = await requirePermission(DELETE);

  const member = await db.mediaMember.findFirst({
    where: { id: memberId, organizationId: admin.organizationId },
  });
  if (!member) return;

  await db.mediaMember.update({
    where: { id: memberId },
    data: { status: "INACTIVE" },
  });

  await audit({
    organizationId: admin.organizationId,
    userId: admin.id,
    action: "MEDIA_MEMBER_DEACTIVATED",
    entityType: "MediaMember",
    entityId: memberId,
  });

  revalidatePath("/midia-adesf/equipe");
  revalidatePath("/midia/equipe");
}

export async function resendMediaInvitationAction(
  memberId: string,
): Promise<void> {
  const admin = await requirePermission(EDIT);

  const member = await db.mediaMember.findFirst({
    where: {
      id: memberId,
      organizationId: admin.organizationId,
      status: "INVITED",
    },
    include: { user: true },
  });
  if (!member) return;

  await sendMediaInviteEmail(
    admin.organizationId,
    member.user.name,
    member.user.email,
  );

  await audit({
    organizationId: admin.organizationId,
    userId: admin.id,
    action: "MEDIA_INVITATION_RESENT",
    entityType: "MediaMember",
    entityId: memberId,
  });

  revalidatePath("/midia-adesf/equipe");
  revalidatePath("/midia/equipe");
}

// Funções (ex: Data Show, Fotógrafo) — catálogo configurável por organização.
export async function createMediaFunctionAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const admin = await requirePermission(MANAGE);

  const parsed = mediaFunctionSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description"),
    active: formData.get("active"),
  });
  if (!parsed.success)
    return {
      error:
        parsed.error.issues[0]?.message ?? "Verifique os dados informados.",
    };

  const existing = await db.mediaFunction.findFirst({
    where: { organizationId: admin.organizationId, name: parsed.data.name },
  });
  if (existing) return { error: "Já existe uma função com este nome." };

  const count = await db.mediaFunction.count({
    where: { organizationId: admin.organizationId },
  });
  const created = await db.mediaFunction.create({
    data: {
      organizationId: admin.organizationId,
      name: parsed.data.name,
      description: parsed.data.description || null,
      active: parsed.data.active,
      displayOrder: count,
    },
  });

  await audit({
    organizationId: admin.organizationId,
    userId: admin.id,
    action: "MEDIA_FUNCTION_CREATED",
    entityType: "MediaFunction",
    entityId: created.id,
    metadata: { name: created.name },
  });

  revalidatePath("/midia-adesf/configuracoes");
  revalidatePath("/midia/configuracoes");
  return { success: "Função criada." };
}

export async function updateMediaFunctionAction(
  functionId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const admin = await requirePermission(MANAGE);

  const parsed = mediaFunctionSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description"),
    active: formData.get("active"),
  });
  if (!parsed.success)
    return {
      error:
        parsed.error.issues[0]?.message ?? "Verifique os dados informados.",
    };

  const fn = await db.mediaFunction.findFirst({
    where: { id: functionId, organizationId: admin.organizationId },
  });
  if (!fn) return { error: "Função não encontrada." };

  await db.mediaFunction.update({
    where: { id: functionId },
    data: {
      name: parsed.data.name,
      description: parsed.data.description || null,
      active: parsed.data.active,
    },
  });

  await audit({
    organizationId: admin.organizationId,
    userId: admin.id,
    action: "MEDIA_FUNCTION_UPDATED",
    entityType: "MediaFunction",
    entityId: functionId,
  });

  revalidatePath("/midia-adesf/configuracoes");
  revalidatePath("/midia/configuracoes");
  return { success: "Função atualizada." };
}

export async function deleteMediaFunctionAction(
  functionId: string,
): Promise<void> {
  const admin = await requirePermission(MANAGE);

  const fn = await db.mediaFunction.findFirst({
    where: { id: functionId, organizationId: admin.organizationId },
    include: { _count: { select: { memberFunctions: true } } },
  });
  if (!fn || fn._count.memberFunctions > 0) return;

  await db.mediaFunction.delete({ where: { id: functionId } });

  await audit({
    organizationId: admin.organizationId,
    userId: admin.id,
    action: "MEDIA_FUNCTION_DELETED",
    entityType: "MediaFunction",
    entityId: functionId,
    metadata: { name: fn.name },
  });

  revalidatePath("/midia-adesf/configuracoes");
  revalidatePath("/midia/configuracoes");
}

// Vincula/atualiza a função de um membro. Feito em transação porque "função
// principal" é imposta por um índice único parcial no banco (uma por
// membro) — zera as demais antes de marcar a nova como principal.
export async function assignMemberFunctionAction(
  memberId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const admin = await requirePermission(EDIT);

  const parsed = memberFunctionAssignSchema.safeParse({
    functionId: formData.get("functionId"),
    isPrimary: formData.get("isPrimary"),
    status: formData.get("status") || "HABILITADO",
  });
  if (!parsed.success)
    return {
      error:
        parsed.error.issues[0]?.message ?? "Verifique os dados informados.",
    };

  const member = await db.mediaMember.findFirst({
    where: { id: memberId, organizationId: admin.organizationId },
  });
  if (!member) return { error: "Membro não encontrado." };

  const fn = await db.mediaFunction.findFirst({
    where: { id: parsed.data.functionId, organizationId: admin.organizationId },
  });
  if (!fn) return { error: "Função não encontrada." };

  await db.$transaction(async (tx) => {
    if (parsed.data.isPrimary) {
      await tx.mediaMemberFunction.updateMany({
        where: { memberId },
        data: { isPrimary: false },
      });
    }
    await tx.mediaMemberFunction.upsert({
      where: { memberId_functionId: { memberId, functionId: fn.id } },
      create: {
        memberId,
        functionId: fn.id,
        isPrimary: parsed.data.isPrimary,
        status: parsed.data.status,
      },
      update: { isPrimary: parsed.data.isPrimary, status: parsed.data.status },
    });
  });

  await audit({
    organizationId: admin.organizationId,
    userId: admin.id,
    action: "MEDIA_MEMBER_FUNCTION_ASSIGNED",
    entityType: "MediaMember",
    entityId: memberId,
    metadata: {
      functionId: fn.id,
      functionName: fn.name,
      isPrimary: parsed.data.isPrimary,
    },
  });

  revalidatePath(`/midia-adesf/equipe/${memberId}`);
  revalidatePath(`/midia/equipe/${memberId}`);
  return { success: "Função vinculada ao membro." };
}

export async function removeMemberFunctionAction(
  memberId: string,
  functionId: string,
): Promise<void> {
  const admin = await requirePermission(EDIT);

  const member = await db.mediaMember.findFirst({
    where: { id: memberId, organizationId: admin.organizationId },
  });
  if (!member) return;

  await db.mediaMemberFunction.deleteMany({ where: { memberId, functionId } });

  await audit({
    organizationId: admin.organizationId,
    userId: admin.id,
    action: "MEDIA_MEMBER_FUNCTION_REMOVED",
    entityType: "MediaMember",
    entityId: memberId,
    metadata: { functionId },
  });

  revalidatePath(`/midia-adesf/equipe/${memberId}`);
  revalidatePath(`/midia/equipe/${memberId}`);
}

// Identidade visual (Fase 01 — configurável por quem tem MANAGE). Upload de
// logo é feito num arquivo separado de página (Server Action com FormData
// contendo File) para não acoplar este módulo de ações a next/server apenas
// por causa do tipo File — mantido aqui mesmo por simplicidade e coesão.
export async function updateMediaBrandSettingsAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const admin = await requirePermission(MANAGE);

  const parsed = mediaBrandSettingsSchema.safeParse({
    environmentName: formData.get("environmentName"),
    primaryColor: formData.get("primaryColor"),
    secondaryColor: formData.get("secondaryColor"),
    gradientStart: formData.get("gradientStart"),
    gradientEnd: formData.get("gradientEnd"),
  });
  if (!parsed.success)
    return {
      error:
        parsed.error.issues[0]?.message ?? "Verifique os dados informados.",
    };

  await db.mediaBrandSettings.upsert({
    where: { organizationId: admin.organizationId },
    create: { organizationId: admin.organizationId, ...parsed.data },
    update: parsed.data,
  });

  await audit({
    organizationId: admin.organizationId,
    userId: admin.id,
    action: "MEDIA_BRAND_SETTINGS_UPDATED",
    entityType: "MediaBrandSettings",
  });

  revalidatePath("/midia-adesf/configuracoes");
  revalidatePath("/midia/configuracoes");
  revalidatePath("/midia/login");
  return { success: "Identidade visual atualizada." };
}

// Pesos da IA de escala (§8) — nunca mexe nas restrições obrigatórias
// (ativo/habilitado/disponível/sem conflito), só na ordem de preferência
// entre quem já passou nelas.
export async function updateMediaAIWeightsAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requirePermission(MANAGE);

  const parsed = mediaAIWeightsSchema.safeParse({
    aiWeightWorkload: formData.get("aiWeightWorkload"),
    aiWeightRecency: formData.get("aiWeightRecency"),
    aiWeightPreference: formData.get("aiWeightPreference"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Verifique os dados informados." };

  await db.mediaOperationsSettings.upsert({
    where: { organizationId: admin.organizationId },
    create: { organizationId: admin.organizationId, ...parsed.data },
    update: parsed.data,
  });

  await audit({
    organizationId: admin.organizationId,
    userId: admin.id,
    action: "MEDIA_AI_WEIGHTS_UPDATED",
    entityType: "MediaOperationsSettings",
    metadata: parsed.data,
  });

  revalidatePath("/midia-adesf/configuracoes");
  return { success: "Pesos da IA atualizados." };
}

export async function uploadMediaBrandImageAction(
  field: "logoUrl" | "logoLightUrl" | "logoDarkUrl" | "faviconUrl",
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const admin = await requirePermission(MANAGE);

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0)
    return { error: "Selecione uma imagem." };
  if (file.size > 5 * 1024 * 1024)
    return { error: "A imagem deve ter no máximo 5MB." };
  if (!isAllowedMediaImageType(file.type))
    return {
      error: "Formato de imagem não suportado. Use PNG, JPG, WEBP ou SVG.",
    };

  const current = await db.mediaBrandSettings.findUnique({
    where: { organizationId: admin.organizationId },
  });
  const url = await saveMediaImage(admin.organizationId, file);
  await db.mediaBrandSettings.upsert({
    where: { organizationId: admin.organizationId },
    create: { organizationId: admin.organizationId, [field]: url },
    update: { [field]: url },
  });
  if (current?.[field]) await deleteMediaImageByUrl(current[field]);

  await audit({
    organizationId: admin.organizationId,
    userId: admin.id,
    action: "MEDIA_BRAND_IMAGE_UPDATED",
    entityType: "MediaBrandSettings",
    metadata: { field },
  });

  revalidatePath("/midia-adesf/configuracoes");
  revalidatePath("/midia/configuracoes");
  revalidatePath("/midia/login");
  return { success: "Imagem atualizada." };
}
