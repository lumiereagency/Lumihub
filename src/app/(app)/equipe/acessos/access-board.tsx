"use client";

import { useMemo, useState, useTransition } from "react";
import { Check, ShieldCheck } from "lucide-react";
import { updateUserAccessAction } from "@/lib/actions/access-actions";
import { ACCESS_TABS, effectivePermissions, levelOf, type ModuleAccess, type ModuleLevel } from "@/lib/auth/access";
import type { Module } from "@/lib/auth/permissions";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";

export interface AccessPerson {
  id: string;
  name: string;
  email: string;
  director: boolean;
  roleId: string;
  roleName: string;
  extraRoleIds: string[];
  overrides: ModuleAccess;
  fromRoles: Record<string, ModuleLevel>;
}

interface RoleOption {
  id: string;
  key: string;
  name: string;
  permissions: string[];
}

const LEVEL_LABEL: Record<ModuleLevel, string> = { off: "Não vê", view: "Só vê", full: "Usa" };
const initials = (name: string) => name.split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("");

function Editor({
  person,
  roles,
  scope,
  editable,
  onSaved,
}: {
  person: AccessPerson;
  roles: RoleOption[];
  scope: "all" | "operational";
  editable: Set<Module>;
  onSaved: (p: AccessPerson) => void;
}) {
  const [roleId, setRoleId] = useState(person.roleId);
  const [extra, setExtra] = useState<string[]>(person.extraRoleIds);
  const [overrides, setOverrides] = useState<ModuleAccess>(person.overrides);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // O que os perfis dão agora (recalcula ao trocar o perfil ou somar outro).
  const fromRoles = useMemo(() => {
    if (scope !== "all") return person.fromRoles;
    const perms = (id: string) => roles.find((r) => r.id === id)?.permissions ?? [];
    const base = effectivePermissions({ rolePermissions: perms(roleId), extraRolePermissions: extra.map(perms), moduleAccess: null });
    return Object.fromEntries(ACCESS_TABS.map((t) => [t.module, levelOf(base, t.module)])) as Record<string, ModuleLevel>;
  }, [scope, person.fromRoles, roles, roleId, extra]);

  const tabs = ACCESS_TABS.filter((t) => editable.has(t.module));
  const groups = [...new Set(tabs.map((t) => t.group))];
  const extraOptions = roles.filter((r) => r.key !== "MEDIA_ONLY" && r.id !== roleId);

  function save() {
    setMsg(null);
    const moduleAccess = Object.fromEntries(tabs.map((t) => [t.module, overrides[t.module] ?? null]));
    start(async () => {
      const res = await updateUserAccessAction({
        userId: person.id,
        ...(scope === "all" ? { roleId, extraRoleIds: extra } : {}),
        moduleAccess,
      });
      if (!res.ok) return setMsg({ ok: false, text: res.error ?? "Não foi possível salvar." });
      setMsg({ ok: true, text: "Acessos salvos. Já valem no próximo clique da pessoa." });
      onSaved({ ...person, roleId, extraRoleIds: extra, overrides, fromRoles, roleName: roles.find((r) => r.id === roleId)?.name ?? person.roleName });
    });
  }

  return (
    <section className="flex flex-col gap-6 rounded-3xl border border-border bg-card p-5 sm:p-6">
      <header className="flex items-center gap-3">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[image:var(--lh-accent-gradient)] text-sm font-semibold text-accent-on">{initials(person.name)}</span>
        <div className="min-w-0">
          <p className="truncate text-lg font-semibold text-text-primary">{person.name}</p>
          <p className="truncate text-xs text-text-tertiary">{person.email}</p>
        </div>
      </header>

      {scope === "all" && (
        <div className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-text-secondary">Perfil principal</span>
            <select
              value={roleId}
              onChange={(e) => {
                setRoleId(e.target.value);
                setExtra((x) => x.filter((id) => id !== e.target.value));
              }}
              className="h-11 rounded-xl border border-border bg-card-elevated px-3 text-sm text-text-primary focus:border-accent/60 focus:outline-none"
            >
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </label>
          <div className="flex flex-col gap-2">
            <span className="text-xs font-medium text-text-secondary">Também atua como</span>
            <div className="flex flex-wrap gap-2">
              {extraOptions.map((r) => {
                const on = extra.includes(r.id);
                return (
                  <button
                    key={r.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setExtra((x) => (on ? x.filter((id) => id !== r.id) : [...x, r.id]))}
                    className={cn(
                      "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors",
                      on ? "border-accent/60 bg-accent/15 text-text-primary" : "border-border text-text-secondary hover:text-text-primary",
                    )}
                  >
                    {on && <Check size={14} className="text-accent-light" />} {r.name}
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-text-tertiary">A pessoa soma os acessos de todos os perfis marcados.</p>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-5">
        {groups.map((g) => (
          <div key={g} className="flex flex-col gap-2">
            <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-text-tertiary">{g}</p>
            <div className="flex flex-col divide-y divide-border rounded-2xl border border-border">
              {tabs
                .filter((t) => t.group === g)
                .map((t) => {
                  const override = overrides[t.module];
                  const result = override ?? fromRoles[t.module] ?? "off";
                  return (
                    <div key={t.module} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <p className="flex items-center gap-2 text-sm font-medium text-text-primary">
                          <span className={cn("h-2 w-2 shrink-0 rounded-full", result === "off" ? "bg-text-tertiary/40" : result === "view" ? "bg-warning" : "bg-success")} />
                          {t.label}
                        </p>
                        <p className="text-xs text-text-tertiary">
                          {t.hint}
                          {!override && ` · pelo perfil: ${LEVEL_LABEL[fromRoles[t.module] ?? "off"].toLowerCase()}`}
                        </p>
                      </div>
                      <div className="flex shrink-0 gap-1 rounded-full border border-border bg-card-elevated/60 p-1" role="radiogroup" aria-label={t.label}>
                        {([null, "off", "view", "full"] as const).map((lv) => {
                          const active = (override ?? null) === lv;
                          return (
                            <button
                              key={lv ?? "auto"}
                              type="button"
                              role="radio"
                              aria-checked={active}
                              onClick={() =>
                                setOverrides((o) => {
                                  const n = { ...o };
                                  if (lv) n[t.module] = lv;
                                  else delete n[t.module];
                                  return n;
                                })
                              }
                              className={cn(
                                "rounded-full px-2.5 py-1 text-xs transition-colors",
                                active ? "bg-card text-text-primary shadow-sm ring-1 ring-border" : "text-text-tertiary hover:text-text-primary",
                              )}
                            >
                              {lv ? LEVEL_LABEL[lv] : "Perfil"}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3 border-t border-border pt-4">
        <Button variant="accent" disabled={pending} onClick={save}>
          {pending ? "Salvando…" : "Salvar acessos"}
        </Button>
        {msg && <span className={cn("text-xs", msg.ok ? "text-success" : "text-error")}>{msg.text}</span>}
      </div>
    </section>
  );
}

export function AccessBoard({
  people: initial,
  roles,
  scope,
  editableModules,
}: {
  people: AccessPerson[];
  roles: RoleOption[];
  scope: "all" | "operational";
  editableModules: Module[];
}) {
  const [people, setPeople] = useState(initial);
  const editable = useMemo(() => new Set(editableModules), [editableModules]);
  const editableList = people.filter((p) => !p.director);
  const [selectedId, setSelectedId] = useState<string | null>(editableList[0]?.id ?? null);
  const selected = editableList.find((p) => p.id === selectedId) ?? null;
  const directors = people.filter((p) => p.director);

  if (editableList.length === 0) {
    return <EmptyState icon={<ShieldCheck size={28} />} title="Ninguém para ajustar" description="Quando houver pessoas na equipe com acesso à base, elas aparecem aqui." />;
  }

  const openCount = (p: AccessPerson) => ACCESS_TABS.filter((t) => (p.overrides[t.module] ?? p.fromRoles[t.module]) !== "off").length;

  return (
    <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
      <div className="flex flex-col gap-2">
        {editableList.map((p) => {
          const extras = p.extraRoleIds.map((id) => roles.find((r) => r.id === id)?.name).filter(Boolean);
          const adjusted = Object.keys(p.overrides).length;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => setSelectedId(p.id)}
              aria-current={p.id === selectedId}
              className={cn(
                "flex items-center gap-3 rounded-2xl border p-3 text-left transition-colors",
                p.id === selectedId ? "border-accent/50 bg-card" : "border-border bg-card/60 hover:bg-card",
              )}
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-card-elevated text-xs font-semibold text-text-secondary">{initials(p.name)}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-text-primary">{p.name}</span>
                <span className="block truncate text-xs text-text-tertiary">{[p.roleName, ...extras].join(" + ")}</span>
              </span>
              <span className="flex shrink-0 flex-col items-end gap-1">
                <span className="lb-figures text-xs text-text-secondary">{openCount(p)} abas</span>
                {adjusted > 0 && <Badge tone="accent">{adjusted} ajuste{adjusted > 1 ? "s" : ""}</Badge>}
              </span>
            </button>
          );
        })}
        {directors.length > 0 && (
          <p className="px-1 pt-2 text-xs text-text-tertiary">Acesso total (diretoria): {directors.map((d) => d.name.split(" ")[0]).join(", ")}.</p>
        )}
      </div>

      {selected && (
        <Editor
          key={selected.id}
          person={selected}
          roles={roles}
          scope={scope}
          editable={editable}
          onSaved={(p) => setPeople((list) => list.map((x) => (x.id === p.id ? p : x)))}
        />
      )}
    </div>
  );
}
