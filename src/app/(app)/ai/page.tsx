import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { requireUser } from "@/lib/auth/guard";
import { getConnectedAiProvider } from "@/lib/ai/providers";
import { Logo } from "@/components/layout/logo";

const EXAMPLES = [
  "Quais leads estão sem contato há mais de uma semana?",
  "Resuma os orçamentos enviados este mês e quantos foram aceitos.",
  "Quanto tenho a receber nos próximos 30 dias?",
  "Quais tarefas da equipe estão atrasadas?",
];

export default async function AiLandingPage() {
  const user = await requireUser();
  const provider = await getConnectedAiProvider(user.organizationId);

  return (
    <div className="flex h-full flex-col items-center justify-center gap-7 overflow-y-auto px-6 py-10 text-center">
      <Logo size="lg" gradientId="lb-ai-mark" className="h-auto w-24" />
      <div className="flex max-w-md flex-col gap-2">
        <h2 className="text-balance text-2xl font-semibold tracking-tight text-text-primary">
          {provider ? "Pergunte à Lumi sobre a sua operação" : "Conecte uma IA para usar a Lumi"}
        </h2>
        <p className="text-sm text-text-tertiary">
          {provider
            ? "Ela responde com os dados reais da base, respeitando o que o seu perfil pode ver. Comece em \"Nova conversa\"."
            : "A Lumi usa OpenAI, Anthropic (Claude) ou Google Gemini. Conecte uma delas em Configurações → Integrações."}
        </p>
      </div>
      {provider ? (
        <ul className="grid w-full max-w-2xl grid-cols-1 gap-2 text-left sm:grid-cols-2">
          {EXAMPLES.map((e) => (
            <li key={e} className="rounded-2xl border border-border px-4 py-3 text-sm text-text-secondary">
              {e}
            </li>
          ))}
        </ul>
      ) : (
        <Link href="/configuracoes/integracoes" className="inline-flex h-11 items-center gap-2 rounded-full bg-ink px-5 text-sm font-medium text-ink-on hover:opacity-90">
          Ir para Integrações <ArrowRight size={16} />
        </Link>
      )}
    </div>
  );
}
