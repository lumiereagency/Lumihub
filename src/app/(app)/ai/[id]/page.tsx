import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/guard";
import { db } from "@/lib/db";
import { getConnectedAiProvider } from "@/lib/ai/providers";
import { ChatThread } from "./chat-thread";
import { ChatInput } from "./chat-input";

export default async function ConversationPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;

  const conversation = await db.aiConversation.findFirst({
    where: { id, organizationId: user.organizationId, userId: user.id },
    include: { messages: { orderBy: { createdAt: "asc" } } },
  });
  if (!conversation) notFound();

  const provider = await getConnectedAiProvider(user.organizationId);

  return (
    <div className="flex h-full min-h-0 flex-col">
      {!provider && (
        <p className="mb-3 rounded-[10px] border border-warning/30 bg-warning/10 p-3 text-xs text-warning">
          Nenhum provedor de IA conectado. Conecte OpenAI, Anthropic ou Google Gemini em Configurações → Integrações para enviar mensagens.
        </p>
      )}
      <ChatThread messages={conversation.messages} />
      <ChatInput conversationId={conversation.id} disabled={!provider} />
    </div>
  );
}
