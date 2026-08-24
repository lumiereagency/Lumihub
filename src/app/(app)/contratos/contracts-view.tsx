"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Plus, FileText, Trash2, Eye, LayoutTemplate } from "lucide-react";
import { createContractAction, updateContractAction, deleteContractTemplateAction } from "@/lib/actions/contract-actions";
import { CONTRACT_TYPE_LABELS, CONTRACT_STATUS_LABELS, RECURRENCE_LABELS } from "@/lib/validation/contracts";
import { formatCurrency, formatDate } from "@/lib/format";
import { Drawer } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { ContractForm, type ContractFormValues } from "./contract-form";
import { TemplateForm } from "./template-form";

interface ContractRow {
  id: string;
  title: string;
  type: string;
  value: number;
  recurrence: string;
  startDate: string;
  endDate: string | null;
  status: string;
  generatedBody: string | null;
  client: { id: string; companyName: string };
  templateId: string | null;
}

interface TemplateRow {
  id: string;
  name: string;
  type: string;
  bodyTemplate: string;
}

const STATUS_TONE: Record<string, "success" | "neutral" | "info" | "error"> = {
  RASCUNHO: "neutral",
  AGUARDANDO_ASSINATURA: "info",
  ATIVO: "success",
  ENCERRADO: "neutral",
  CANCELADO: "error",
};

function toFormValues(contract: ContractRow): ContractFormValues {
  return {
    clientId: contract.client.id,
    templateId: contract.templateId,
    title: contract.title,
    type: contract.type,
    value: contract.value,
    recurrence: contract.recurrence,
    startDate: contract.startDate,
    endDate: contract.endDate,
    status: contract.status,
  };
}

