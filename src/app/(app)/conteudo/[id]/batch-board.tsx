"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, CalendarClock, CheckCircle2, ChevronLeft, ChevronRight, Copy, Film, ImageIcon, Pencil, Plus, Send, Share2, Trash2, X } from "lucide-react";
import { deleteBatchAction, deletePostAction, markBatchSentAction, markPublishedAction, previewBatchSendAction, savePostAction, sendBatchWhatsAppAction } from "@/lib/actions/content-actions";
import { FORMATS, FORMAT_LABELS, NETWORKS, NETWORK_LABELS, STATUS_LABELS } from "@/lib/content/media";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Drawer } from "@/components/ui/drawer";
import { EmptyState } from "@/components/ui/empty-state";
import { scheduleAllAction } from "@/lib/actions/social-actions";
import { NETWORK_LABEL, TARGET_STATUS_LABEL, type SocialNetwork } from "@/lib/social/networks";
import { CalendarView } from "./calendar-view";
import { SchedulePanel, type AccountRow, type TargetRow } from "./schedule-panel";

export interface PostRow {
  id: string;
  title: string;
  caption: string | null;
  network: string;
  format: string;
  scheduledFor: string | null;
  status: string;
  version: number;
  feedback: string | null;
  media: { kind: "video" | "image"; provider: string | null; url: string; storageKey: string | null; src: string | null; embed: string | null }[];
  events: { id: string; kind: string; note: string | null; actor: string; at: string }[];
}

interface BatchInfo {
  id: string;
  clientId: string;
  name: string;
  client: string;
  phone: string | null;
  sent: boolean;
}

const TZ = "America/Sao_Paulo";
const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString("pt-BR", { weekday: "short", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: TZ }).replace(".", "") : "Sem data");
const toInput = (iso: string | null) => (iso ? new Intl.DateTimeFormat("sv-SE", { timeZone: TZ, dateStyle: "short", timeStyle: "short" }).format(new Date(iso)).replace(" ", "T") : "");
const TONE: Record<string, "neutral" | "warning" | "success" | "error" | "accent" | "info"> = { RASCUNHO: "neutral", AGUARDANDO: "warning", APROVADO: "success", AJUSTE: "error", AGENDADO: "info", PUBLICADO: "accent", FALHOU: "error" };
const EVENT_LABEL: Record<string, string> = { CRIADO: "Criado", ENVIADO: "Enviado ao cliente", APROVADO: "Aprovado", AJUSTE: "Ajuste pedido", REVISADO: "Nova versão", AGENDADO: "Agendado", AGENDAMENTO_CANCELADO: "Agendamento cancelado", PUBLICADO: "Publicado", FALHA: "Falha ao publicar" };
const field = "h-11 w-full rounded-xl border border-border bg-card-elevated px-3 text-sm text-text-primary focus:border-accent/60 focus:outline-none";

