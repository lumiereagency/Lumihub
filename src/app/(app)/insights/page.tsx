import { requirePermission } from "@/lib/auth/guard";
import { permKey } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import { getConnectedAiProvider } from "@/lib/ai/providers";
import { PageHeader } from "@/components/layout/page-header";
import { InsightList } from "./insight-list";

export default async function InsightsPage() {
  const user = await requirePermission(permKey("AI", "VIEW"));

  const [insights, provider] = await Promise.all([
    db.aiInsight.findMany({
      where: { organizationId: user.organizationId },
      orderBy: { generatedAt: "desc" },
    }),
    getConnectedAiProvider(user.organizationId),
  ]);

  return (
    <div>
      <PageHeader title="Insights" description="Riscos, oportunidades e recomendações geradas a partir dos dados reais." />
      <InsightList
        insights={insights.map((i) => ({
          id: i.id,
          type: i.type,
          title: i.title,
          description: i.description,
          severity: i.severity,
          generatedAt: i.generatedAt.toISOString(),
          dismissedAt: i.dismissedAt?.toISOString() ?? null,
        }))}
        hasProvider={!!provider}
      />
    </div>
  );
}
