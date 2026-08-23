"use client";

import { useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Plus, Trash2, MessageSquare } from "lucide-react";
import { createConversationAction, deleteConversationAction } from "@/lib/actions/ai-actions";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";

interface ConversationRow {
  id: string;
  title: string | null;
  updatedAt: string;
}

export function ConversationSidebar({ conversations }: { conversations: ConversationRow[] }) {
  const pathname = usePathname();
  const router = useRouter();
  const [, startTransition] = useTransition();

  function handleDelete(id: string) {
    if (!confirm("Excluir esta conversa?")) return;
    startTransition(async () => {
      await deleteConversationAction(id);
      if (pathname === `/ai/${id}`) router.push("/ai");
    });
  }

  return (
    <div className="flex min-h-0 w-72 shrink-0 flex-col gap-3 border-r border-border pr-4">
      <form action={createConversationAction}>
        <Button type="submit" className="w-full">
          <Plus size={16} /> Nova conversa
        </Button>
      </form>

      <div className="scrollbar-thin flex flex-col gap-1 overflow-y-auto">
        {conversations.length === 0 && <p className="px-2 py-4 text-center text-xs text-text-tertiary">Nenhuma conversa ainda.</p>}
        {conversations.map((c) => {
          const active = pathname === `/ai/${c.id}`;
          return (
            <div
              key={c.id}
              className={cn(
                "group flex items-center gap-2 rounded-[10px] px-3 py-2.5 text-sm",
                active ? "bg-card-elevated text-text-primary" : "text-text-secondary hover:bg-card",
              )}
            >
              <MessageSquare size={14} className="shrink-0 text-text-tertiary" />
              <Link href={`/ai/${c.id}`} className="min-w-0 flex-1">
                <p className="truncate">{c.title || "Nova conversa"}</p>
                <p className="text-xs text-text-tertiary">{formatDateTime(new Date(c.updatedAt))}</p>
              </Link>
              <button
                type="button"
                onClick={() => handleDelete(c.id)}
                className="shrink-0 text-text-tertiary opacity-0 hover:text-error group-hover:opacity-100"
                aria-label="Excluir conversa"
              >
                <Trash2 size={14} />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