function PostForm({ batchId, post, onDone }: { batchId: string; post: PostRow | null; onDone: () => void }) {
  const [keep, setKeep] = useState<string[]>(post?.media.filter((m) => m.storageKey).map((m) => m.storageKey!) ?? []);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const images = post?.media.filter((m) => m.storageKey) ?? [];
  const links = post?.media.filter((m) => m.kind === "video").map((m) => m.url).join("\n") ?? "";

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        const data = new FormData(e.currentTarget);
        data.set("keepImages", JSON.stringify(keep));
        start(async () => {
          const r = await savePostAction(batchId, post?.id ?? null, data);
          if (r.ok) onDone();
          else setError(r.error ?? "Não foi possível salvar.");
        });
      }}
      className="flex flex-col gap-4"
    >
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-text-secondary">Título (só para vocês e para o cliente identificar)</span>
        <input name="title" required defaultValue={post?.title} maxLength={120} placeholder="Ex.: Bastidores da nova coleção" className={field} />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-text-secondary">Rede</span>
          <select name="network" defaultValue={post?.network ?? "INSTAGRAM"} className={field}>
            {NETWORKS.map((n) => (
              <option key={n} value={n}>
                {NETWORK_LABELS[n]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-text-secondary">Formato</span>
          <select name="format" defaultValue={post?.format ?? "REELS"} className={field}>
            {FORMATS.map((f) => (
              <option key={f} value={f}>
                {FORMAT_LABELS[f]}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-text-secondary">Data e hora da publicação</span>
        <input name="scheduledFor" type="datetime-local" defaultValue={toInput(post?.scheduledFor ?? null)} className={field} />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-text-secondary">Legenda</span>
        <textarea name="caption" rows={5} defaultValue={post?.caption ?? ""} maxLength={2200} className="rounded-xl border border-border bg-card-elevated px-3 py-2.5 text-sm text-text-primary focus:border-accent/60 focus:outline-none" />
      </label>

      <div className="flex flex-col gap-2 rounded-2xl border border-border p-4">
        <p className="text-sm font-medium text-text-primary">Arquivos do post</p>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs text-text-secondary">Vídeo: cole o link (Google Drive, YouTube ou Vimeo), um por linha</span>
          <textarea name="videoLinks" rows={2} defaultValue={links} placeholder="https://drive.google.com/file/d/…" className="rounded-xl border border-border bg-card-elevated px-3 py-2.5 text-sm text-text-primary focus:border-accent/60 focus:outline-none" />
        </label>
        <p className="flex items-start gap-1.5 text-xs text-warning">
          <AlertTriangle size={13} className="mt-0.5 shrink-0" /> No Drive, deixe o arquivo como &ldquo;Qualquer pessoa com o link pode ver&rdquo;, senão o cliente não consegue abrir. Para vídeos, o YouTube (não listado) é o que funciona melhor.
        </p>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs text-text-secondary">Imagens (até 10, são reduzidas automaticamente)</span>
          <input name="images" type="file" accept="image/*" multiple className="text-xs text-text-secondary file:mr-3 file:rounded-full file:border-0 file:bg-card-elevated file:px-3 file:py-1.5 file:text-xs file:text-text-primary" />
        </label>
        {images.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {images.map((m) => {
              const on = keep.includes(m.storageKey!);
              return (
                <button key={m.storageKey} type="button" onClick={() => setKeep((k) => (on ? k.filter((x) => x !== m.storageKey) : [...k, m.storageKey!]))} className={cn("relative h-16 w-16 overflow-hidden rounded-xl border", on ? "border-border" : "border-error opacity-40")} title={on ? "Toque para remover" : "Será removida"}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={m.src ?? ""} alt="" className="h-full w-full object-cover" />
                  {!on && <X size={16} className="absolute inset-0 m-auto text-error" />}
                </button>
              );
            })}
          </div>
        )}
      </div>
      {post && ["AJUSTE", "APROVADO", "AGENDADO", "FALHOU"].includes(post.status) && <p className="text-xs text-text-tertiary">Ao salvar, o post volta para o cliente aprovar de novo (versão {post.version + 1}).</p>}
      {error && <p className="text-sm text-error">{error}</p>}
      <Button type="submit" variant="accent" disabled={pending} className="w-full">
        {pending ? "Salvando…" : post ? "Salvar post" : "Adicionar post"}
      </Button>
    </form>
  );
}

function SendPanel({ batch, whatsapp, onDone }: { batch: BatchInfo; whatsapp: boolean; onDone: () => void }) {
  const [state, setState] = useState<{ link: string; message: string; phone: string } | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, start] = useTransition();

  function open() {
    setMsg(null);
    start(async () => {
      const r = await previewBatchSendAction(batch.id);
      if (r.ok && r.link) setState({ link: r.link, message: r.message ?? "", phone: r.phone ?? "" });
      else setMsg({ ok: false, text: r.error ?? "Não foi possível preparar." });
    });
  }

  if (!state)
    return (
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="accent" onClick={open} disabled={pending}>
          <Send size={15} /> {batch.sent ? "Reenviar link ao cliente" : "Enviar ao cliente"}
        </Button>
        {msg && <span className={cn("text-sm", msg.ok ? "text-success" : "text-error")}>{msg.text}</span>}
      </div>
    );

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card-elevated/50 p-4">
      <p className="text-sm font-medium text-text-primary">Enviar para {batch.client}</p>
      <div className="flex flex-wrap items-center gap-2">
        <code className="min-w-0 flex-1 truncate rounded-lg bg-card px-3 py-2 text-xs text-text-secondary">{state.link}</code>
        <Button
          size="sm"
          variant="secondary"
          onClick={async () => {
            await navigator.clipboard.writeText(state.link).catch(() => {});
            setCopied(true);
            window.setTimeout(() => setCopied(false), 2000);
            await markBatchSentAction(batch.id);
            onDone();
          }}
        >
          <Copy size={13} /> {copied ? "Copiado" : "Copiar link"}
        </Button>
      </div>
      {whatsapp ? (
        <>
          <input value={state.phone} onChange={(e) => setState({ ...state, phone: e.target.value })} placeholder="WhatsApp do cliente com DDD" aria-label="WhatsApp do cliente" className={field} />
          <textarea value={state.message} onChange={(e) => setState({ ...state, message: e.target.value })} rows={7} aria-label="Mensagem" className="rounded-xl border border-border bg-card px-3 py-2.5 text-sm text-text-primary focus:border-accent/60 focus:outline-none" />
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="accent"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const r = await sendBatchWhatsAppAction(batch.id, state.phone, state.message);
                  setMsg(r.ok ? { ok: true, text: "Enviado no WhatsApp do cliente." } : { ok: false, text: r.error ?? "Não foi possível enviar." });
                  if (r.ok) {
                    setState(null);
                    onDone();
                  }
                })
              }
            >
              <Send size={13} /> {pending ? "Enviando…" : "Enviar no WhatsApp"}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setState(null)}>
              Cancelar
            </Button>
            {msg && <span className={cn("text-xs", msg.ok ? "text-success" : "text-error")}>{msg.text}</span>}
          </div>
        </>
      ) : (
        <p className="text-xs text-text-tertiary">O WhatsApp da empresa não está conectado: copie o link e mande por onde preferir.</p>
      )}
    </div>
  );
}

