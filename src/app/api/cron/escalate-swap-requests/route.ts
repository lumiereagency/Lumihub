import { NextResponse } from "next/server";
import { escalateStaleAutoSuggestedSwaps } from "@/lib/media/tokens/action-tokens";

// Disparado com frequência bem maior que o cron diário (§ pedido do
// usuário: espera de só 1h antes de tentar o próximo candidato) — precisa
// rodar a cada 15-20min pra não deixar a troca esperando muito além da 1h
// combinada. Rota separada de /api/cron/generate-receivables (que roda uma
// vez por dia) justamente por causa dessa frequência diferente.
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET não configurado." }, { status: 500 });
  }

  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const { escalated } = await escalateStaleAutoSuggestedSwaps();
  return NextResponse.json({ escalated });
}
