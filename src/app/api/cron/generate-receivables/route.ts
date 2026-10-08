import { NextResponse } from "next/server";
import { generateDueRecurringReceivables } from "@/lib/billing/recurring";
import { generateDuePayrollPayables } from "@/lib/billing/payroll";
import { syncAllTaxes } from "@/lib/finance/taxes";
import { reconcileAllOrganizations } from "@/lib/finance/sync";
import { generateDueMediaEventOccurrences } from "@/lib/media/schedule/event-service";

// Disparado diariamente pelo crontab do servidor (curl com o header abaixo)
// — não há infraestrutura de cron dentro do Next.js self-hosted, então essa
// rota é o gatilho externo da régua de recorrência de contratos, da folha
// de pagamento (Fase 46) e — desde a Fase 02 do Mídia ADESF — da geração de
// ocorrências de cultos/eventos recorrentes.
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET não configurado." }, { status: 500 });
  }

  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  // Conferência diária: contratos, clientes e movimentos alinhados antes de gerar as próximas cobranças.
  await reconcileAllOrganizations();
  const [receivablesCreated, payrollCreated, mediaEventsCreated] = await Promise.all([
    generateDueRecurringReceivables(),
    generateDuePayrollPayables(),
    generateDueMediaEventOccurrences(),
  ]);
  // Reserva do Simples (6% do que entrou) sempre em dia.
  await syncAllTaxes();
  return NextResponse.json({ receivablesCreated, payrollCreated, mediaEventsCreated });
}
