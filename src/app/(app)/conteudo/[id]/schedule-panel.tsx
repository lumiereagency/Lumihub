"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, ExternalLink, Loader2, RotateCcw, XCircle } from "lucide-react";
import { cancelScheduleAction, probePostAction, retryTargetAction, scheduleTargetsAction } from "@/lib/actions/social-actions";
import { hasBlockingError, runChecks, type Check, type MediaProbe } from "@/lib/social/checks";
import { defaultTargetFormat, isSocialNetwork, NETWORK_LABEL, TARGET_FORMATS, TARGET_STATUS_LABEL, type SocialNetwork } from "@/lib/social/networks";
import { toBrtLocalInput } from "@/lib/social/time";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/drawer";
import { NetworkPreview } from "./previews";
import type { PostRow } from "./batch-board";

export interface AccountRow {
  id: string;
  network: string;
  name: string;
  avatarUrl: string | null;
  status: string;
  statusMessage: string | null;
}

export interface TargetRow {
  id: string;
  accountId: string;
  network: string;
  status: string;
  scheduledFor: string;
  lastError: string | null;
  externalUrl: string | null;
  caption: string | null;
  format: string | null;
  subreddit: string | null;
}

const field = "h-11 w-full rounded-xl border border-border bg-card-elevated px-3 text-sm text-text-primary focus:border-accent/60 focus:outline-none";
const LEVEL_ICON = { ok: <CheckCircle2 size={15} className="text-success" />, warn: <AlertTriangle size={15} className="text-warning" />, error: <XCircle size={15} className="text-error" /> };
const fmt = (iso: string) => new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" }).replace(".", "");

function defaultWhen(post: PostRow): string {
  if (post.scheduledFor) return toBrtLocalInput(new Date(post.scheduledFor));
  const d = new Date(Date.now() + 24 * 3600_000);
  return `${toBrtLocalInput(d).slice(0, 10)}T12:00`;
}

