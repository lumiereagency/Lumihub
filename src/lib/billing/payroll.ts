import "server-only";
import { syncAllPayrolls } from "@/lib/payroll/folha";

// Rodada diária (/api/cron/generate-receivables): mantém as folhas do mês
// (fixo + comissões + cachês) em dia — ver @/lib/payroll/folha.
export async function generateDuePayrollPayables(): Promise<number> {
  return syncAllPayrolls();
}
