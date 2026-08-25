import { NextResponse } from "next/server";
import { generateDueRecurringReceivables } from "@/lib/billing/recurring";
import { generateDuePayrollPayables } from "@/lib/billing/payroll";

// Disparado diariamente pelo crontab do servidor (curl com o header abaixo)
// — não há infraestrutura de cron dentro do Next.js self-hosted, então essa
// rota é o gatilho externo da régua de recorrência de contratos e da folha
// de pagamento (Fase 46).
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET não configurado." }, { status: 500 });
  }

  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const [receivablesCreated, payrollCreated] = await Promise.all([
    generateDueRecurringReceivables(),
    generateDuePayrollPayables(),
  ]);
  return NextResponse.json({ receivablesCreated, payrollCreated });
}
