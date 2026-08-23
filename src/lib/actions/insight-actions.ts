"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth/guard";
import { permKey } from "@/lib/auth/permissions";
import { audit } from "@/lib/audit";
import { generateInsights } from "@/lib/ai/insights";
import type { ActionState } from "@/lib/actions/auth-actions";

// Sem campos de formulário — useActionState exige a assinatura (state, payload)
// mesmo quando o botão não envia dados além do clique.
export async function generateInsightsAction(_prev: ActionState, _formData: FormData): Promise<ActionState> {
  void _prev;
  void _formData;
  const user = await requirePermission(permKey("AI", "VIEW"));

  const organization = await db.organization.findUniqueOrThrow({ where: { id: user.organizationId }, select: { name: true } });

  let insights;
  try {
    insights = await generateInsights(user, organization.name);
  } catch (err) {
    return { error: (err as Error).message };
  }

  if (insights.length > 0) {
    await db.aiInsight.createMany({
      data: insights.map((i) => ({
        organizationId: user.organizationId,
        type: i.type,
        title: i.title,
        description: i.description,
        severity: i.severity,
      })),
    });
  }

  await audit({
    organizationId: user.organizationId,
    userId: user.id,
    action: "AI_INSIGHTS_GENERATED",
    entityType: "AiInsight",
    metadata: { count: insights.length },
  });

  revalidatePath("/insights");
  return { success: insights.length > 0 ? `${insights.length} novo(s) insight(s) gerado(s).` : "Nenhum insight novo identificado com os dados atuais." };
}

export async function dismissInsightAction(insightId: string): Promise<void> {
  const user = await requirePermission(permKey("AI", "VIEW"));

  const insight = await db.aiInsight.findFirst({ where: { id: insightId, organizationId: user.organizationId } });
  if (!insight || insight.dismissedAt) return;

  await db.aiInsight.update({ where: { id: insightId }, data: { dismissedAt: new Date() } });

  await audit({
    organizationId: user.organizationId,
    userId: user.id,
    action: "AI_INSIGHT_DISMISSED",
    entityType: "AiInsight",
    entityId: insightId,
  });

  revalidatePath("/insights");
}
