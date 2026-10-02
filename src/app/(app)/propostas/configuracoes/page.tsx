import { requireDirector } from "@/lib/auth/guard";
import { PageHeader } from "@/components/layout/page-header";
import { SectionTabs } from "@/components/layout/section-tabs";
import { CRM_TABS, filterTabsForUser } from "@/lib/nav";
import { getPricingSettings } from "@/lib/pricing/settings";
import { PricingSettingsForm } from "./pricing-settings-form";

export default async function PricingSettingsPage() {
  const user = await requireDirector();
  const settings = await getPricingSettings(user.organizationId);

  return (
    <div>
      <PageHeader title="Taxas e pagamento" description="Taxas da maquininha, margem do crédito, mensagens prontas e os dados da Lumière que entram no contrato." />
      <SectionTabs tabs={filterTabsForUser(CRM_TABS, user.permissions)} />
      <PricingSettingsForm settings={settings} />
    </div>
  );
}
