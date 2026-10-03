import type { ReactNode } from "react";
import { requirePermission } from "@/lib/auth/guard";
import { permKey } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/layout/page-header";
import { ConversationSidebar } from "./conversation-sidebar";

export default async function AiLayout({ children }: { children: ReactNode }) {
  const user = await requirePermission(permKey("AI", "VIEW"));

  const conversations = await db.aiConversation.findMany({
    where: { organizationId: user.organizationId, userId: user.id },
    orderBy: { updatedAt: "desc" },
    select: { id: true, title: true, updatedAt: true },
  });

  return (
    <div className="flex h-[calc(100dvh-8rem)] min-h-[560px] flex-col">
      <PageHeader title="Lumi AI" description="Assistente com contexto real do sistema, respeitando as permissões do seu perfil." />
      <div className="flex min-h-0 flex-1 flex-col gap-4 md:flex-row">
        <ConversationSidebar conversations={conversations.map((c) => ({ ...c, updatedAt: c.updatedAt.toISOString() }))} />
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-3xl border border-border bg-card">{children}</div>
      </div>
    </div>
  );
}
