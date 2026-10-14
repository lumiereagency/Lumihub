import { NextResponse } from "next/server";
import { checkAccountHealth, runDuePublications } from "@/lib/social/publish";

// Chamado de 5 em 5 minutos pelo crontab. Responde na hora e deixa o envio
// (que pode levar minutos num vídeo grande) rodando em segundo plano.
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "CRON_SECRET não configurado." }, { status: 500 });
  if (request.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  const result = await runDuePublications();
  const health = await checkAccountHealth().catch((e) => {
    console.error("[social] checagem das contas falhou", (e as Error).message);
    return { renewed: 0, warned: 0 };
  });
  return NextResponse.json({ ...result, health });
}
