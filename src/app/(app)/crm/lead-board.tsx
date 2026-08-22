"use client";

import { useMemo, useState, useTransition } from "react";
import { Plus, Phone, AtSign, AlertCircle, Building2 } from "lucide-react";
import { LEAD_STAGES, LEAD_STAGE_LABELS } from "@/lib/validation/crm";
import {
  createLeadAction,
  updateLeadAction,
  updateLeadStageAction,
  deleteLeadAction,
  convertLeadToClientAction,
} from "@/lib/actions/crm-actions";
import { formatCurrency, formatDate } from "@/lib/format";
import { cn } from "@/lib/cn";
import { Drawer } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MetricCard } from "@/components/ui/metric-card";
import { EmptyState } from "@/components/ui/empty-state";
import { LeadForm, type LeadFormValues } from "./lead-form";

interface LeadRow {
  id: string;
  company: string;
  contactName: string | null;
  phone: string | null;
  whatsapp: string | null;
  instagram: string | null;
  website: string | null;
  city: string | null;
  segment: string | null;
  source: string | null;
  ownerUserId: string | null;
  owner: { id: string; name: string } | null;
  potentialValue: number | null;
  probability: number;
  stage: string;
  nextContactAt: string | null;
  lastContactAt: string | null;
  notes: string | null;
  convertedClientId: string | null;
  createdAt: string;
}

interface Permissions {
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canManage: boolean;
}

function toFormValues(lead: LeadRow): LeadFormValues {
  return {
    company: lead.company,
    contactName: lead.contactName,
    phone: lead.phone,
    whatsapp: lead.whatsapp,
    instagram: lead.instagram,
    website: lead.website,
    city: lead.city,
    segment: lead.segment,
    source: lead.source,
    ownerUserId: lead.ownerUserId,
    potentialValue: lead.potentialValue,
    probability: lead.probability,
    stage: lead.stage,
    nextContactAt: lead.nextContactAt,
    notes: lead.notes,
  };
}

function isOverdue(lead: LeadRow): boolean {
  if (lead.stage === "FECHADO" || lead.stage === "PERDIDO") return false;
  if (!lead.nextContactAt) return true;
  return new Date(lead.nextContactAt).getTime() < Date.now();
}

