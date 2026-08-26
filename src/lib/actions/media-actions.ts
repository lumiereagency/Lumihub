"use server";

import crypto from "node:crypto";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth/guard";
import { permKey } from "@/lib/auth/permissions";
import { hashPassword } from "@/lib/auth/password";
import { audit } from "@/lib/audit";
import { sendEmail } from "@/lib/integrations/email";
import { sendWhatsApp } from "@/lib/integrations/whatsapp";
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
  syncMemberFunctionsSchema,
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

interface InviteDeliveryResult {
  emailDelivered: boolean;
  whatsappDelivered: boolean;
  whatsappError: string | null;
  inviteUrl: string;
}

// Convite/reenvio por e-mail E WhatsApp (§ pedido do usuário: "alguns
// membros não estão recebendo por e-mail") — dispara os dois sempre que
// possível em vez de escolher um; cada envio já é gracioso sozinho (só
// registra no log quando não há provedor conectado), então tentar os dois
// nunca piora nada, só aumenta a chance de chegar.
async function sendMediaInvite(organizationId: string, name: string, email: string, phone: string | null): Promise<InviteDeliveryResult> {
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
  const text = `Olá, ${name}! Você foi convidado(a) para a equipe de mídia (Mídia ADESF). Defina sua senha de acesso (link válido por 7 dias): ${inviteUrl}\n\nDepois de definir sua senha, acesse o portal em: ${appUrl()}/midia/login`;

  const emailResult = await sendEmail({ organizationId, to: email, subject: "Bem-vindo(a) ao Mídia ADESF — defina sua senha", text });
  const whatsappResult = phone ? await sendWhatsApp({ organizationId, to: phone, message: text }) : null;

  return {
    emailDelivered: emailResult.delivered,
    whatsappDelivered: whatsappResult?.delivered ?? false,
    whatsappError: whatsappResult?.error ?? null,
    inviteUrl,
  };
}

function describeInviteDelivery(result: InviteDeliveryResult, hasPhone: boolean): string {
  const channels = [result.emailDelivered && "e-mail", result.whatsappDelivered && "WhatsApp"].filter(Boolean).join(" e ");
  if (channels) return `Convite enviado por ${channels}.`;
  // Erro específico do WhatsApp (ex: número não registrado) é mais útil
  // pro admin do que o aviso genérico de "nenhum provedor conectado" —
  // aqui o WhatsApp está conectado, só não conseguiu entregar pra este
  // número específico.
  if (result.whatsappError) return `${result.whatsappError} Copie e envie manualmente: ${result.inviteUrl}`;
  return `Nenhum provedor de e-mail ou WhatsApp conectado${hasPhone ? "" : " (e não há telefone cadastrado)"}. Copie e envie manualmente: ${result.inviteUrl}`;
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
    functionIds: formData.getAll("functionIds"),
    primaryFunctionId: formData.get("primaryFunctionId"),
  });
  if (!parsed.success) {
    return {
      error:
        parsed.error.issues[0]?.message ?? "Verifique os dados informados.",
    };
  }
  const { name, email, phone, role, functionIds, primaryFunctionId } = parsed.data;

  // Nunca confia nos IDs de função vindos do cliente — só usa os que
  // realmente pertencem a esta organização (§funções configuráveis).
  const validFunctions = functionIds.length > 0
    ? await db.mediaFunction.findMany({ where: { id: { in: functionIds }, organizationId: admin.organizationId }, select: { id: true } })
    : [];
  const validFunctionIds = validFunctions.map((f) => f.id);
  const resolvedPrimaryId = validFunctionIds.includes(primaryFunctionId) ? primaryFunctionId : null;

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
      if (validFunctionIds.length > 0) {
        await tx.mediaMemberFunction.createMany({
          data: validFunctionIds.map((functionId) => ({
            memberId: created.id,
            functionId,
            isPrimary: functionId === resolvedPrimaryId,
          })),
        });
      }
      return created;
    });

    const accessMessage = `Olá, ${existingUser.name}. Sua conta já cadastrada no LUMIBASE agora também tem acesso ao Portal Mídia ADESF. Acesse com seu e-mail e senha atuais em: ${appUrl()}/midia/login`;
    await sendEmail({ organizationId: admin.organizationId, to: email, subject: "Você agora tem acesso ao Mídia ADESF", text: accessMessage });
    if (phone) await sendWhatsApp({ organizationId: admin.organizationId, to: phone, message: accessMessage });

    await audit({
      organizationId: admin.organizationId,
      userId: admin.id,
      action: "MEDIA_MEMBER_ADDED",
      entityType: "MediaMember",
      entityId: member.id,
      metadata: { email, role, existingUser: true, functionIds: validFunctionIds },
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
    if (validFunctionIds.length > 0) {
      await tx.mediaMemberFunction.createMany({
        data: validFunctionIds.map((functionId) => ({
          memberId: created.id,
          functionId,
          isPrimary: functionId === resolvedPrimaryId,
        })),
      });
    }
    return created;
  });

  const inviteResult = await sendMediaInvite(admin.organizationId, name, email, phone || null);

  await audit({
    organizationId: admin.organizationId,
    userId: admin.id,
    action: "MEDIA_MEMBER_INVITED",
    entityType: "MediaMember",
    entityId: member.id,
    metadata: { email, role, functionIds: validFunctionIds },
  });

  revalidatePath("/midia-adesf/equipe");
  revalidatePath("/midia/equipe");
  return { success: describeInviteDelivery(inviteResult, !!phone) };
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

