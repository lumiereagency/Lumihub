import { redirect } from "next/navigation";
import { requireMediaMember, isMediaLeader } from "@/lib/auth/guard";
import { db } from "@/lib/db";
import { ensureMediaAdesfDefaults } from "@/lib/media/bootstrap";
import { PageHeader } from "@/components/layout/page-header";
import { BrandSettingsForm, BrandImagesPanel } from "@/components/media/brand-settings-form";
import { FunctionsPanel } from "@/components/media/functions-panel";

// Configurações de identidade visual e funções, gerenciadas pelo LÍDER de
// dentro do próprio portal (§13/§39) — não exige acesso à área
// administrativa da LUMIBASE.
export default async function MediaPortalSettingsPage() {
  const user = await requireMediaMember();
  if (!isMediaLeader(user)) redirect("/midia/inicio");
  await ensureMediaAdesfDefaults(user.organizationId);

  const [brand, functions] = await Promise.all([
    db.mediaBrandSettings.findUniqueOrThrow({ where: { organizationId: user.organizationId } }),
    db.mediaFunction.findMany({
      where: { organizationId: user.organizationId },
      orderBy: { displayOrder: "asc" },
      include: { _count: { select: { memberFunctions: true } } },
    }),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="Configurações" description="Identidade visual e funções da equipe de mídia." />

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
    </div>
  );
}
