import { PROVIDER_CATALOG, CATEGORY_LABELS } from "@/lib/integrations/providers";
import type { IntegrationCategory } from "@/generated/prisma/enums";
import { ProviderCard, type IntegrationState } from "./provider-card";

export function IntegrationsView({
  integrationsByProvider,
  canManage,
}: {
  integrationsByProvider: Record<string, IntegrationState>;
  canManage: boolean;
}) {
  const categories = [...new Set(PROVIDER_CATALOG.map((p) => p.category))] as IntegrationCategory[];

  return (
    <div className="flex flex-col gap-8">
      {categories.map((category) => (
        <div key={category} className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-text-tertiary">{CATEGORY_LABELS[category]}</h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {PROVIDER_CATALOG.filter((p) => p.category === category).map((provider) => (
              <ProviderCard key={provider.key} provider={provider} state={integrationsByProvider[provider.key] ?? null} canManage={canManage} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
