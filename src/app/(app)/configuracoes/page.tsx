import { requirePermission } from "@/lib/auth/guard";
import { permKey } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/layout/page-header";
import { OrganizationSettingsForm } from "./organization-settings-form";

export default async function SettingsPage() {
  const user = await requirePermission(permKey("SETTINGS", "VIEW"));

  const organization = await db.organization.findUniqueOrThrow({
    where: { id: user.organizationId },
    select: { name: true, timezone: true, currency: true, locale: true },
  });

  return (
    <div>
      <PageHeader title="Configurações" description="Preferências gerais da organização: fuso horário, moeda e idioma." />
      <OrganizationSettingsForm defaultValues={organization} />
    </div>
  );
}