export function SchedulePanel({
  post,
  clientId,
  accounts,
  targets,
  tiktokPublic,
  canEdit,
  onClose,
  onDone,
}: {
  post: PostRow;
  clientId: string;
  accounts: AccountRow[];
  targets: TargetRow[];
  tiktokPublic: boolean | undefined;
  canEdit: boolean;
  onClose: () => void;
  onDone: () => void;
}) {
  const hasVideo = post.media.some((m) => m.kind === "video");
  const live = targets.filter((t) => t.status !== "CANCELADO");
  const [selected, setSelected] = useState<string[]>(() => (live.length ? live.map((t) => t.accountId) : accounts.filter((a) => a.network === post.network && a.status === "ATIVA").map((a) => a.id)));
  const [captions, setCaptions] = useState<Record<string, string>>(() => Object.fromEntries(targets.filter((t) => t.caption).map((t) => [t.accountId, t.caption as string])));
  const [formats, setFormats] = useState<Record<string, string>>(() => Object.fromEntries(targets.filter((t) => t.format).map((t) => [t.accountId, t.format as string])));
  const [subreddits, setSubreddits] = useState<Record<string, string>>(() => Object.fromEntries(targets.filter((t) => t.subreddit).map((t) => [t.accountId, t.subreddit as string])));
  const [when, setWhen] = useState(() => (live[0] ? toBrtLocalInput(new Date(live[0].scheduledFor)) : defaultWhen(post)));
  const [activeId, setActiveId] = useState<string | null>(selected[0] ?? accounts[0]?.id ?? null);
  const [zones, setZones] = useState(true);
  const [probes, setProbes] = useState<MediaProbe[] | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    let alive = true;
    probePostAction(post.id).then((r) => {
      if (alive) setProbes(r.ok && r.probes ? r.probes : []);
    });
    return () => {
      alive = false;
    };
  }, [post.id]);

  const fallback: MediaProbe[] = post.media.map((m) => ({ kind: m.kind, unsupportedLink: m.kind === "video" && m.provider !== "drive" }));
  const scheduledDate = new Date(`${when}:00-03:00`);
  const formatFor = (a: AccountRow) => formats[a.id] ?? defaultTargetFormat(a.network as SocialNetwork, post.format, hasVideo);
  const captionFor = (a: AccountRow) => captions[a.id] ?? post.caption ?? "";

  const checksByAccount = useMemo(() => {
    const out: Record<string, Check[]> = {};
    for (const a of accounts) {
      if (!isSocialNetwork(a.network)) continue;
      out[a.id] = runChecks({ network: a.network, format: formats[a.id] ?? defaultTargetFormat(a.network, post.format, hasVideo), title: post.title, caption: captions[a.id] ?? post.caption ?? "", media: probes ?? fallback, account: { status: a.status, statusMessage: a.statusMessage }, scheduledFor: Number.isNaN(scheduledDate.getTime()) ? null : scheduledDate, tiktokPublic, subreddit: subreddits[a.id] ?? "" });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accounts, formats, captions, probes, when, post, tiktokPublic, subreddits]);

  const active = accounts.find((a) => a.id === activeId) ?? null;
  const activeChecks = active ? (checksByAccount[active.id] ?? []) : [];
  const ready = selected.filter((id) => !hasBlockingError(checksByAccount[id] ?? [{ level: "error", title: "", detail: "" }]));
  const left = selected.length - ready.length;
  const missingNetworks = (["INSTAGRAM", "FACEBOOK", "TIKTOK", "YOUTUBE"] as const).filter((n) => !accounts.some((a) => a.network === n));
  const previewMedia = post.media.map((m) => ({ kind: m.kind, src: m.src, embed: m.kind === "video" ? (m.embed ?? null) : null }));

  function schedule() {
    setMessage(null);
    start(async () => {
      const items = ready.map((id) => {
        const a = accounts.find((x) => x.id === id)!;
        const cap = captionFor(a).trim();
        return { accountId: id, format: formatFor(a), caption: cap && cap !== (post.caption ?? "").trim() ? cap : undefined, subreddit: a.network === "REDDIT" ? (subreddits[id] ?? "").trim() : undefined };
      });
      const r = await scheduleTargetsAction(post.id, items, when);
      if (r.ok) onDone();
      else setMessage({ ok: false, text: r.error ?? "Não foi possível agendar." });
    });
  }

  return (
    <Drawer open onClose={onClose} title="Agendar publicação" description={`${post.title} — veja como vai ficar em cada rede antes de agendar.`} widthClassName="max-w-[1120px]">
      {accounts.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-6 text-sm text-text-secondary">
          Este cliente ainda não tem contas conectadas.{" "}
          <Link href={`/clientes/${clientId}/redes`} className="text-accent underline">Conecte as redes do cliente</Link> para agendar a publicação.
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[310px_minmax(0,1fr)_320px]">
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap gap-1.5">
              {accounts.map((a) => {
                const c = checksByAccount[a.id] ?? [];
                const errors = c.filter((x) => x.level === "error").length;
                const warns = c.filter((x) => x.level === "warn").length;
                return (
                  <button key={a.id} type="button" onClick={() => setActiveId(a.id)} className={cn("flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs", a.id === activeId ? "border-accent bg-accent/10 text-text-primary" : "border-border text-text-secondary hover:bg-card-elevated")}>
                    {NETWORK_LABEL[a.network as SocialNetwork] ?? a.network}
                    <span className={cn("rounded-full px-1.5 py-0.5 text-[10px] font-semibold", errors ? "bg-error/20 text-error" : warns ? "bg-warning/20 text-warning" : "bg-success/15 text-success")}>{errors ? `${errors} erro${errors > 1 ? "s" : ""}` : warns ? `${warns} aviso${warns > 1 ? "s" : ""}` : "OK"}</span>
                  </button>
                );
              })}
            </div>
            {active && isSocialNetwork(active.network) && <NetworkPreview network={active.network} format={formatFor(active)} accountName={active.name} title={post.title} caption={captionFor(active)} media={previewMedia} showZones={zones} subreddit={subreddits[active.id]} />}
            <label className="mx-auto flex items-center gap-2 text-xs text-text-tertiary">
              <input type="checkbox" checked={zones} onChange={(e) => setZones(e.target.checked)} className="accent-[var(--lh-accent)]" /> Mostrar a zona coberta pela rede
            </label>
          </div>

          <div className="flex flex-col gap-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-text-tertiary">Verificação{active ? ` para ${NETWORK_LABEL[active.network as SocialNetwork] ?? active.network}` : ""}</p>
            {!probes && (
              <p className="flex items-center gap-2 text-xs text-text-tertiary">
                <Loader2 size={13} className="animate-spin" /> Lendo os arquivos do post (duração, proporção e tamanho)…
              </p>
            )}
            {activeChecks.map((c, i) => (
              <div key={`${c.title}-${i}`} className={cn("flex items-start gap-2.5 rounded-2xl border px-3.5 py-3 text-sm", c.level === "error" ? "border-error/40" : c.level === "warn" ? "border-warning/40" : "border-border")}>
                <span className="mt-0.5 shrink-0">{LEVEL_ICON[c.level]}</span>
                <div>
                  <p className="font-medium text-text-primary">{c.title}</p>
                  <p className="text-xs text-text-tertiary">{c.detail}</p>
                </div>
              </div>
            ))}
            <p className="flex flex-wrap gap-x-4 gap-y-1 pt-1 text-[11px] text-text-tertiary">
              <span>✓ Tudo certo</span>
              <span className="text-warning">! Aviso: pode agendar</span>
              <span className="text-error">× Bloqueia o agendamento</span>
            </p>
          </div>

          <div className="flex flex-col gap-4">
            <div>
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-text-tertiary">Publicar em</p>
              <div className="flex flex-col gap-1.5">
                {accounts.map((a) => {
                  const on = selected.includes(a.id);
                  const published = live.find((t) => t.accountId === a.id && t.status === "PUBLICADO");
                  return (
                    <label key={a.id} className={cn("flex cursor-pointer items-center gap-2.5 rounded-xl border px-3 py-2.5 text-sm", on ? "border-accent/60" : "border-border", published && "opacity-60")}>
                      <input type="checkbox" disabled={!canEdit || !!published} checked={on} onChange={(e) => setSelected((cur) => (e.target.checked ? [...cur, a.id] : cur.filter((x) => x !== a.id)))} className="h-4 w-4 accent-[var(--lh-accent)]" />
                      <span className="min-w-0 flex-1 truncate">{a.name}</span>
                      <span className="text-[11px] text-text-tertiary">{NETWORK_LABEL[a.network as SocialNetwork] ?? a.network}</span>
                    </label>
                  );
                })}
              </div>
              {missingNetworks.length > 0 && (
                <p className="mt-2 text-xs text-text-tertiary">
                  Faltam: {missingNetworks.map((n) => NETWORK_LABEL[n]).join(", ")}. <Link href={`/clientes/${clientId}/redes`} className="text-accent underline">Conectar</Link>
                </p>
              )}
            </div>

            <label className="flex flex-col gap-1.5">
              <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-text-tertiary">Quando (horário de Brasília)</span>
              <input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} disabled={!canEdit} className={field} />
            </label>

            {active && isSocialNetwork(active.network) && (
              <>
                {TARGET_FORMATS[active.network].length > 1 && (
                  <label className="flex flex-col gap-1.5">
                    <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-text-tertiary">Formato no {NETWORK_LABEL[active.network]}</span>
                    <select value={formatFor(active)} onChange={(e) => setFormats((f) => ({ ...f, [active.id]: e.target.value }))} disabled={!canEdit} className={field}>
                      {TARGET_FORMATS[active.network].map((f) => (
                        <option key={f.value} value={f.value}>{f.label}</option>
                      ))}
                    </select>
                  </label>
                )}
                {active.network === "REDDIT" && (
                  <label className="flex flex-col gap-1.5">
                    <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-text-tertiary">Comunidade do Reddit</span>
                    <input value={subreddits[active.id] ?? ""} onChange={(e) => setSubreddits((c) => ({ ...c, [active.id]: e.target.value }))} placeholder="r/suamarca ou u/usuario" disabled={!canEdit} className={field} />
                  </label>
                )}
                <label className="flex flex-col gap-1.5">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-text-tertiary">Legenda só para {NETWORK_LABEL[active.network]}</span>
                  <textarea value={captionFor(active)} onChange={(e) => setCaptions((c) => ({ ...c, [active.id]: e.target.value }))} rows={5} disabled={!canEdit} className="rounded-xl border border-border bg-card-elevated px-3 py-2.5 text-sm text-text-primary focus:border-accent/60 focus:outline-none" />
                  {captions[active.id] !== undefined && captions[active.id] !== (post.caption ?? "") && (
                    <button type="button" onClick={() => setCaptions((c) => { const n = { ...c }; delete n[active.id]; return n; })} className="w-fit text-xs text-text-tertiary underline hover:text-text-primary">Voltar à legenda do post</button>
                  )}
                </label>
              </>
            )}

            {live.length > 0 && (
              <div className="flex flex-col gap-1.5 rounded-2xl border border-border bg-card-elevated/40 p-3 text-xs">
                <p className="font-medium text-text-primary">Situação</p>
                {live.map((t) => {
                  const a = accounts.find((x) => x.id === t.accountId);
                  return (
                    <div key={t.id} className="flex flex-col gap-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-text-secondary">{a?.name ?? t.network}</span>
                        <span className={cn("shrink-0", t.status === "FALHOU" ? "text-error" : t.status === "PUBLICADO" ? "text-success" : "text-text-tertiary")}>
                          {TARGET_STATUS_LABEL[t.status] ?? t.status} · {fmt(t.scheduledFor)}
                        </span>
                      </div>
                      {t.externalUrl && t.status === "PUBLICADO" && (
                        <a href={t.externalUrl} target="_blank" rel="noreferrer" className="flex w-fit items-center gap-1 text-accent underline"><ExternalLink size={11} /> Ver na rede</a>
                      )}
                      {t.status === "FALHOU" && (
                        <>
                          <p className="text-error">{t.lastError}</p>
                          {canEdit && (
                            <button type="button" disabled={pending} onClick={() => start(async () => { const r = await retryTargetAction(t.id); if (r.ok) onDone(); else setMessage({ ok: false, text: r.error ?? "Não foi possível." }); })} className="flex w-fit items-center gap-1 text-accent underline"><RotateCcw size={11} /> Tentar de novo</button>
                          )}
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {message && <p className={cn("text-sm", message.ok ? "text-success" : "text-error")}>{message.text}</p>}
            {canEdit && (
              <div className="mt-auto flex flex-col gap-2">
                {left > 0 && ready.length > 0 && <p className="text-xs text-text-tertiary">{left} rede{left > 1 ? "s" : ""} com erro fica{left > 1 ? "m" : ""} de fora até resolver.</p>}
                <Button variant="accent" disabled={pending || ready.length === 0 || !probes} onClick={schedule}>
                  {pending ? "Agendando…" : ready.length === 0 ? "Resolva os erros para agendar" : `Agendar em ${ready.length} rede${ready.length > 1 ? "s" : ""}`}
                </Button>
                {live.some((t) => t.status === "AGENDADO" || t.status === "FALHOU") && (
                  <Button variant="secondary" disabled={pending} onClick={() => start(async () => { await cancelScheduleAction(post.id); onDone(); })}>Cancelar agendamento</Button>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </Drawer>
  );
}
