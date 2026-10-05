import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { requireUser, isDirector, hasPermission } from "@/lib/auth/guard";
import { permKey } from "@/lib/auth/permissions";
import { PageHeader } from "@/components/layout/page-header";
import { getPricingSettings } from "@/lib/pricing/settings";
import { competenceOf, shiftCompetence, syncPayroll } from "@/lib/payroll/folha";
import { getMonthOverview } from "@/lib/payroll/overview";
import { PayrollBoard } from "./payroll-board";

export default async function PayrollPage({ searchParams }: PageProps<"/equipe/pagamentos">) {
  const user = await requireUser();
  const director = isDirector(user);
  if (!director && !hasPermission(user, permKey("PAYABLES", "VIEW"))) redirect("/acesso-negado");

  const sp = await searchParams;
  const current = competenceOf(new Date());
  const raw = typeof sp.mes === "string" && /^\d{4}-\d{2}$/.test(sp.mes) ? sp.mes : current;

  await syncPayroll(user.organizationId);
  const [overview, settings] = await Promise.all([getMonthOverview(user.organizationId, raw), getPricingSettings(user.organizationId)]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Pagamentos da equipe"
        description="Fixo, comissões e extras de cada pessoa, somados na folha do mês e pagos na data de cada um."
        actions={
          <div className="flex items-center gap-1 rounded-full border border-border bg-card p-1">
            <Link href={`?mes=${shiftCompetence(raw, -1)}`} className="flex h-9 w-9 items-center justify-center rounded-full text-text-secondary hover:bg-card-elevated" aria-label="Mês anterior">
              <ChevronLeft size={16} />
            </Link>
            <span className="min-w-[150px] px-2 text-center text-sm font-medium text-text-primary">{overview.label.charAt(0).toUpperCase() + overview.label.slice(1)}</span>
            <Link href={`?mes=${shiftCompetence(raw, 1)}`} className="flex h-9 w-9 items-center justify-center rounded-full text-text-secondary hover:bg-card-elevated" aria-label="Próximo mês">
              <ChevronRight size={16} />
            </Link>
          </div>
        }
      />
      <PayrollBoard
        overview={overview}
        isCurrent={raw === current}
        canPay={director || hasPermission(user, permKey("PAYABLES", "EDIT"))}
        canEditSettings={director}
        settings={{
          captureFeeSolo: settings.captureFeeSolo,
          captureFeeShared: settings.captureFeeShared,
          taxRate: settings.taxRate,
          taxDueDay: settings.taxDueDay,
        }}
      />
    </div>
  );
}
