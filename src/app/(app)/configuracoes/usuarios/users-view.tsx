"use client";

import { useState } from "react";
import { Plus, Users as UsersIcon, ShieldCheck } from "lucide-react";
import { formatDateTime } from "@/lib/format";
import { Drawer } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { UserForm } from "./user-form";
import { UserEditForm } from "./user-edit-form";
import { RoleForm } from "./role-form";
import { RoleEditForm } from "./role-edit-form";

interface UserRow {
  id: string;
  name: string;
  email: string;
  roleId: string;
  roleName: string;
  isActive: boolean;
  lastLoginAt: string | null;
}

interface RoleRow {
  id: string;
  name: string;
  isSystem: boolean;
  userCount: number;
  permissionKeys: string[];
}

export function UsersView({
  users,
  roles,
  currentUserId,
}: {
  users: UserRow[];
  roles: RoleRow[];
  currentUserId: string;
}) {
  const [tab, setTab] = useState<"usuarios" | "perfis">("usuarios");
  const [creatingUser, setCreatingUser] = useState(false);
  const [creatingRole, setCreatingRole] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editingRoleId, setEditingRoleId] = useState<string | null>(null);

  const editingUser = editingUserId ? (users.find((u) => u.id === editingUserId) ?? null) : null;
  const editingRole = editingRoleId ? (roles.find((r) => r.id === editingRoleId) ?? null) : null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 rounded-[10px] border border-border bg-card p-1">
          <button
            type="button"
            onClick={() => setTab("usuarios")}
            className={tab === "usuarios" ? "rounded-[8px] bg-card-elevated px-3 py-1.5 text-sm font-medium text-text-primary" : "rounded-[8px] px-3 py-1.5 text-sm text-text-secondary hover:text-text-primary"}
          >
            Usuários
          </button>
          <button
            type="button"
            onClick={() => setTab("perfis")}
            className={tab === "perfis" ? "rounded-[8px] bg-card-elevated px-3 py-1.5 text-sm font-medium text-text-primary" : "rounded-[8px] px-3 py-1.5 text-sm text-text-secondary hover:text-text-primary"}
          >
            Perfis e permissões
          </button>
        </div>
        {tab === "usuarios" ? (
          <Button onClick={() => setCreatingUser(true)}>
            <Plus size={16} /> Novo usuário
          </Button>
        ) : (
          <Button onClick={() => setCreatingRole(true)}>
            <Plus size={16} /> Novo perfil
          </Button>
        )}
      </div>

      {tab === "usuarios" &&
        (users.length === 0 ? (
          <EmptyState icon={<UsersIcon size={28} />} title="Nenhum usuário além de você" />
        ) : (
          <div className="overflow-hidden rounded-2xl border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-bg-secondary text-left text-xs uppercase tracking-wide text-text-tertiary">
                  <th className="px-4 py-3 font-medium">Nome</th>
                  <th className="px-4 py-3 font-medium">E-mail</th>
                  <th className="px-4 py-3 font-medium">Perfil</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Último acesso</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} onClick={() => setEditingUserId(u.id)} className="cursor-pointer border-b border-border last:border-0 hover:bg-card">
                    <td className="px-4 py-3 text-text-primary">
                      {u.name}
                      {u.id === currentUserId && <span className="ml-1.5 text-xs text-text-tertiary">(você)</span>}
                    </td>
                    <td className="px-4 py-3 text-text-secondary">{u.email}</td>
                    <td className="px-4 py-3">
                      <Badge tone="neutral">{u.roleName}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={u.isActive ? "success" : "neutral"}>{u.isActive ? "Ativo" : "Inativo"}</Badge>
                    </td>
                    <td className="px-4 py-3 text-text-secondary">{u.lastLoginAt ? formatDateTime(new Date(u.lastLoginAt)) : "Nunca acessou"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}

      {tab === "perfis" &&
        (roles.length === 0 ? (
          <EmptyState icon={<ShieldCheck size={28} />} title="Nenhum perfil cadastrado" />
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {roles.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => setEditingRoleId(r.id)}
                className="flex flex-col gap-1.5 rounded-2xl border border-border bg-card p-4 text-left hover:border-gold/40"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-text-primary">{r.name}</span>
                  {r.isSystem && <Badge tone="gold">Padrão do sistema</Badge>}
                </div>
                <span className="text-xs text-text-tertiary">
                  {r.permissionKeys.length} permissõe(s) · {r.userCount} usuário(s)
                </span>
              </button>
            ))}
          </div>
        ))}

      <Drawer open={creatingUser} onClose={() => setCreatingUser(false)} title="Novo Usuário">
        <UserForm roles={roles.map((r) => ({ id: r.id, name: r.name }))} onSuccess={() => setCreatingUser(false)} />
      </Drawer>

      <Drawer open={creatingRole} onClose={() => setCreatingRole(false)} title="Novo Perfil" widthClassName="max-w-[640px]">
        <RoleForm onSuccess={() => setCreatingRole(false)} />
      </Drawer>

      <Drawer open={!!editingUser} onClose={() => setEditingUserId(null)} title={editingUser?.name ?? ""}>
        {editingUser && (
          <UserEditForm
            key={editingUser.id}
            userId={editingUser.id}
            defaultValues={{
              name: editingUser.name,
              email: editingUser.email,
              roleId: editingUser.roleId,
              isActive: editingUser.isActive,
              lastLoginAt: editingUser.lastLoginAt,
            }}
            roles={roles.map((r) => ({ id: r.id, name: r.name }))}
            canDelete={editingUser.id !== currentUserId}
            onSuccess={() => setEditingUserId(null)}
          />
        )}
      </Drawer>

      <Drawer open={!!editingRole} onClose={() => setEditingRoleId(null)} title={editingRole?.name ?? ""} widthClassName="max-w-[640px]">
        {editingRole &&
          (editingRole.isSystem ? (
            <p className="text-sm text-text-secondary">
              Este é um perfil padrão do sistema — suas {editingRole.permissionKeys.length} permissões seguem a configuração
              original do LUMIBASE e não podem ser editadas por aqui.
            </p>
          ) : (
            <RoleEditForm
              key={editingRole.id}
              roleId={editingRole.id}
              defaultKeys={editingRole.permissionKeys}
              canDelete={editingRole.userCount === 0}
              onSuccess={() => setEditingRoleId(null)}
            />
          ))}
      </Drawer>
    </div>
  );
}
