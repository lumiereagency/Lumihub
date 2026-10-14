"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, Link2, Plug, Trash2 } from "lucide-react";
import { connectSimulatedAccountAction, disconnectAccountAction, saveConnectedAccountsAction } from "@/lib/actions/social-actions";
import { FAMILY_LABELS, NETWORK_LABEL, SOCIAL_NETWORKS, type ConnectFamily, type SocialNetwork } from "@/lib/social/networks";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface AccountRow {
  id: string;
  network: string;
  name: string;
  avatarUrl: string | null;
  status: string;
  statusMessage: string | null;
  createdAt: string;
}

const FAMILIES: { family: ConnectFamily; networks: string }[] = [
  { family: "meta", networks: "Instagram e Facebook" },
  { family: "youtube", networks: "YouTube" },
  { family: "tiktok", networks: "TikTok" },
  { family: "x", networks: "X (Twitter)" },
  { family: "threads", networks: "Threads" },
  { family: "linkedin", networks: "LinkedIn" },
  { family: "reddit", networks: "Reddit" },
];

export function RedesView({
  clientId,
  accounts,
  apps,
  pick,
  error,
  canEdit,
  simulation,
}: {
  clientId: string;
  accounts: AccountRow[];
  apps: Record<ConnectFamily, boolean>;
  pick: { sessionId: string; candidates: { key: string; network: string; name: string; avatarUrl: string | null; already: boolean }[] } | null;
  error: string | null;
  canEdit: boolean;
  simulation: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [chosen, setChosen] = useState<string[]>(pick?.candidates.map((c) => c.key) ?? []);
  const [message, setMessage] = useState<string | null>(error);

  const savePick = () =>
    start(async () => {
      if (!pick) return;
      const r = await saveConnectedAccountsAction(pick.sessionId, chosen);
      if (r.ok) router.replace(`/clientes/${clientId}/redes`);
      else setMessage(r.error ?? "Não consegui salvar.");
    });

  return (
    <div className="flex flex-col gap-6">
      {message && (
        <div className="flex items-start gap-2 rounded-2xl border border-error/40 bg-error/10 px-4 py-3 text-sm text-text-primary">
          <AlertTriangle size={16} className="mt-0.5 shrink-0 text-error" /> {message}
        </div>
      )}

      {pick && (
        <section className="flex flex-col gap-3 rounded-3xl border border-accent/40 bg-card p-5">
          <div>
            <h2 className="text-lg font-semibold text-text-primary">Quais contas são deste cliente?</h2>
            <p className="text-sm text-text-tertiary">Marque só as contas do cliente. A agência pode ter acesso a outras páginas, que não devem entrar aqui.</p>
          </div>
          <div className="flex flex-col gap-2">
            {pick.candidates.map((c) => (
              <label key={c.key} className="flex cursor-pointer items-center gap-3 rounded-2xl border border-border bg-card-elevated px-4 py-3">
                <input type="checkbox" className="h-4 w-4 accent-[var(--lh-accent)]" checked={chosen.includes(c.key)} onChange={(e) => setChosen((cur) => (e.target.checked ? [...cur, c.key] : cur.filter((k) => k !== c.key)))} />
                <span className="text-sm font-medium text-text-primary">{c.name}</span>
                <Badge tone="neutral">{NETWORK_LABEL[c.network as SocialNetwork] ?? c.network}</Badge>
                {c.already && <span className="text-xs text-text-tertiary">já conectada (será atualizada)</span>}
              </label>
            ))}
          </div>
          <div className="flex gap-2">
            <Button onClick={savePick} disabled={pending || chosen.length === 0}>{pending ? "Salvando…" : `Conectar ${chosen.length} conta${chosen.length === 1 ? "" : "s"}`}</Button>
            <Button variant="secondary" onClick={() => router.replace(`/clientes/${clientId}/redes`)}>Cancelar</Button>
          </div>
        </section>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-text-tertiary">Contas conectadas</h2>
        {accounts.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border px-4 py-6 text-sm text-text-tertiary">Nenhuma conta conectada ainda. Conecte abaixo para poder agendar a publicação dos posts deste cliente.</p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {accounts.map((a) => (
              <div key={a.id} className="flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3">
                {a.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={a.avatarUrl} alt="" className="h-10 w-10 rounded-full object-cover" />
                ) : (
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-card-elevated text-text-tertiary"><Link2 size={16} /></span>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-text-primary">{a.name}</p>
                  <p className="text-xs text-text-tertiary">{NETWORK_LABEL[a.network as SocialNetwork] ?? a.network}</p>
                  {a.status !== "ATIVA" && <p className="mt-1 text-xs text-error">{a.statusMessage ?? "Precisa reconectar."}</p>}
                </div>
                {a.status === "ATIVA" ? <Badge tone="success"><CheckCircle2 size={11} /> Ativa</Badge> : <Badge tone="error">Reconectar</Badge>}
                {canEdit && (
                  <button
                    type="button"
                    aria-label={`Desconectar ${a.name}`}
                    disabled={pending}
                    onClick={() => {
                      if (!confirm(`Desconectar ${a.name}? Os posts agendados nesta conta serão cancelados.`)) return;
                      start(async () => {
                        await disconnectAccountAction(a.id);
                        router.refresh();
                      });
                    }}
                    className="flex h-8 w-8 items-center justify-center rounded-full text-text-tertiary hover:bg-card-elevated hover:text-error"
                  >
                    <Trash2 size={15} />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {canEdit && (
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-text-tertiary">Conectar uma rede</h2>
          <p className="text-sm text-text-tertiary">Quem conecta precisa ter acesso de administrador à página ou conta do cliente (por exemplo, pelo Gerenciador de Negócios).</p>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {FAMILIES.map(({ family, networks }) => (
              <div key={family} className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4">
                <p className="text-sm font-medium text-text-primary">{networks}</p>
                {apps[family] ? (
                  <a href={`/api/social/oauth/${family}/start?clientId=${clientId}`} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-border bg-card-elevated px-4 text-sm font-medium text-text-primary hover:brightness-110">
                    <Plug size={15} /> Conectar {FAMILY_LABELS[family]}
                  </a>
                ) : (
                  <p className="text-xs text-text-tertiary">
                    O app desta rede ainda não foi cadastrado. <Link href="/configuracoes/integracoes" className="text-accent underline">Cadastre em Integrações</Link>.
                  </p>
                )}
              </div>
            ))}
          </div>
          {simulation && (
            <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-dashed border-border p-3 text-sm text-text-tertiary">
              Modo de teste:
              {SOCIAL_NETWORKS.map((n) => (
                <Button key={n} size="sm" variant="secondary" disabled={pending} onClick={() => start(async () => { await connectSimulatedAccountAction(clientId, n); router.refresh(); })}>
                  + {NETWORK_LABEL[n]} (teste)
                </Button>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