// Reenvia o convite (§ pedido do usuário: "não está funcionando") — o bug
// real era duplo: a ação não devolvia nenhum resultado pro admin ver (por
// isso "não funcionava" mesmo quando na verdade tinha enviado), e ia só por
// e-mail — se a organização nunca conectou um provedor SMTP (Integrações),
// sendEmail só registra no log e nada chega a ninguém. Agora tenta e-mail
// E WhatsApp (se o membro tiver telefone) e sempre diz o que de fato
// aconteceu, com o link pronto pra copiar manualmente se os dois falharem.
export async function resendMediaInvitationAction(memberId: string): Promise<ActionState> {
  const admin = await requirePermission(EDIT);

  const member = await db.mediaMember.findFirst({
    where: { id: memberId, organizationId: admin.organizationId, status: "INVITED" },
    include: { user: true },
  });
  if (!member) return { error: "Convite não encontrado." };

  const inviteResult = await sendMediaInvite(admin.organizationId, member.user.name, member.user.email, member.phone);

  await audit({
    organizationId: admin.organizationId,
    userId: admin.id,
    action: "MEDIA_INVITATION_RESENT",
    entityType: "MediaMember",
    entityId: memberId,
  });

  revalidatePath("/midia-adesf/equipe");
  revalidatePath("/midia/equipe");
  return { success: describeInviteDelivery(inviteResult, !!member.phone) };
}

