import { NextResponse } from "next/server";
import { runNotificationRoutine } from "@/lib/notifications/reminders";

// Disparado pelo crontab do servidor a cada 15 minutos (mesmo padrão das
// outras rotas de /api/cron): alertas urgentes, captações/compromissos que
// estão para começar e o resumo da manhã.
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET não configurado." }, { status: 500 });
  }

  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const result = await runNotificationRoutine();
  return NextResponse.json(result);
}
