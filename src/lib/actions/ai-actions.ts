"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth/guard";
import { permKey } from "@/lib/auth/permissions";
import { audit } from "@/lib/audit";
import { getConnectedAiProvider } from "@/lib/ai/providers";
import { callAiProvider } from "@/lib/ai/chat";
import { buildSystemContext } from "@/lib/ai/context";
import type { ActionState } from "@/lib/actions/auth-actions";

export async function createConversationAction(): Promise<void> {
  const user = await requirePermission(permKey("AI", "VIEW"));

  const conversation = await db.aiConversation.create({
    data: { organizationId: user.organizationId, userId: user.id },
  });

  revalidatePath("/ai", "layout");

  redirect(`/ai/${conversation.id}`);
}

export async function sendMessageAction(conversationId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission(permKey("AI", "VIEW"));

  const content = (formData.get("content") as string | null)?.trim();
  if (!content) return { error: "Escreva uma mensagem." };

  const conversation = await db.aiConversation.findFirst({
    where: { id: conversationId, organizationId: user.organizationId, userId: user.id },
    include: { messages: { orderBy: { createdAt: "asc" } } },
  });
  if (!conversation) return { error: "Conversa não encontrada." };

  const connectedProvider = await getConnectedAiProvider(user.organizationId);
  if (!connectedProvider) {
    return { error: "Nenhum provedor de IA conectado. Conecte OpenAI, Anthropic ou Google Gemini em Configurações → Integrações." };
  }

  await db.aiMessage.create({ data: { conversationId, role: "USER", content } });

  if (!conversation.title) {
    await db.aiConversation.update({
      where: { id: conversationId },
      data: { title: content.slice(0, 60) },
    });
  }

  const organization = await db.organization.findUniqueOrThrow({ where: { id: user.organizationId }, select: { name: true } });
  const systemPrompt = await buildSystemContext(user, organization.name);

  const history = [
    ...conversation.messages
      .filter((m) => m.role !== "SYSTEM")
      .map((m) => ({ role: m.role === "USER" ? ("user" as const) : ("assistant" as const), content: m.content })),
    { role: "user" as const, content },
  ];

  try {
    const reply = await callAiProvider(connectedProvider.provider, connectedProvider.apiKey, systemPrompt, history);
    await db.aiMessage.create({ data: { conversationId, role: "ASSISTANT", content: reply } });
    await db.aiConversation.update({ where: { id: conversationId }, data: { updatedAt: new Date() } });
  } catch (err) {
    await audit({
      organizationId: user.organizationId,
      userId: user.id,
      action: "AI_REQUEST_FAILED",
      entityType: "AiConversation",
      entityId: conversationId,
      metadata: { provider: connectedProvider.provider, error: (err as Error).message },
    });
    revalidatePath(`/ai/${conversationId}`);
    return { error: `Falha ao consultar ${connectedProvider.provider}: ${(err as Error).message}` };
  }

  revalidatePath(`/ai/${conversationId}`);
  revalidatePath("/ai", "layout");
  return { success: "Mensagem enviada." };
}

export async function deleteConversationAction(conversationId: string): Promise<void> {
  const user = await requirePermission(permKey("AI", "VIEW"));

  const conversation = await db.aiConversation.findFirst({ where: { id: conversationId, organizationId: user.organizationId, userId: user.id } });
  if (!conversation) return;

  await db.aiConversation.delete({ where: { id: conversationId } });

  await audit({
    organizationId: user.organizationId,
    userId: user.id,
    action: "AI_CONVERSATION_DELETED",
    entityType: "AiConversation",
    entityId: conversationId,
  });

  revalidatePath("/ai", "layout");
}
