"use client";

import { useMemo, useState, useTransition } from "react";
import { Package, Pencil, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/cn";
import { formatCurrency } from "@/lib/format";
import { deleteServiceAction, saveServiceAction, toggleServiceActiveAction } from "@/lib/actions/crm-service-actions";
import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/drawer";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

interface ServiceRow {
  id: string;
  name: string;
  category: string | null;
  description: string | null;
  defaultPrice: number | null;
  active: boolean;
  leadCount: number;
  clientCount: number;
}

const SUGGESTED_CATEGORIES = ["Social media", "Audiovisual", "Tráfego pago", "Design", "Desenvolvimento", "Consultoria"];

export function ServiceCatalog({ services, currency, canManage }: { services: ServiceRow[]; currency: string; canManage: boolean }) {
  const [editing, setEditing] = useState<ServiceRow | "new" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const grouped = useMemo(() => {
    const map = new Map<string, ServiceRow[]>();
    for (const s of services) {
      const key = s.category || "Sem categoria";
      map.set(key, [...(map.get(key) ?? []), s]);
    }
    return [...map.entries()];
  }, [services]);

  const categories = useMemo(
    () => [...new Set([...services.map((s) => s.category).filter((c): c is string => !!c), ...SUGGESTED_CATEGORIES])],
    [services],
  );

  function submit(formData: FormData) {
    const priceRaw = String(formData.get("defaultPrice") ?? "").replace(",", ".");
    const input = {
      name: String(formData.get("name") ?? ""),
      category: String(formData.get("category") ?? ""),
      description: String(formData.get("description") ?? ""),
      defaultPrice: priceRaw ? Number(priceRaw) : null,
    };
    startTransition(async () => {
      const result = await saveServiceAction(editing && editing !== "new" ? editing.id : null, input);
      if (!result.ok) return setError(result.error);
      setError(null);
      setEditing(null);
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-border bg-card p-4 sm:p-5">
        <div>
          <h2 className="text-[17px] font-semibold tracking-tight text-text-primary">Catálogo de serviços</h2>
          <p className="text-sm text-text-tertiary">
            {services.filter((s) => s.active).length} ativo{services.filter((s) => s.active).length === 1 ? "" : "s"} · aparecem para marcar em cada lead e cliente
          </p>
        </div>
        {canManage && (
          <Button onClick={() => setEditing("new")}>
            <Plus size={16} /> Novo serviço
          </Button>
        )}
      </div>

      {services.length === 0 ? (
        <EmptyState
          icon={<Package size={24} />}
          title="Nenhum serviço cadastrado"
          description="Cadastre o que a Lumière vende (ex: Gestão de Instagram, Vídeo institucional, Tráfego pago) para o time marcar o interesse de cada lead."
          action={
            canManage && (
              <Button onClick={() => setEditing("new")}>
                <Plus size={16} /> Cadastrar primeiro serviço
              </Button>
            )
          }
        />
      ) : (
        grouped.map(([category, items]) => (
          <section key={category} className="flex flex-col gap-3">
            <h3 className="px-1 text-sm font-semibold text-text-secondary">{category}</h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {items.map((s) => (
                <article key={s.id} className={cn("flex flex-col gap-3 rounded-3xl border border-border bg-card p-5", !s.active && "opacity-60")}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold text-text-primary">{s.name}</p>
                      <p className="text-sm text-text-tertiary">{s.defaultPrice != null ? `a partir de ${formatCurrency(s.defaultPrice, currency)}` : "Preço sob consulta"}</p>
                    </div>
                    {!s.active && <span className="rounded-full bg-card-elevated px-2.5 py-1 text-xs font-medium text-text-secondary">Pausado</span>}
                  </div>
                  {s.description && <p className="line-clamp-3 text-sm text-text-secondary">{s.description}</p>}
                  <div className="mt-auto flex items-center justify-between gap-2 border-t border-border pt-3">
                    <span className="text-xs text-text-tertiary">
                      {s.leadCount} lead{s.leadCount === 1 ? "" : "s"} interessado{s.leadCount === 1 ? "" : "s"} · {s.clientCount} cliente{s.clientCount === 1 ? "" : "s"}
                    </span>
                    {canManage && (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => startTransition(async () => void (await toggleServiceActiveAction(s.id)))}
                          className="h-8 rounded-full px-3 text-xs font-medium text-text-secondary hover:bg-card-elevated"
                        >
                          {s.active ? "Pausar" : "Reativar"}
                        </button>
                        <button type="button" onClick={() => setEditing(s)} className="flex h-8 w-8 items-center justify-center rounded-full text-text-tertiary hover:bg-card-elevated hover:text-text-primary" aria-label={`Editar ${s.name}`}>
                          <Pencil size={14} />
                        </button>
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => {
                            if (confirm(`Excluir "${s.name}"? Ele sai de todos os leads e clientes onde estava marcado.`)) startTransition(async () => void (await deleteServiceAction(s.id)));
                          }}
                          className="flex h-8 w-8 items-center justify-center rounded-full text-text-tertiary hover:bg-error/10 hover:text-error"
                          aria-label={`Excluir ${s.name}`}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    )}
                  </div>
                </article>
              ))}
            </div>
          </section>
        ))
      )}

      <Drawer open={!!editing} onClose={() => setEditing(null)} title={editing === "new" ? "Novo serviço" : "Editar serviço"}>
        {editing && (
          <form action={submit} key={editing === "new" ? "new" : editing.id} className="flex flex-col gap-4">
            {error && <p className="rounded-2xl bg-error/10 px-4 py-3 text-sm text-error">{error}</p>}
            <Input label="Nome do serviço" name="name" required autoFocus defaultValue={editing === "new" ? "" : editing.name} placeholder="Ex: Gestão de Instagram" />
            <div>
              <Input label="Categoria" name="category" list="service-categories" defaultValue={editing === "new" ? "" : (editing.category ?? "")} placeholder="Ex: Social media" />
              <datalist id="service-categories">
                {categories.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>
            <Input
              label="Preço base (R$, opcional)"
              name="defaultPrice"
              type="number"
              min={0}
              step="0.01"
              defaultValue={editing === "new" || editing.defaultPrice == null ? "" : editing.defaultPrice}
            />
            <Textarea label="O que está incluso (opcional)" name="description" rows={4} defaultValue={editing === "new" ? "" : (editing.description ?? "")} placeholder="Ex: 12 posts/mês, 8 stories/semana, relatório mensal" />
            <Button type="submit" disabled={pending} className="mt-1 w-full">
              {pending ? "Salvando…" : "Salvar serviço"}
            </Button>
          </form>
        )}
      </Drawer>
    </div>
  );
}
