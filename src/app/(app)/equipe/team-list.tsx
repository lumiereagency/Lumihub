"use client";

import { useMemo, useState } from "react";
import { Plus, Search, UserSquare2 } from "lucide-react";
import { createTeamMemberAction, updateTeamMemberAction } from "@/lib/actions/team-actions";
import { TEAM_MEMBER_TYPE_LABELS } from "@/lib/validation/team";
import { PAYMENT_METHOD_LABELS } from "@/lib/validation/shared";
import { formatCurrency } from "@/lib/format";
import { Drawer } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { TeamMemberForm, type TeamMemberFormValues } from "./team-form";

interface MemberRow {
  id: string;
  name: string;
  role: string;
  type: string;
  userId: string | null;
  paymentValue: number | null;
  paymentMethod: string | null;
  paymentDay: number | null;
  active: boolean;
  projectsCount: number;
}

function toFormValues(m: MemberRow): TeamMemberFormValues {
  return {
    name: m.name,
    role: m.role,
    type: m.type,
    userId: m.userId,
    paymentValue: m.paymentValue,
    paymentMethod: m.paymentMethod,
    paymentDay: m.paymentDay,
    active: m.active,
  };
}

export function TeamList({
  members,
  availableUsers,
  currency,
  permissions,
  typeFilter,
  emptyLabel,
  createLabel,
}: {
  members: MemberRow[];
  availableUsers: { id: string; name: string }[];
  currency: string;
  permissions: { canCreate: boolean; canEdit: boolean };
  typeFilter?: string[];
  emptyLabel: string;
  createLabel: string;
}) {
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const scoped = useMemo(
    () => (typeFilter ? members.filter((m) => typeFilter.includes(m.type)) : members),
    [members, typeFilter],
  );

  const filtered = useMemo(() => {
    if (!search.trim()) return scoped;
    const q = search.toLowerCase();
    return scoped.filter((m) => m.name.toLowerCase().includes(q) || m.role.toLowerCase().includes(q));
  }, [scoped, search]);

  const editing = editingId ? members.find((m) => m.id === editingId) : null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" />
          <Input placeholder="Buscar por nome ou função..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-64 pl-9" />
        </div>
        {permissions.canCreate && (
          <Button onClick={() => setCreating(true)}>
            <Plus size={16} /> {createLabel}
          </Button>
        )}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<UserSquare2 size={28} />}
          title={emptyLabel}
          action={
            permissions.canCreate && (
              <Button onClick={() => setCreating(true)}>
                <Plus size={16} /> {createLabel}
              </Button>
            )
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-bg-secondary text-left text-xs uppercase tracking-wide text-text-tertiary">
                <th className="px-4 py-3 font-medium">Nome</th>
                <th className="px-4 py-3 font-medium">Tipo</th>
                <th className="px-4 py-3 font-medium">Pagamento</th>
                <th className="px-4 py-3 font-medium">Projetos</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((m) => (
                <tr key={m.id} className="border-b border-border last:border-0 hover:bg-card">
                  <td className="px-4 py-3">
                    <p className="font-medium text-text-primary">{m.name}</p>
                    <p className="text-xs text-text-tertiary">{m.role}</p>
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone="neutral">{TEAM_MEMBER_TYPE_LABELS[m.type as keyof typeof TEAM_MEMBER_TYPE_LABELS] ?? m.type}</Badge>
                  </td>
                  <td className="px-4 py-3 text-text-secondary">
                    {m.paymentValue != null ? formatCurrency(m.paymentValue, currency) : "—"}
                    {m.paymentMethod && (
                      <span className="block text-xs text-text-tertiary">
                        {PAYMENT_METHOD_LABELS[m.paymentMethod as keyof typeof PAYMENT_METHOD_LABELS] ?? m.paymentMethod}
                        {m.paymentDay ? ` · dia ${m.paymentDay}` : ""}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-text-secondary">{m.projectsCount}</td>
                  <td className="px-4 py-3">
                    <Badge tone={m.active ? "success" : "neutral"}>{m.active ? "Ativo" : "Inativo"}</Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {permissions.canEdit && (
                      <button
                        type="button"
                        onClick={() => setEditingId(m.id)}
                        className="rounded-[8px] px-2 py-1 text-xs text-text-secondary hover:bg-card-elevated hover:text-text-primary"
                      >
                        Editar
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Drawer open={creating} onClose={() => setCreating(false)} title={createLabel}>
        <TeamMemberForm
          action={createTeamMemberAction}
          availableUsers={availableUsers}
          submitLabel="Cadastrar"
          onSuccess={() => setCreating(false)}
        />
      </Drawer>

      <Drawer open={!!editing} onClose={() => setEditingId(null)} title={editing?.name ?? ""}>
        {editing && (
          <TeamMemberForm
            key={editing.id}
            action={updateTeamMemberAction.bind(null, editing.id)}
            defaultValues={toFormValues(editing)}
            availableUsers={availableUsers}
            submitLabel="Salvar alterações"
          />
        )}
      </Drawer>
    </div>
  );
}
