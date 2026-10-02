import { requirePermission, isDirector } from "@/lib/auth/guard";
import { permKey } from "@/lib/auth/permissions";
import { PageHeader } from "@/components/layout/page-header";
import { QuoteBuilder } from "../quote-builder";
import { dateInputSP, loadBuilderData } from "../builder-data";

export default async function NewQuotePage({ searchParams }: PageProps<"/propostas/nova">) {
  const user = await requirePermission(permKey("CRM", "CREATE"));
  const sp = await searchParams;
  const leadId = typeof sp.lead === "string" ? sp.lead : null;
  const clientId = typeof sp.client === "string" ? sp.client : null;
  const data = await loadBuilderData(user.organizationId);

  const lead = leadId ? data.leads.find((l) => l.id === leadId) : undefined;
  const client = clientId ? data.clients.find((c) => c.id === clientId) : lead?.convertedClientId ? data.clients.find((c) => c.id === lead.convertedClientId) : undefined;
  const party = client ?? lead;

  return (
    <div>
      <PageHeader title="Novo orçamento" description="Escolha o cliente, adicione os serviços da tabela e envie o link personalizado." />
      <QuoteBuilder
        initial={{
          id: null,
          title: "",
          leadId: client ? null : (lead?.id ?? null),
          clientId: client?.id ?? null,
          recipientName: party?.contactName ?? "",
          recipientPhone: party?.phone ?? "",
          intro: "",
          notes: "",
          validUntil: dateInputSP(new Date(new Date().getTime() + data.settings.validityDays * 86400000)),
          currency: "BRL",
          discountPercent: 0,
          maxInstallments: null,
          items: [],
        }}
        leads={data.leads}
        clients={data.clients}
        services={data.catalog}
        config={data.settings.config}
        canManage={isDirector(user)}
      />
    </div>
  );
}