export function LeadBoard({
  leads,
  users,
  currency,
  permissions,
}: {
  leads: LeadRow[];
  users: { id: string; name: string }[];
  currency: string;
  permissions: Permissions;
}) {
  const [creating, setCreating] = useState(false);
  const [editingLeadId, setEditingLeadId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  // Deriva o lead do prop `leads` (sempre atualizado após revalidatePath) em
  // vez de guardar uma cópia local, que ficaria desatualizada após salvar.
  const editingLead = editingLeadId ? (leads.find((l) => l.id === editingLeadId) ?? null) : null;

  const stats = useMemo(() => {
    const open = leads.filter((l) => l.stage !== "FECHADO" && l.stage !== "PERDIDO");
    const pipelineTotal = open.reduce((sum, l) => sum + (l.potentialValue ?? 0), 0);
    const pipelineWeighted = open.reduce(
      (sum, l) => sum + ((l.potentialValue ?? 0) * l.probability) / 100,
      0,
    );
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const newThisMonth = leads.filter((l) => new Date(l.createdAt) >= monthStart).length;
    const closedTotal = leads.filter((l) => l.stage === "FECHADO").length;
    const lostTotal = leads.filter((l) => l.stage === "PERDIDO").length;
    const conversion = closedTotal + lostTotal > 0 ? Math.round((closedTotal / (closedTotal + lostTotal)) * 100) : 0;
    const followUpDue = open.filter(isOverdue).length;
    return { pipelineTotal, pipelineWeighted, newThisMonth, closedTotal, conversion, followUpDue };
  }, [leads]);

  const columns = useMemo(
    () => LEAD_STAGES.map((stage) => ({ stage, items: leads.filter((l) => l.stage === stage) })),
    [leads],
  );

  function handleStageChange(leadId: string, stage: string) {
    startTransition(() => updateLeadStageAction(leadId, stage));
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-6">
        <MetricCard label="Pipeline total" value={formatCurrency(stats.pipelineTotal, currency)} tone="gold" />
        <MetricCard label="Pipeline ponderado" value={formatCurrency(stats.pipelineWeighted, currency)} />
        <MetricCard label="Novos leads (mês)" value={String(stats.newThisMonth)} />
        <MetricCard label="Fechamentos" value={String(stats.closedTotal)} />
        <MetricCard label="Conversão" value={`${stats.conversion}%`} />
        <MetricCard
          label="Sem follow-up"
          value={String(stats.followUpDue)}
          icon={stats.followUpDue > 0 ? <AlertCircle size={16} /> : undefined}
        />
      </div>

      {permissions.canCreate && (
        <div className="flex justify-end">
          <Button onClick={() => setCreating(true)}>
            <Plus size={16} /> Novo Lead
          </Button>
        </div>
      )}

      {leads.length === 0 ? (
        <EmptyState
          icon={<Building2 size={28} />}
          title="Nenhum lead cadastrado ainda"
          description="Cadastre seu primeiro lead para começar a construir o pipeline comercial."
          action={
            permissions.canCreate && (
              <Button onClick={() => setCreating(true)}>
                <Plus size={16} /> Adicionar lead
              </Button>
            )
          }
        />
      ) : (
        <div className="scrollbar-thin flex gap-4 overflow-x-auto pb-2">
          {columns.map((col) => {
            const columnTotal = col.items.reduce((sum, l) => sum + (l.potentialValue ?? 0), 0);
            return (
              <div key={col.stage} className="flex w-72 shrink-0 flex-col gap-3">
                <div className="flex items-center justify-between px-1">
                  <span className="text-sm font-semibold text-text-primary">{LEAD_STAGE_LABELS[col.stage]}</span>
                  <span className="text-xs text-text-tertiary">{col.items.length}</span>
                </div>
                <span className="-mt-2 px-1 text-xs text-text-tertiary">{formatCurrency(columnTotal, currency)}</span>
                <div className="flex flex-col gap-2">
                  {col.items.map((lead) => (
                    <button
                      key={lead.id}
                      type="button"
                      onClick={() => setEditingLeadId(lead.id)}
                      className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-3.5 text-left transition-colors hover:border-gold/40"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-sm font-medium text-text-primary">{lead.company}</span>
                        {isOverdue(lead) && <AlertCircle size={14} className="mt-0.5 shrink-0 text-warning" />}
                      </div>
                      {lead.contactName && <span className="text-xs text-text-tertiary">{lead.contactName}</span>}
                      <div className="flex flex-wrap items-center gap-1.5">
                        {lead.potentialValue != null && (
                          <Badge tone="gold">{formatCurrency(lead.potentialValue, currency)}</Badge>
                        )}
                        <Badge tone="neutral">{lead.probability}%</Badge>
                      </div>
                      <div className="flex items-center justify-between text-xs text-text-tertiary">
                        <span className="flex items-center gap-1">
                          {lead.phone && <Phone size={12} />}
                          {lead.instagram && <AtSign size={12} />}
                        </span>
                        <span className={cn(isOverdue(lead) && "text-warning")}>
                          {lead.nextContactAt ? formatDate(new Date(lead.nextContactAt)) : "Sem contato agendado"}
                        </span>
                      </div>
                      {lead.owner && <span className="text-xs text-text-tertiary">{lead.owner.name}</span>}
                      {permissions.canEdit && (
                        <select
                          value={lead.stage}
                          disabled={isPending}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => {
                            e.stopPropagation();
                            handleStageChange(lead.id, e.target.value);
                          }}
                          className="mt-1 h-8 rounded-[8px] border border-border bg-card-elevated px-2 text-xs text-text-secondary"
                        >
                          {LEAD_STAGES.map((s) => (
                            <option key={s} value={s}>
                              Mover para: {LEAD_STAGE_LABELS[s]}
                            </option>
                          ))}
                        </select>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Drawer open={creating} onClose={() => setCreating(false)} title="Novo Lead">
        <LeadForm action={createLeadAction} users={users} submitLabel="Cadastrar lead" onSuccess={() => setCreating(false)} />
      </Drawer>

      <Drawer
        open={!!editingLead}
        onClose={() => setEditingLeadId(null)}
        title={editingLead?.company ?? ""}
        description={editingLead?.convertedClientId ? "Convertido em cliente" : undefined}
      >
        {editingLead && (
          <div className="flex flex-col gap-6">
            <LeadForm
              key={editingLead.id}
              action={updateLeadAction.bind(null, editingLead.id)}
              defaultValues={toFormValues(editingLead)}
              users={users}
              submitLabel="Salvar alterações"
            />
            <div className="flex flex-col gap-2 border-t border-border pt-4">
              {permissions.canManage && editingLead.stage === "FECHADO" && !editingLead.convertedClientId && (
                <Button
                  variant="secondary"
                  onClick={() =>
                    startTransition(async () => {
                      await convertLeadToClientAction(editingLead.id);
                      setEditingLeadId(null);
                    })
                  }
                >
                  Converter em cliente
                </Button>
              )}
              {permissions.canDelete && (
                <Button
                  variant="danger"
                  onClick={() =>
                    startTransition(async () => {
                      await deleteLeadAction(editingLead.id);
                      setEditingLeadId(null);
                    })
                  }
                >
                  Excluir lead
                </Button>
              )}
            </div>
          </div>
        )}
      </Drawer>
    </div>
  );
}
