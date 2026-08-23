import { requireUser } from "@/lib/auth/guard";
import { getConnectedAiProvider } from "@/lib/ai/providers";
import { EmptyState } from "@/components/ui/empty-state";
import { Sparkles } from "lucide-react";
import Link from "next/link";

export default async function AiLandingPage() {
  const user = await requireUser();
  const provider = await getConnectedAiProvider(user.organizationId);

  return (
    <div className="flex h-full items-center justify-center">
      <EmptyState
        icon={<Sparkles size={28} />}
        title={provider ? "Selecione ou crie uma conversa" : "Nenhum provedor de IA conectado"}
        description={
          provider
            ? "Use o botão \"Nova conversa\" ao lado para começar a falar com a Lumi AI."
            : "Conecte OpenAI, Anthropic ou Google Gemini em Configurações → Integrações para usar a Lumi AI."
        }
        action={
          !provider && (
            <Link href="/configuracoes/integracoes" className="text-sm font-medium text-gold hover:text-gold-light">
              Ir para Integrações →
            </Link>
          )
        }
      />
    </div>
  );
}
