import { NextResponse } from "next/server";
import { runQuoteFollowUps } from "@/lib/quotes/follow-up";
import { ensureWhatsAppSessions } from "@/lib/integrations/whatsapp-baileys";
import { processDuePaymentReminders } from "@/lib/billing/reminders";

// Disparado periodicamente pelo crontab do servidor (mesmo padrão de
// generate-receivables e escalate-swap-requests) — antes disso, a régua de
// Lumi Cobranças só rodava quando alguém clicava em "Processar régua
// agora" na tela, uma decisão documentada como temporária enquanto não
// havia infraestrutura de cron; essa infraestrutura já existe.
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET não configurado." }, { status: 500 });
  }

  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  // Garante o WhatsApp ligado antes de enviar (cobre queda de rede e reinício do servidor).
  await ensureWhatsAppSessions().catch(() => 0);
  const { sent, failed } = await processDuePaymentReminders();
  // Acompanhamento de orçamentos enviados (mesmo cron de 15 em 15 minutos).
  const quotes = await runQuoteFollowUps().catch((e) => {
    console.error("[orcamentos] acompanhamento falhou", (e as Error).message);
    return { sent: 0, failed: 0, outsideWindow: false };
  });
  return NextResponse.json({ sent, failed, quoteFollowUps: quotes });
}
