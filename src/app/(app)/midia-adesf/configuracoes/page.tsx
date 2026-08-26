import { requirePermission } from "@/lib/auth/guard";
import { permKey } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import { ensureMediaAdesfDefaults } from "@/lib/media/bootstrap";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { BrandSettingsForm, BrandImagesPanel } from "@/components/media/brand-settings-form";
import { FunctionsPanel } from "@/components/media/functions-panel";
import { AIWeightsForm } from "@/components/media/ai-weights-form";

export default async function MediaAdesfSettingsPage() {
  const user = await requirePermission(permKey("MEDIA_ADESF", "MANAGE"));
  await ensureMediaAdesfDefaults(user.organizationId);

  const [brand, functions, rolesWithAccess, operationsSettings] = await Promise.all([
    db.mediaBrandSettings.findUniqueOrThrow({ where: { organizationId: user.organizationId } }),
    db.mediaFunction.findMany({
      where: { organizationId: user.organizationId },
      orderBy: { displayOrder: "asc" },
      include: { _count: { select: { memberFunctions: true } } },
    }),
    db.role.findMany({
      where: {
        organizationId: user.organizationId,
        permissions: { some: { permission: { key: permKey("MEDIA_ADESF", "VIEW") } } },
      },
      include: { _count: { select: { users: true } } },
    }),
    db.mediaOperationsSettings.upsert({ where: { organizationId: user.organizationId }, create: { organizationId: user.organizationId }, update: {} }),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="Configurações — Mídia ADESF" description="Identidade visual, funções da equipe e visão geral de acesso." />

      <section>
        <h2 className="mb-3 text-lg font-semibold text-text-primary">Identidade visual</h2>
        <div className="flex flex-col gap-4">
          <BrandSettingsForm
            environmentName={brand.environmentName}
            primaryColor={brand.primaryColor}
            secondaryColor={brand.secondaryColor}
            gradientStart={brand.gradientStart}
            gradientEnd={brand.gradientEnd}
          />
          <BrandImagesPanel
            current={{
              logoUrl: brand.logoUrl,
              logoLightUrl: brand.logoLightUrl,
              logoDarkUrl: brand.logoDarkUrl,
              faviconUrl: brand.faviconUrl,
            }}
          />
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-text-primary">Funções</h2>
        <FunctionsPanel
          functions={functions.map((f) => ({
            id: f.id,
            name: f.name,
            description: f.description,
            active: f.active,
            membersCount: f._count.memberFunctions,
          }))}
        />
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-text-primary">Inteligência artificial da escala</h2>
        <AIWeightsForm
          aiWeightWorkload={operationsSettings.aiWeightWorkload}
          aiWeightRecency={operationsSettings.aiWeightRecency}
          aiWeightPreference={operationsSettings.aiWeightPreference}
          aiMinRestDays={operationsSettings.aiMinRestDays}
        />
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-text-primary">Acesso administrativo</h2>
        <p className="mb-3 text-sm text-text-tertiary">
          Perfis do LUMIBASE com acesso à área administrativa do Mídia ADESF (gestão de equipe, funções e configurações — diferente do
          acesso ao Portal Mídia ADESF, que é por convite individual).
        </p>
        <div className="flex flex-col gap-2">
          {rolesWithAccess.map((role) => (
            <div key={role.id} className="flex items-center justify-between rounded-[10px] border border-border bg-card px-4 py-2.5 text-sm">
              <span className="text-text-primary">{role.name}</span>
              <Badge tone="neutral">{role._count.users} usuário(s)</Badge>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
