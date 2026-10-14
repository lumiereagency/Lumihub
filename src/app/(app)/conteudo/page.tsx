import { requirePermission, hasPermission } from "@/lib/auth/guard";
import { permKey } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/layout/page-header";
import { BatchList } from "./batch-list";

export default async function ContentPage() {
  const user = await requirePermission(permKey("TASKS", "VIEW"));
  const [batches, clients] = await Promise.all([
    db.contentBatch.findMany({
      where: { organizationId: user.organizationId },
      orderBy: { createdAt: "desc" },
      include: { client: { select: { companyName: true } }, posts: { select: { status: true } } },
      take: 200,
    }),
    db.client.findMany({ where: { organizationId: user.organizationId, deletedAt: null }, select: { id: true, companyName: true }, orderBy: { companyName: "asc" } }),
  ]);
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Conteúdo" description="Calendário de posts de cada cliente, com aprovação por link: o cliente vê, aprova ou pede ajuste." />
      <BatchList
        clients={clients}
        canCreate={hasPermission(user, permKey("TASKS", "CREATE"))}
        batches={batches.map((b) => {
          const c = (s: string) => b.posts.filter((p) => p.status === s).length;
          return {
            id: b.id,
            name: b.name,
            client: b.client.companyName,
            sent: !!b.sentAt,
            total: b.posts.length,
            draft: c("RASCUNHO"),
            waiting: c("AGUARDANDO"),
            approved: c("APROVADO") + c("PUBLICADO"),
            adjust: c("AJUSTE"),
          };
        })}
      />
    </div>
  );
}
