"use client";

import { useMemo, useState, useTransition } from "react";
import { Plus, FileText, Download, Pencil, Trash2 } from "lucide-react";
import { deleteDocumentAction } from "@/lib/actions/document-actions";
import { DOCUMENT_CATEGORIES, DOCUMENT_CATEGORY_LABELS } from "@/lib/validation/documents";
import { formatDate, formatFileSize } from "@/lib/format";
import { Drawer } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { EmptyState } from "@/components/ui/empty-state";
import { DocumentUploadForm } from "./document-upload-form";
import { DocumentEditForm } from "./document-edit-form";

interface DocumentRow {
  id: string;
  name: string;
  category: string;
  clientId: string | null;
  clientName: string | null;
  projectId: string | null;
  projectName: string | null;
  mimeType: string;
  size: number;
  uploadedByName: string | null;
  createdAt: string;
}

interface Permissions {
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
}

export function DocumentList({
  documents,
  clients,
  projects,
  permissions,
}: {
  documents: DocumentRow[];
  clients: { id: string; companyName: string }[];
  projects: { id: string; name: string }[];
  permissions: Permissions;
}) {
  const [uploading, setUploading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [, startTransition] = useTransition();

  const editing = editingId ? (documents.find((d) => d.id === editingId) ?? null) : null;

  const filtered = useMemo(() => {
    return documents.filter((d) => {
      if (categoryFilter && d.category !== categoryFilter) return false;
      if (search.trim()) {
        const term = search.toLowerCase();
        if (!d.name.toLowerCase().includes(term) && !(d.clientName ?? "").toLowerCase().includes(term)) return false;
      }
      return true;
    });
  }, [documents, search, categoryFilter]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <Input placeholder="Buscar por nome ou cliente..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-64" />
          <Select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="w-56">
            <option value="">Todas as categorias</option>
            {DOCUMENT_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {DOCUMENT_CATEGORY_LABELS[c]}
              </option>
            ))}
          </Select>
        </div>
        {permissions.canCreate && (
          <Button onClick={() => setUploading(true)}>
            <Plus size={16} /> Enviar documento
          </Button>
        )}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<FileText size={28} />}
          title={documents.length === 0 ? "Nenhum documento enviado ainda" : "Nenhum documento encontrado"}
          action={
            permissions.canCreate &&
            documents.length === 0 && (
              <Button onClick={() => setUploading(true)}>
                <Plus size={16} /> Enviar documento
              </Button>
            )
          }
        />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-bg-secondary text-left text-xs uppercase tracking-wide text-text-tertiary">
                <th className="px-4 py-3 font-medium">Nome</th>
                <th className="px-4 py-3 font-medium">Categoria</th>
                <th className="px-4 py-3 font-medium">Vínculo</th>
                <th className="px-4 py-3 font-medium">Tamanho</th>
                <th className="px-4 py-3 font-medium">Enviado</th>
                <th className="px-4 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((d) => (
                <tr key={d.id} className="border-b border-border last:border-0 hover:bg-card">
                  <td className="px-4 py-3 text-text-primary">{d.name}</td>
                  <td className="px-4 py-3">
                    <Badge tone="neutral">{DOCUMENT_CATEGORY_LABELS[d.category as (typeof DOCUMENT_CATEGORIES)[number]]}</Badge>
                  </td>
                  <td className="px-4 py-3 text-text-secondary">{d.clientName ?? d.projectName ?? "—"}</td>
                  <td className="px-4 py-3 text-text-secondary">{formatFileSize(d.size)}</td>
                  <td className="px-4 py-3 text-text-secondary">
                    {formatDate(new Date(d.createdAt))}
                    {d.uploadedByName && <span className="text-text-tertiary"> · {d.uploadedByName}</span>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <a
                        href={`/api/documentos/${d.id}`}
                        className="rounded-[8px] p-1.5 text-text-tertiary hover:bg-card-elevated hover:text-text-primary"
                        aria-label="Baixar"
                      >
                        <Download size={15} />
                      </a>
                      {permissions.canEdit && (
                        <button
                          type="button"
                          onClick={() => setEditingId(d.id)}
                          className="rounded-[8px] p-1.5 text-text-tertiary hover:bg-card-elevated hover:text-text-primary"
                          aria-label="Editar"
                        >
                          <Pencil size={15} />
                        </button>
                      )}
                      {permissions.canDelete && (
                        <button
                          type="button"
                          onClick={() => {
                            if (confirm(`Excluir "${d.name}"?`)) startTransition(() => deleteDocumentAction(d.id));
                          }}
                          className="rounded-[8px] p-1.5 text-text-tertiary hover:bg-card-elevated hover:text-error"
                          aria-label="Excluir"
                        >
                          <Trash2 size={15} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Drawer open={uploading} onClose={() => setUploading(false)} title="Enviar documento">
        <DocumentUploadForm clients={clients} projects={projects} onSuccess={() => setUploading(false)} />
      </Drawer>

      <Drawer open={!!editing} onClose={() => setEditingId(null)} title={editing?.name ?? ""}>
        {editing && (
          <DocumentEditForm
            key={editing.id}
            documentId={editing.id}
            defaultValues={{ name: editing.name, category: editing.category, clientId: editing.clientId, projectId: editing.projectId }}
            clients={clients}
            projects={projects}
            onSuccess={() => setEditingId(null)}
          />
        )}
      </Drawer>
    </div>
  );
}
