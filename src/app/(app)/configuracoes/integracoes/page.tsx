import { requirePermission, hasPermission } from "@/lib/auth/guard";
import { permKey } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/layout/page-header";
import { IntegrationsView } from "./integrations-view";
import type { IntegrationState } from "./provider-card";

export default async function IntegrationsPage() {
  const user = await requirePermission(permKey("INTEGRATIONS", "VIEW"));

  const integrations = await db.integration.findMany({
    where: { organizationId: user.organizationId },
    include: { credentials: true },
  });

  const integrationsByProvider: Record<string, IntegrationState> = {};
  for (const integration of integrations) {
    integrationsByProvider[integration.provider] = {
      id: integration.id,
      status: integration.status,
      config: (integration.config as Record<string, string> | null) ?? {},
      connectedAt: integration.connectedAt?.toISOString() ?? null,
      credentialPreviews: Object.fromEntries(integration.credentials.map((c) => [c.label, c.maskedPreview])),
    };
  }

  const canManage = hasPermission(user, permKey("INTEGRATIONS", "MANAGE"));

  return (
    <div>
      <PageHeader
        title="Integrações"
        description="Calendário, comunicação, financeiro, IA, armazenamento e automação. Credenciais sempre criptografadas no LUMIHUB Vault."
      />
      <IntegrationsView integrationsByProvider={integrationsByProvider} canManage={canManage} />
    </div>
  );
}
