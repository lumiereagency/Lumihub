"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Plus, Search, Users2 } from "lucide-react";
import { resendMediaInvitationAction, removeMediaMemberAction } from "@/lib/actions/media-actions";
import { MEDIA_STATUS_LABELS, MEDIA_STATUS_TONE } from "@/lib/media/labels";
import { Drawer } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/empty-state";
import { InviteMemberForm } from "@/components/media/invite-member-form";

interface MemberRow {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  role: string;
  status: string;
  primaryFunction: string | null;
  enabledFunctions: string[];
  functionIds: string[];
  hasAvailability: boolean;
}

export function MediaTeamList({
  members,
  allFunctions,
  canCreate,
  canEdit,
}: {
  members: MemberRow[];
  allFunctions: { id: string; name: string }[];
  canCreate: boolean;
  canEdit: boolean;
}) {
  const [inviting, setInviting] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [functionFilter, setFunctionFilter] = useState("");

  const filtered = useMemo(() => {
    return members.filter((m) => {
      if (statusFilter && m.status !== statusFilter) return false;
      if (functionFilter && !m.functionIds.includes(functionFilter)) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        if (!m.name.toLowerCase().includes(q) && !m.email.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [members, search, statusFilter, functionFilter]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" />
            <Input placeholder="Buscar por nome ou e-mail..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-64 pl-9" />
          </div>
          <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-40">
            <option value="">Todos os status</option>
            <option value="ACTIVE">Ativo</option>
            <option value="INVITED">Convite pendente</option>
            <option value="INACTIVE">Inativo</option>
            <option value="SUSPENDED">Suspenso</option>
          </Select>
          <Select value={functionFilter} onChange={(e) => setFunctionFilter(e.target.value)} className="w-44">
            <option value="">Todas as funções</option>
            {allFunctions.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </Select>
        </div>
        {canCreate && (
          <Button onClick={() => setInviting(true)}>
            <Plus size={16} /> Convidar membro
          </Button>
        )}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<Users2 size={28} />}
          title={members.length === 0 ? "Nenhum membro cadastrado ainda" : "Nenhum membro encontrado com esses filtros"}
          action={
            members.length === 0 &&
            canCreate && (
              <Button onClick={() => setInviting(true)}>
                <Plus size={16} /> Convidar primeiro membro
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
                <th className="px-4 py-3 font-medium">Função principal</th>
                <th className="px-4 py-3 font-medium">Funções habilitadas</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Disponibilidade</th>
                <th className="px-4 py-3 font-medium" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((m) => (
                <tr key={m.id} className="border-b border-border last:border-0 hover:bg-card">
                  <td className="px-4 py-3">
                    <Link href={`/midia-adesf/equipe/${m.id}`} className="flex items-center gap-2.5">
                      <Avatar name={m.name} src={m.avatarUrl} size="sm" />
                      <div>
                        <p className="font-medium text-text-primary">{m.name}</p>
                        <p className="text-xs text-text-tertiary">{m.email}</p>
                      </div>
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-text-secondary">{m.primaryFunction ?? "—"}</td>
                  <td className="px-4 py-3 text-text-secondary">{m.enabledFunctions.length > 0 ? m.enabledFunctions.join(", ") : "—"}</td>
                  <td className="px-4 py-3">
                    <Badge tone={MEDIA_STATUS_TONE[m.status]}>{MEDIA_STATUS_LABELS[m.status]}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={m.hasAvailability ? "success" : "neutral"}>{m.hasAvailability ? "Configurada" : "Não configurada"}</Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {canEdit && (
                      <div className="flex items-center justify-end gap-1">
                        {m.status === "INVITED" && (
                          <form action={resendMediaInvitationAction.bind(null, m.id)}>
                            <button type="submit" className="rounded-[8px] px-2 py-1 text-xs text-text-secondary hover:bg-card-elevated hover:text-text-primary">
                              Reenviar convite
                            </button>
                          </form>
                        )}
                        {m.status !== "INACTIVE" && (
                          <form action={removeMediaMemberAction.bind(null, m.id)}>
                            <button
                              type="submit"
                              title="Desativar acesso ao Mídia ADESF"
                              className="rounded-[8px] px-2 py-1 text-xs text-text-tertiary hover:bg-card-elevated hover:text-error"
                            >
                              Desativar
                            </button>
                          </form>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Drawer open={inviting} onClose={() => setInviting(false)} title="Convidar membro">
        <InviteMemberForm onSuccess={() => setInviting(false)} />
      </Drawer>
    </div>
  );
}
