import { requirePermission, hasPermission } from "@/lib/auth/guard";
import { permKey } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/layout/page-header";
import { DocumentList } from "./document-list";

export default async function DocumentsPage() {
  const user = await requirePermission(permKey("DOCUMENTS", "VIEW"));

  const [documents, clients, projects] = await Promise.all([
    db.document.findMany({
      where: { organizationId: user.organizationId },
      orderBy: { createdAt: "desc" },
      include: { client: { select: { companyName: true } }, project: { select: { name: true } }, uploadedBy: { select: { name: true } } },
    }),
    db.client.findMany({
      where: { organizationId: user.organizationId, deletedAt: null },
      select: { id: true, companyName: true },
      orderBy: { companyName: "asc" },
    }),
    db.project.findMany({
      where: { organizationId: user.organizationId, deletedAt: null },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const permissions = {
    canCreate: hasPermission(user, permKey("DOCUMENTS", "CREATE")),
    canEdit: hasPermission(user, permKey("DOCUMENTS", "EDIT")),
    canDelete: hasPermission(user, permKey("DOCUMENTS", "DELETE")),
  };

  return (
    <div>
      <PageHeader title="Documentos" description="Contratos, propostas, briefings, comprovantes e notas fiscais." />
      <DocumentList
        documents={documents.map((d) => ({
          id: d.id,
          name: d.name,
          category: d.category,
          clientId: d.clientId,
          clientName: d.client?.companyName ?? null,
          projectId: d.projectId,
          projectName: d.project?.name ?? null,
          mimeType: d.mimeType,
          size: d.size,
          uploadedByName: d.uploadedBy?.name ?? null,
          createdAt: d.createdAt.toISOString(),
        }))}
        clients={clients}
        projects={projects}
        permissions={permissions}
      />
    </div>
  );
}
