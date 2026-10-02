"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Check, Package, Pencil } from "lucide-react";
import { cn } from "@/lib/cn";
import { setClientServicesAction } from "@/lib/actions/crm-service-actions";

interface ServiceOption {
  id: string;
  name: string;
  category: string | null;
}

export function ClientServices({
  clientId,
  services,
  selectedIds,
  canEdit,
}: {
  clientId: string;
  services: ServiceOption[];
  selectedIds: string[];
  canEdit: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<string[]>(selectedIds);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const selected = services.filter((s) => selectedIds.includes(s.id));

  return (
    <section className="rounded-2xl border border-border bg-card p-6">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 text-[17px] font-semibold tracking-tight text-text-primary">
            <Package size={17} className="text-text-tertiary" /> Serviços
          </h3>
          <p className="mt-1 text-sm text-text-tertiary">O que este cliente contrata ou tem interesse.</p>
        </div>
        {canEdit && services.length > 0 && !editing && (
          <button
            type="button"
            onClick={() => {
              setDraft(selectedIds);
              setEditing(true);
            }}
            className="flex h-9 items-center gap-1.5 rounded-full border border-border px-3.5 text-sm font-medium text-text-secondary hover:bg-card-elevated hover:text-text-primary"
          >
            <Pencil size={14} /> Editar
          </button>
        )}
      </div>

      {services.length === 0 ? (
        <p className="rounded-2xl bg-card-elevated px-4 py-3 text-sm text-text-tertiary">
          Nenhum serviço no catálogo ainda. Cadastre em{" "}
          <Link href="/crm/servicos" className="font-medium text-accent-light hover:underline">
            CRM → Serviços
          </Link>
          .
        </p>
      ) : editing ? (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-2">
            {services.map((s) => {
              const active = draft.includes(s.id);
              return (
                <button
                  key={s.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setDraft((d) => (active ? d.filter((x) => x !== s.id) : [...d, s.id]))}
                  className={cn(
                    "inline-flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-sm transition-colors",
                    active ? "border-transparent bg-ink text-ink-on" : "border-border text-text-secondary hover:text-text-primary",
                  )}
                >
                  {active && <Check size={14} />}
                  {s.name}
                </button>
              );
            })}
          </div>
          {error && <p className="text-sm text-error">{error}</p>}
          <div className="flex gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const r = await setClientServicesAction(clientId, draft);
                  if (!r.ok) return setError(r.error);
                  setEditing(false);
                })
              }
              className="h-9 rounded-full bg-ink px-4 text-sm font-medium text-ink-on hover:opacity-90 disabled:opacity-50"
            >
              {pending ? "Salvando…" : "Salvar"}
            </button>
            <button type="button" onClick={() => setEditing(false)} className="h-9 rounded-full px-4 text-sm font-medium text-text-secondary hover:bg-card-elevated">
              Cancelar
            </button>
          </div>
        </div>
      ) : selected.length === 0 ? (
        <p className="text-sm text-text-tertiary">Nenhum serviço marcado ainda.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {selected.map((s) => (
            <span key={s.id} className="inline-flex h-9 items-center rounded-full bg-card-elevated px-3.5 text-sm font-medium text-text-primary">
              {s.name}
              {s.category && <span className="ml-1.5 text-xs font-normal text-text-tertiary">· {s.category}</span>}
            </span>
          ))}
        </div>
      )}
    </section>
  );
}