export function ContractsView({
  contracts,
  clients,
  templates,
  currency,
  permissions,
}: {
  contracts: ContractRow[];
  clients: { id: string; companyName: string }[];
  templates: TemplateRow[];
  currency: string;
  permissions: { canCreate: boolean; canEdit: boolean; canManageTemplates: boolean };
}) {
  const [tab, setTab] = useState<"contratos" | "modelos">("contratos");
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [creatingTemplate, setCreatingTemplate] = useState(false);
  const [, startTransition] = useTransition();

  const editing = editingId ? contracts.find((c) => c.id === editingId) : null;
  const preview = previewId ? contracts.find((c) => c.id === previewId) : null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-1 rounded-[10px] border border-border bg-card p-1 w-fit">
        <button
          type="button"
          onClick={() => setTab("contratos")}
          className={`rounded-[8px] px-3 py-1.5 text-sm ${tab === "contratos" ? "bg-card-elevated text-accent-light" : "text-text-secondary"}`}
        >
          Contratos
        </button>
        <button
          type="button"
          onClick={() => setTab("modelos")}
          className={`rounded-[8px] px-3 py-1.5 text-sm ${tab === "modelos" ? "bg-card-elevated text-accent-light" : "text-text-secondary"}`}
        >
          Modelos
        </button>
      </div>

      {tab === "contratos" ? (
        <div className="flex flex-col gap-4">
          {permissions.canCreate && (
            <div className="flex justify-end">
              <Button onClick={() => setCreating(true)} disabled={clients.length === 0}>
                <Plus size={16} /> Novo Contrato
              </Button>
            </div>
          )}

          {clients.length === 0 && (
            <p className="text-sm text-text-tertiary">Cadastre um cliente antes de criar um contrato.</p>
          )}

          {contracts.length === 0 ? (
            <EmptyState
              icon={<FileText size={28} />}
              title="Nenhum contrato cadastrado ainda"
              description="Gere contratos a partir dos dados de um cliente, com ou sem um modelo."
            />
          ) : (
            <div className="overflow-hidden rounded-2xl border border-border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-bg-secondary text-left text-xs uppercase tracking-wide text-text-tertiary">
                    <th className="px-4 py-3 font-medium">Contrato</th>
                    <th className="px-4 py-3 font-medium">Cliente</th>
                    <th className="px-4 py-3 font-medium">Valor</th>
                    <th className="px-4 py-3 font-medium">Início</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium" />
                  </tr>
                </thead>
                <tbody>
                  {contracts.map((c) => (
                    <tr key={c.id} className="border-b border-border last:border-0 hover:bg-card">
                      <td className="px-4 py-3">
                        <p className="font-medium text-text-primary">{c.title}</p>
                        <p className="text-xs text-text-tertiary">
                          {CONTRACT_TYPE_LABELS[c.type as keyof typeof CONTRACT_TYPE_LABELS] ?? c.type} ·{" "}
                          {RECURRENCE_LABELS[c.recurrence as keyof typeof RECURRENCE_LABELS] ?? c.recurrence}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <Link href={`/clientes/${c.client.id}`} className="text-text-secondary hover:text-accent-light">
                          {c.client.companyName}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-text-secondary">{formatCurrency(c.value, currency)}</td>
                      <td className="px-4 py-3 text-text-secondary">{formatDate(new Date(c.startDate))}</td>
                      <td className="px-4 py-3">
                        <Badge tone={STATUS_TONE[c.status] ?? "neutral"}>
                          {CONTRACT_STATUS_LABELS[c.status as keyof typeof CONTRACT_STATUS_LABELS] ?? c.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          {c.generatedBody && (
                            <button
                              type="button"
                              onClick={() => setPreviewId(c.id)}
                              className="rounded-[8px] p-1.5 text-text-tertiary hover:bg-card-elevated hover:text-text-primary"
                              aria-label="Visualizar contrato"
                            >
                              <Eye size={16} />
                            </button>
                          )}
                          {permissions.canEdit && (
                            <button
                              type="button"
                              onClick={() => setEditingId(c.id)}
                              className="rounded-[8px] px-2 py-1 text-xs text-text-secondary hover:bg-card-elevated hover:text-text-primary"
                            >
                              Editar
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
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {permissions.canManageTemplates && (
            <div className="flex justify-end">
              <Button onClick={() => setCreatingTemplate(true)}>
                <Plus size={16} /> Novo Modelo
              </Button>
            </div>
          )}

          {templates.length === 0 ? (
            <EmptyState
              icon={<LayoutTemplate size={28} />}
              title="Nenhum modelo cadastrado"
              description="Crie modelos reutilizáveis (Cliente, Freelancer, UGC, Audiovisual, Social Media, Tráfego, Design, Desenvolvimento...) para gerar contratos automaticamente."
            />
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {templates.map((t) => (
                <div key={t.id} className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-4">
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-sm font-medium text-text-primary">{t.name}</span>
                    {permissions.canManageTemplates && (
                      <button
                        type="button"
                        onClick={() => startTransition(() => deleteContractTemplateAction(t.id))}
                        className="text-text-tertiary hover:text-error"
                        aria-label="Excluir modelo"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                  <Badge tone="neutral" className="w-fit">
                    {CONTRACT_TYPE_LABELS[t.type as keyof typeof CONTRACT_TYPE_LABELS] ?? t.type}
                  </Badge>
                  <p className="line-clamp-3 text-xs text-text-tertiary">{t.bodyTemplate}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <Drawer open={creating} onClose={() => setCreating(false)} title="Novo Contrato">
        <ContractForm
          action={createContractAction}
          clients={clients}
          templates={templates}
          submitLabel="Criar contrato"
          onSuccess={() => setCreating(false)}
        />
      </Drawer>

      <Drawer open={!!editing} onClose={() => setEditingId(null)} title={editing?.title ?? ""}>
        {editing && (
          <ContractForm
            key={editing.id}
            action={updateContractAction.bind(null, editing.id)}
            defaultValues={toFormValues(editing)}
            clients={clients}
            templates={templates}
            submitLabel="Salvar alterações"
          />
        )}
      </Drawer>

      <Drawer open={!!preview} onClose={() => setPreviewId(null)} title="Contrato gerado" widthClassName="max-w-[640px]">
        {preview?.generatedBody && (
          <pre className="scrollbar-thin whitespace-pre-wrap rounded-[10px] border border-border bg-card p-4 text-sm text-text-secondary">
            {preview.generatedBody}
          </pre>
        )}
      </Drawer>

      <Drawer open={creatingTemplate} onClose={() => setCreatingTemplate(false)} title="Novo Modelo de Contrato">
        <TemplateForm onSuccess={() => setCreatingTemplate(false)} />
      </Drawer>
    </div>
  );
}