// Exclui de vez um convite ainda não aceito (§ pedido do usuário: "não
// tenho a opção de excluir, preciso de uma lixeirazinha") — diferente de
// removeMediaMemberAction, que só desativa. Só permitido para quem nunca
// acessou o portal (status INVITED): não há escala/presença/troca real
// vinculada ainda, então apagar é seguro. Se o convite foi pra um e-mail
// que já era um usuário do LUMIBASE, mantém o User (a conta é dele, não
// foi criada pra isso); só apaga o User-casca criado especificamente para
// este convite (role MEDIA_ONLY, nunca logou em lugar nenhum).
//
// Também cobre membros INACTIVE (§ pedido do usuário: "conta inativa não
// tem a opção de ser apagada") — mas só quando nunca tiveram uma escala de
// verdade: apagar um membro com histórico de presença/escala cascatearia
// (MediaAttendance.memberId não é opcional) e apagaria dados reais de
// participação passada, não só o cadastro. Nesse caso, a única opção
// continua sendo manter desativado.
export async function deleteMediaMemberAction(memberId: string): Promise<ActionState> {
  const admin = await requirePermission(DELETE);

  const member = await db.mediaMember.findFirst({
    where: { id: memberId, organizationId: admin.organizationId, status: { in: ["INVITED", "INACTIVE"] } },
    include: { user: { include: { role: true } } },
  });
  if (!member) return { error: "Membro não encontrado ou não pode ser excluído neste status." };

  const assignmentsCount = await db.mediaScheduleAssignment.count({ where: { memberId } });
  if (assignmentsCount > 0) {
    return { error: "Este membro já teve escalas/presenças registradas — não pode ser excluído, apenas mantido desativado." };
  }

  const isShellUser = member.user.role.key === "MEDIA_ONLY" && !member.user.lastLoginAt;

  await db.$transaction(async (tx) => {
    await tx.mediaMember.delete({ where: { id: memberId } });
    await tx.mediaInvitation.deleteMany({ where: { organizationId: admin.organizationId, email: member.user.email } });
    if (isShellUser) await tx.user.delete({ where: { id: member.userId } });
  });

  await audit({
    organizationId: admin.organizationId,
    userId: admin.id,
    action: "MEDIA_MEMBER_DELETED",
    entityType: "MediaMember",
    entityId: memberId,
    metadata: { email: member.user.email },
  });

  revalidatePath("/midia-adesf/equipe");
  revalidatePath("/midia/equipe");
  return { success: "Membro excluído." };
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

// Grade "todas as funções de uma vez" (§ pedido do usuário) — substitui
// assignMemberFunctionAction/removeMemberFunctionAction linha-por-linha
// por um único envio: a UI manda o estado final desejado (quais funções
// ficam marcadas, com qual nível/mentor) e aqui é feito o diff contra o
// que já existe, tudo numa transação.
export async function syncMemberFunctionsAction(
  memberId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const admin = await requirePermission(EDIT);

  let rowsInput: unknown;
  try {
    rowsInput = JSON.parse(String(formData.get("rows") ?? "[]"));
  } catch {
    return { error: "Dados de funções inválidos." };
  }
  const parsed = syncMemberFunctionsSchema.safeParse({ rows: rowsInput });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Verifique os dados informados." };

  const member = await db.mediaMember.findFirst({ where: { id: memberId, organizationId: admin.organizationId } });
  if (!member) return { error: "Membro não encontrado." };

  // Nunca confia nos IDs vindos do cliente — só aceita funções e mentores
  // que realmente existem nesta organização.
  const functionIds = parsed.data.rows.map((r) => r.functionId);
  const validFunctionIds = new Set(
    (await db.mediaFunction.findMany({ where: { id: { in: functionIds }, organizationId: admin.organizationId }, select: { id: true } })).map((f) => f.id),
  );
  const mentorIds = parsed.data.rows.map((r) => r.mentorMemberId).filter((id): id is string => !!id);
  const validMentorIds = new Set(
    mentorIds.length > 0
      ? (await db.mediaMember.findMany({ where: { id: { in: mentorIds }, organizationId: admin.organizationId }, select: { id: true } })).map((m) => m.id)
      : [],
  );

  const rows = parsed.data.rows.filter((r) => validFunctionIds.has(r.functionId));
  const primaryCount = rows.filter((r) => r.isPrimary).length;
  if (primaryCount > 1) return { error: "Só é possível marcar uma função principal." };

  await db.$transaction(async (tx) => {
    await tx.mediaMemberFunction.deleteMany({ where: { memberId, functionId: { notIn: rows.map((r) => r.functionId) } } });
    for (const row of rows) {
      const mentorMemberId = row.status === "EM_TREINAMENTO" && row.mentorMemberId && validMentorIds.has(row.mentorMemberId) ? row.mentorMemberId : null;
      await tx.mediaMemberFunction.upsert({
        where: { memberId_functionId: { memberId, functionId: row.functionId } },
        create: { memberId, functionId: row.functionId, status: row.status, isPrimary: row.isPrimary, mentorMemberId },
        update: { status: row.status, isPrimary: row.isPrimary, mentorMemberId },
      });
    }
  });

  await audit({
    organizationId: admin.organizationId,
    userId: admin.id,
    action: "MEDIA_MEMBER_FUNCTIONS_SYNCED",
    entityType: "MediaMember",
    entityId: memberId,
    metadata: { functionIds: rows.map((r) => r.functionId) },
  });

  revalidatePath(`/midia-adesf/equipe/${memberId}`);
  revalidatePath(`/midia/equipe/${memberId}`);
  return { success: "Funções atualizadas." };
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
    aiMinRestDays: formData.get("aiMinRestDays"),
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
