import { Sparkles, User } from "lucide-react";
import { cn } from "@/lib/cn";

interface MessageRow {
  id: string;
  role: string;
  content: string;
}

export function ChatThread({ messages }: { messages: MessageRow[] }) {
  if (messages.length === 0) {
    return <p className="flex-1 text-center text-sm text-text-tertiary">Envie a primeira mensagem para começar.</p>;
  }

  return (
    <div className="scrollbar-thin flex flex-1 flex-col gap-4 overflow-y-auto pb-4">
      {messages.map((m) => {
        const isUser = m.role === "USER";
        return (
          <div key={m.id} className={cn("flex gap-3", isUser && "flex-row-reverse")}>
            <div
              className={cn(
                "flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
                isUser ? "bg-card-elevated text-text-secondary" : "bg-gold/15 text-gold",
              )}
            >
              {isUser ? <User size={14} /> : <Sparkles size={14} />}
            </div>
            <div
              className={cn(
                "max-w-[75%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm",
                isUser ? "bg-card-elevated text-text-primary" : "bg-card text-text-primary border border-border",
              )}
            >
              {m.content}
            </div>
          </div>
        );
      })}
    </div>
  );
}
