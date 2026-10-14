"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Images, Plus } from "lucide-react";
import { createBatchAction } from "@/lib/actions/content-actions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Drawer } from "@/components/ui/drawer";

interface Row {
  id: string;
  name: string;
  client: string;
  sent: boolean;
  total: number;
  draft: number;
  waiting: number;
  approved: number;
  adjust: number;
}

const field = "h-11 w-full rounded-xl border border-border bg-card-elevated px-3 text-sm text-text-primary focus:border-accent/60 focus:outline-none";

export function BatchList({ batches, clients, canCreate }: { batches: Row[]; clients: { id: string; companyName: string }[]; canCreate: boolean }) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [clientId, setClientId] = useState(clients[0]?.id ?? "");
  const now = new Date();
  const [name, setName] = useState(() => `${now.toLocaleDateString("pt-BR", { month: "long", year: "numeric", timeZone: "America/Sao_Paulo" }).replace(/^./, (c) => c.toUpperCase()).replace(" de ", " ")}`);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function create() {
    setError(null);
    start(async () => {
      const r = await createBatchAction(clientId, name);
      if (r.ok && r.id) router.push(`/conteudo/${r.id}`);
      else setError(r.error ?? "Não foi possível criar.");
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {canCreate && (
        <div className="flex justify-end">
          <Button variant="accent" onClick={() => setCreating(true)}>
            <Plus size={16} /> Novo lote de posts
          </Button>
        </div>
      )}
      {batches.length === 0 ? (
        <EmptyState icon={<Images size={26} />} title="Nenhum lote de conteúdo ainda" description="Crie um lote para um cliente (por exemplo, o mês de novembro), adicione os posts e envie o link para ele aprovar." />
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {batches.map((b) => {
            const pct = b.total ? Math.round((b.approved / b.total) * 100) : 0;
            return (
              <Link key={b.id} href={`/conteudo/${b.id}`} className="flex flex-col gap-4 rounded-3xl border border-border bg-card p-5 transition-colors hover:border-text-tertiary/60">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-[17px] font-semibold tracking-tight text-text-primary">{b.client}</p>
                    <p className="text-sm text-text-tertiary">{b.name}</p>
                  </div>
                  <Badge tone={b.sent ? "accent" : "neutral"}>{b.sent ? "Enviado" : "Rascunho"}</Badge>
                </div>
                <div>
                  <div className="mb-1.5 flex justify-between text-xs text-text-tertiary">
                    <span>
                      {b.approved} de {b.total} aprovados
                    </span>
                    <span>{pct}%</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-card-elevated">
                    <div className="h-full rounded-full bg-[image:var(--lh-accent-gradient)]" style={{ width: `${pct}%` }} />
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {b.waiting > 0 && <Badge tone="warning">{b.waiting} aguardando cliente</Badge>}
                  {b.adjust > 0 && <Badge tone="error">{b.adjust} com ajuste</Badge>}
                  {b.draft > 0 && <Badge tone="neutral">{b.draft} rascunho</Badge>}
                </div>
              </Link>
            );
          })}
        </div>
      )}

      <Drawer open={creating} onClose={() => setCreating(false)} title="Novo lote de posts">
        <div className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-text-secondary">Cliente</span>
            <select value={clientId} onChange={(e) => setClientId(e.target.value)} className={field}>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.companyName}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-text-secondary">Nome do lote</span>
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} placeholder="Ex.: Novembro 2026" className={field} />
          </label>
          <p className="text-xs text-text-tertiary">O link de aprovação é criado junto. Você adiciona os posts e envia quando estiver pronto.</p>
          {error && <p className="text-sm text-error">{error}</p>}
          <Button variant="accent" disabled={pending || !clientId} onClick={create} className="w-full">
            {pending ? "Criando…" : "Criar lote"}
          </Button>
        </div>
      </Drawer>
    </div>
  );
}