export function BatchBoard({ batch, posts, whatsapp, perms, accounts, targetsByPost, tiktokPublic }: { batch: BatchInfo; posts: PostRow[]; whatsapp: boolean; perms: { create: boolean; edit: boolean; del: boolean }; accounts: AccountRow[]; targetsByPost: Record<string, TargetRow[]>; tiktokPublic: boolean | undefined }) {
  const router = useRouter();
  const [editing, setEditing] = useState<PostRow | "new" | null>(null);
  const [openHistory, setOpenHistory] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [view, setView] = useState<"lista" | "calendario">("lista");
  const [scheduling, setScheduling] = useState<PostRow | null>(null);
  const [bulk, setBulk] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const count = (s: string) => posts.filter((p) => p.status === s).length;
  const refresh = () => router.refresh();

  function act(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setMsg(null);
    start(async () => {
      const r = await fn();
      if (!r.ok) setMsg(r.error ?? "Não foi possível.");
      refresh();
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/conteudo" className="mb-2 flex w-fit items-center gap-1 text-sm text-text-tertiary hover:text-text-primary">
            <ChevronLeft size={15} /> Conteúdo
          </Link>
          <h1 className="text-[28px] font-semibold leading-tight tracking-tight text-text-primary sm:text-[32px]">{batch.client}</h1>
          <p className="mt-1 text-[15px] text-text-tertiary">{batch.name}</p>
        </div>
        {perms.create && (
          <Button variant="secondary" onClick={() => setEditing("new")}>
            <Plus size={16} /> Novo post
          </Button>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <Badge tone="neutral">{count("RASCUNHO")} rascunho</Badge>
        <Badge tone="warning">{count("AGUARDANDO")} aguardando cliente</Badge>
        <Badge tone="error">{count("AJUSTE")} com ajuste</Badge>
        <Badge tone="success">{count("APROVADO")} aprovados</Badge>
        <Badge tone="info">{count("AGENDADO")} agendados</Badge>
        <Badge tone="accent">{count("PUBLICADO")} publicados</Badge>
        {count("FALHOU") > 0 && <Badge tone="error">{count("FALHOU")} falharam</Badge>}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1 rounded-full border border-border bg-card-elevated p-1">
          {([["lista", "Lista"], ["calendario", "Calendário"]] as const).map(([v, label]) => (
            <button key={v} type="button" onClick={() => setView(v)} className={cn("rounded-full px-4 py-1.5 text-xs font-medium", view === v ? "bg-accent text-ink-on" : "text-text-secondary")}>{label}</button>
          ))}
        </div>
        <Link href={`/clientes/${batch.clientId}/redes`} className="flex items-center gap-1.5 text-xs text-text-tertiary hover:text-text-primary">
          <Share2 size={13} /> Redes do cliente ({accounts.length} {accounts.length === 1 ? "conta" : "contas"})
        </Link>
      </div>

      {perms.edit && count("APROVADO") > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-accent/40 bg-card px-4 py-3 text-sm">
          <CheckCircle2 size={16} className="text-success" />
          <span className="text-text-secondary"><b className="font-medium text-accent-light">{count("APROVADO")} {count("APROVADO") === 1 ? "post aprovado" : "posts aprovados"}</b> prontos para agendar na data prevista de cada um</span>
          <Button size="sm" variant="accent" className="ml-auto" disabled={pending} onClick={() => start(async () => { setBulk(null); const r = await scheduleAllAction(batch.id); setBulk(r.ok ? `${r.scheduled ?? 0} agendado${r.scheduled === 1 ? "" : "s"}.${r.skipped?.length ? ` Ficaram de fora: ${r.skipped.join("; ")}` : ""}` : (r.error ?? "Não foi possível agendar.")); refresh(); })}>{pending ? "Agendando…" : "Agendar todos"}</Button>
        </div>
      )}
      {bulk && <p className="text-sm text-text-secondary">{bulk}</p>}

      {perms.edit && posts.length > 0 && <SendPanel batch={batch} whatsapp={whatsapp} onDone={refresh} />}
      {msg && <p className="text-sm text-error">{msg}</p>}

      {posts.length > 0 && view === "calendario" ? (
        <CalendarView posts={posts} onOpen={(p) => setScheduling(p)} />
      ) : posts.length === 0 ? (
        <EmptyState icon={<CalendarClock size={26} />} title="Nenhum post neste lote" description="Adicione os posts do mês com vídeo ou imagem, legenda e data. Depois é só enviar o link para o cliente aprovar." />
      ) : (
        <div className="flex flex-col gap-3">
          {posts.map((p) => (
            <article key={p.id} className="flex flex-col gap-3 rounded-3xl border border-border bg-card p-4">
              <div className="flex items-start gap-3">
                <span className="relative flex h-[72px] w-[58px] shrink-0 items-center justify-center overflow-hidden rounded-xl bg-card-elevated text-text-tertiary">
                  {p.media[0]?.src ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.media[0].src} alt="" className="absolute inset-0 h-full w-full object-cover" />
                  ) : p.media[0]?.kind === "video" ? (
                    <Film size={18} />
                  ) : (
                    <ImageIcon size={18} />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <p className="text-sm font-semibold text-text-primary">{p.title}</p>
                    <Badge tone={TONE[p.status] ?? "neutral"}>{STATUS_LABELS[p.status] ?? p.status}</Badge>
                    {p.version > 1 && <Badge tone="neutral">v{p.version}</Badge>}
                  </div>
                  <p className="mt-0.5 text-xs text-text-tertiary">
                    {when(p.scheduledFor)} · {NETWORK_LABELS[p.network] ?? p.network} · {FORMAT_LABELS[p.format] ?? p.format} · {p.media.length} {p.media.length === 1 ? "arquivo" : "arquivos"}
                  </p>
                  {p.caption && <p className="mt-1.5 line-clamp-2 text-xs text-text-secondary">{p.caption}</p>}
                </div>
                <div className="flex shrink-0 items-center gap-0.5">
                  {perms.edit && (
                    <button type="button" onClick={() => setEditing(p)} className="rounded-full p-2 text-text-tertiary hover:bg-card-elevated hover:text-text-primary" aria-label="Editar post">
                      <Pencil size={14} />
                    </button>
                  )}
                  {perms.del && (
                    <button type="button" disabled={pending} onClick={() => confirm(`Excluir o post "${p.title}"?`) && act(() => deletePostAction(p.id))} className="rounded-full p-2 text-text-tertiary hover:bg-error/10 hover:text-error" aria-label="Excluir post">
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>

              {(targetsByPost[p.id] ?? []).filter((t) => t.status !== "CANCELADO").length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {(targetsByPost[p.id] ?? []).filter((t) => t.status !== "CANCELADO").map((t) => (
                    <span key={t.id} className={cn("rounded-full border px-2.5 py-1 text-[11px]", t.status === "FALHOU" ? "border-error/40 text-error" : t.status === "PUBLICADO" ? "border-success/40 text-success" : "border-border text-text-secondary")}>{NETWORK_LABEL[t.network as SocialNetwork] ?? t.network} · {TARGET_STATUS_LABEL[t.status] ?? t.status} · {when(t.scheduledFor)}</span>
                  ))}
                </div>
              )}

              {p.status === "AJUSTE" && p.feedback && (
                <div className="rounded-2xl border border-error/30 bg-error/10 px-4 py-3 text-sm">
                  <p className="text-xs font-medium text-error">O cliente pediu ajuste</p>
                  <p className="mt-1 text-text-primary">{p.feedback}</p>
                  {perms.edit && <p className="mt-2 text-xs text-text-tertiary">Edite o post e salve: ele volta para o cliente aprovar a nova versão.</p>}
                </div>
              )}

              <div className="flex flex-wrap items-center gap-2">
                {["APROVADO", "AGENDADO", "FALHOU", "PUBLICADO"].includes(p.status) && (
                  <Button size="sm" variant="accent" onClick={() => setScheduling(p)}>
                    <CalendarClock size={14} /> {p.status === "APROVADO" ? "Agendar publicação" : "Ver agendamento"}
                  </Button>
                )}
                {perms.edit && p.status === "APROVADO" && (
                  <Button size="sm" variant="secondary" disabled={pending} onClick={() => act(() => markPublishedAction(p.id, true))}>
                    <CheckCircle2 size={14} /> Marcar como publicado
                  </Button>
                )}
                {perms.edit && p.status === "PUBLICADO" && (
                  <Button size="sm" variant="ghost" disabled={pending} onClick={() => act(() => markPublishedAction(p.id, false))}>
                    Desfazer publicação
                  </Button>
                )}
                <button type="button" onClick={() => setOpenHistory(openHistory === p.id ? null : p.id)} className="flex items-center gap-1 text-xs text-text-tertiary hover:text-text-primary">
                  <ChevronRight size={13} className={cn("transition-transform", openHistory === p.id && "rotate-90")} /> Histórico
                </button>
              </div>
              {openHistory === p.id && (
                <ol className="flex flex-col gap-1.5 rounded-2xl bg-card-elevated/60 p-3 text-xs">
                  {p.events.map((e) => (
                    <li key={e.id} className="flex justify-between gap-3">
                      <span className="text-text-secondary">
                        {EVENT_LABEL[e.kind] ?? e.kind} · {e.actor}
                        {e.note ? ` — ${e.note}` : ""}
                      </span>
                      <span className="shrink-0 text-text-tertiary">{when(e.at)}</span>
                    </li>
                  ))}
                </ol>
              )}
            </article>
          ))}
        </div>
      )}

      {perms.del && (
        <button
          type="button"
          onClick={() => confirm("Excluir este lote e todos os posts dele? O link do cliente deixa de funcionar.") && start(async () => { await deleteBatchAction(batch.id); router.push("/conteudo"); })}
          className="w-fit text-xs text-text-tertiary hover:text-error"
        >
          Excluir este lote
        </button>
      )}

      {scheduling && (
        <SchedulePanel
          key={scheduling.id}
          post={posts.find((p) => p.id === scheduling.id) ?? scheduling}
          clientId={batch.clientId}
          accounts={accounts}
          targets={targetsByPost[scheduling.id] ?? []}
          tiktokPublic={tiktokPublic}
          canEdit={perms.edit}
          onClose={() => setScheduling(null)}
          onDone={() => {
            setScheduling(null);
            refresh();
          }}
        />
      )}

      <Drawer open={editing !== null} onClose={() => setEditing(null)} title={editing === "new" ? "Novo post" : "Editar post"}>
        {editing !== null && (
          <PostForm
            key={editing === "new" ? "new" : editing.id}
            batchId={batch.id}
            post={editing === "new" ? null : editing}
            onDone={() => {
              setEditing(null);
              refresh();
            }}
          />
        )}
      </Drawer>
    </div>
  );
}
