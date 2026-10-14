"use client";

import { useState, useTransition } from "react";
import type { CSSProperties } from "react";
import { Check, CheckCircle2, ChevronLeft, ExternalLink, MessageSquareText, Play } from "lucide-react";
import { Logo } from "@/components/layout/logo";
import { approvePostAction, requestAdjustmentAction } from "@/lib/actions/content-public-actions";

// Mesma identidade do orçamento e da página de pagamento: preto quente, dourado, Poppins.
const THEME: CSSProperties = {
  ["--p-bg" as string]: "#0B0A08",
  ["--p-surface" as string]: "#13110D",
  ["--p-raised" as string]: "#1B1813",
  ["--p-line" as string]: "#2B261D",
  ["--p-text" as string]: "#F5F0E6",
  ["--p-muted" as string]: "#A69E8E",
  ["--p-faint" as string]: "#6F685B",
  ["--p-gold" as string]: "#D6B266",
  ["--p-gold-grad" as string]: "linear-gradient(120deg,#F6DDA0 0%,#D6B266 45%,#9E7B37 100%)",
  fontFamily: "var(--font-poppins), ui-sans-serif, system-ui, sans-serif",
  background: "#0B0A08",
  color: "#F5F0E6",
};
const goldText = "bg-[image:var(--p-gold-grad)] bg-clip-text text-transparent";

export interface ApprovalPost {
  id: string;
  title: string;
  caption: string | null;
  network: string;
  format: string;
  vertical: boolean;
  scheduledFor: string | null;
  status: string;
  feedback: string | null;
  media: { kind: "video" | "image"; provider: string | null; embed: string | null; url: string; src: string | null }[];
}

const TZ = "America/Sao_Paulo";
const when = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("pt-BR", { weekday: "short", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: TZ }).replace(".", "").replace(",", " ·") : "Data a combinar";

const CHIP: Record<string, { label: string; cls: string }> = {
  AGUARDANDO: { label: "Ver", cls: "border-[#6b5524] text-[var(--p-gold)]" },
  APROVADO: { label: "Aprovado", cls: "border-[#3c5a3c] text-[#8fcf95]" },
  PUBLICADO: { label: "Publicado", cls: "border-[#3c5a3c] text-[#8fcf95]" },
  AJUSTE: { label: "Ajuste enviado", cls: "border-[#6a4b3a] text-[#E8A48C]" },
};

function Media({ post }: { post: ApprovalPost }) {
  const [idx, setIdx] = useState(0);
  const m = post.media[idx];
  if (!m) return null;
  const ratio = post.vertical ? "aspect-[9/16] max-h-[70dvh]" : "aspect-video";
  return (
    <div className="flex flex-col gap-3">
      <div className={`relative mx-auto w-full overflow-hidden rounded-3xl border border-[var(--p-line)] bg-black ${m.kind === "image" ? "" : ratio}`}>
        {m.kind === "image" && m.src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={m.src} alt={post.title} className="mx-auto max-h-[70dvh] w-full object-contain" />
        ) : m.embed ? (
          <iframe src={m.embed} title={post.title} allow="autoplay; fullscreen; picture-in-picture" allowFullScreen loading="lazy" className="absolute inset-0 h-full w-full border-0" />
        ) : (
          <a href={m.url} target="_blank" rel="noopener noreferrer" className={`flex ${ratio} flex-col items-center justify-center gap-3 bg-[var(--p-raised)] text-sm`}>
            <span className="flex h-16 w-16 items-center justify-center rounded-full border border-[var(--p-gold)] text-[var(--p-gold)]">
              <Play size={24} />
            </span>
            <span className="flex items-center gap-1.5 text-[var(--p-muted)]">
              Abrir o vídeo <ExternalLink size={13} />
            </span>
          </a>
        )}
      </div>
      {post.media.length > 1 && (
        <div className="flex justify-center gap-1.5" role="tablist" aria-label="Arquivos do post">
          {post.media.map((_, i) => (
            <button key={i} type="button" role="tab" aria-selected={i === idx} aria-label={`Arquivo ${i + 1}`} onClick={() => setIdx(i)} className={`h-2 rounded-full transition-all ${i === idx ? "w-6 bg-[var(--p-gold)]" : "w-2 bg-[var(--p-line)]"}`} />
          ))}
        </div>
      )}
    </div>
  );
}

function PostScreen({ token, post, onBack, onChanged }: { token: string; post: ApprovalPost; onBack: () => void; onChanged: (p: Partial<ApprovalPost>) => void }) {
  const [mode, setMode] = useState<"view" | "adjust">("view");
  const [topics, setTopics] = useState<string[]>([]);
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const open = post.status === "AGUARDANDO" || post.status === "APROVADO";

  function approve() {
    setError(null);
    start(async () => {
      const r = await approvePostAction(token, post.id);
      if (r.ok) onChanged({ status: "APROVADO" });
      else setError(r.error ?? "Não foi possível aprovar. Tente de novo.");
    });
  }
  function sendAdjust() {
    setError(null);
    start(async () => {
      const r = await requestAdjustmentAction(token, post.id, topics, comment);
      if (r.ok) {
        onChanged({ status: "AJUSTE", feedback: `${topics.length ? `[${topics.join(", ")}] ` : ""}${comment}` });
        setMode("view");
      } else setError(r.error ?? "Não foi possível enviar. Tente de novo.");
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <button type="button" onClick={mode === "adjust" ? () => setMode("view") : onBack} className="flex w-fit items-center gap-1 text-[13px] text-[var(--p-muted)]">
        <ChevronLeft size={15} /> {mode === "adjust" ? "Voltar ao post" : "Voltar ao mês"}
      </button>

      {mode === "view" ? (
        <>
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-[var(--p-gold)]">
              {post.network} · {post.format}
            </p>
            <h1 className="mt-2 text-balance text-2xl font-semibold leading-tight tracking-tight">{post.title}</h1>
            <p className="mt-1 text-[13px] font-light text-[var(--p-muted)]">Publicação prevista: {when(post.scheduledFor)}</p>
          </div>
          <Media post={post} />
          {post.caption && (
            <div className="whitespace-pre-wrap rounded-3xl border border-[var(--p-line)] bg-[var(--p-surface)] px-5 py-4 text-[14px] font-light leading-relaxed">
              <span className="text-[var(--p-gold)]">Legenda: </span>
              {post.caption}
            </div>
          )}

          {post.status === "APROVADO" || post.status === "PUBLICADO" ? (
            <div className="flex items-start gap-3 rounded-2xl border border-[var(--p-gold)]/40 bg-[var(--p-raised)] px-4 py-3 text-sm">
              <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-[var(--p-gold)]" />
              <p>{post.status === "PUBLICADO" ? "Este post já foi publicado. Obrigado!" : "Aprovado! Vamos agendar e te avisar quando for ao ar."}</p>
            </div>
          ) : post.status === "AJUSTE" ? (
            <div className="rounded-2xl border border-[#6a4b3a] bg-[var(--p-raised)] px-4 py-3 text-sm">
              <p className="font-medium text-[#E8A48C]">Ajuste enviado para a equipe</p>
              {post.feedback && <p className="mt-1 text-[13px] font-light text-[var(--p-muted)]">{post.feedback}</p>}
              <p className="mt-2 text-[12px] text-[var(--p-faint)]">Quando a nova versão estiver pronta, ela volta aqui para você aprovar.</p>
            </div>
          ) : null}

          {open && (
            <div className="flex flex-col gap-3">
              {post.status === "AGUARDANDO" && (
                <button type="button" disabled={pending} onClick={approve} className="flex h-[52px] w-full items-center justify-center gap-2 rounded-full bg-[image:var(--p-gold-grad)] text-[15px] font-semibold text-[#1A1408] shadow-[0_10px_30px_-12px_rgba(214,178,102,0.7)] active:scale-[0.99] disabled:opacity-60">
                  <Check size={18} /> {pending ? "Aprovando…" : "Aprovar este post"}
                </button>
              )}
              <button type="button" onClick={() => setMode("adjust")} className="flex h-[52px] w-full items-center justify-center gap-2 rounded-full border border-[var(--p-line)] text-[15px] hover:border-[var(--p-gold)]">
                <MessageSquareText size={16} /> {post.status === "APROVADO" ? "Mudei de ideia, pedir ajuste" : "Pedir ajuste"}
              </button>
            </div>
          )}
        </>
      ) : (
        <>
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-[var(--p-gold)]">Pedir ajuste</p>
            <h1 className="mt-2 text-balance text-2xl font-semibold leading-tight tracking-tight">O que você gostaria de mudar?</h1>
          </div>
          <div className="flex flex-wrap gap-2">
            {["Legenda", "Vídeo ou imagem", "Data e hora", "Outro"].map((t) => {
              const on = topics.includes(t);
              return (
                <button key={t} type="button" aria-pressed={on} onClick={() => setTopics((x) => (on ? x.filter((y) => y !== t) : [...x, t]))} className={`rounded-full border px-4 py-2 text-[13px] ${on ? "border-[var(--p-gold)] bg-[var(--p-gold)]/10 text-[var(--p-gold)]" : "border-[var(--p-line)] text-[var(--p-muted)]"}`}>
                  {t}
                </button>
              );
            })}
          </div>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={6}
            maxLength={1000}
            placeholder="Conte com suas palavras o que precisa mudar."
            aria-label="Comentário"
            className="rounded-3xl border border-[var(--p-line)] bg-[var(--p-raised)] px-5 py-4 text-[14px] font-light leading-relaxed text-[var(--p-text)] placeholder:text-[var(--p-faint)] focus:border-[var(--p-gold)] focus:outline-none"
          />
          <button type="button" disabled={pending} onClick={sendAdjust} className="flex h-[52px] w-full items-center justify-center rounded-full bg-[image:var(--p-gold-grad)] text-[15px] font-semibold text-[#1A1408] disabled:opacity-60">
            {pending ? "Enviando…" : "Enviar para a equipe"}
          </button>
          <p className="text-center text-[12px] text-[var(--p-faint)]">A equipe é avisada na hora e o post volta para você aprovar já ajustado.</p>
        </>
      )}
      {error && <p className="text-sm text-[#E8A48C]">{error}</p>}
    </div>
  );
}

export function ApprovalView({ token, batchName, clientName, greeting, posts: initial }: { token: string; batchName: string; clientName: string; greeting: string; posts: ApprovalPost[] }) {
  const [posts, setPosts] = useState(initial);
  const [openId, setOpenId] = useState<string | null>(null);
  const open = posts.find((p) => p.id === openId) ?? null;
  const approved = posts.filter((p) => p.status === "APROVADO" || p.status === "PUBLICADO").length;
  const waiting = posts.filter((p) => p.status === "AGUARDANDO").length;
  const pct = posts.length ? Math.round((approved / posts.length) * 100) : 0;

  return (
    <div style={THEME} className="relative min-h-dvh">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-80 bg-[radial-gradient(60%_100%_at_50%_0%,rgba(214,178,102,0.16),transparent)]" />
      <main className="relative mx-auto flex w-full max-w-md flex-col gap-6 px-5 pb-16 pt-8">
        <header className="flex items-center gap-3">
          <Logo size="md" gradientId="appr-mark" className="h-6 w-9" />
          <span className="truncate text-[11px] font-medium uppercase tracking-[0.24em] text-[var(--p-muted)]">Lumière Agency</span>
        </header>

        {open ? (
          <PostScreen
            key={open.id}
            token={token}
            post={open}
            onBack={() => setOpenId(null)}
            onChanged={(patch) => setPosts((list) => list.map((p) => (p.id === open.id ? { ...p, ...patch } : p)))}
          />
        ) : (
          <>
            <section className="flex flex-col gap-2">
              <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-[var(--p-gold)]">Conteúdo de {batchName}</p>
              <h1 className="text-[32px] font-semibold leading-tight tracking-tight">
                Olá, <span className={goldText}>{greeting}</span>
              </h1>
              <p className="text-[14px] font-light leading-relaxed text-[var(--p-muted)]">
                Preparamos {posts.length} {posts.length === 1 ? "post" : "posts"} para o <span className="font-medium text-[var(--p-text)]">{clientName}</span>. Toque em cada um para ver como vai ficar e aprovar.
              </p>
            </section>

            {posts.length > 0 && (
              <section className="flex flex-col gap-2">
                <div className="flex justify-between text-[12px] text-[var(--p-muted)]">
                  <span>
                    {approved} de {posts.length} aprovados
                  </span>
                  <span>{waiting > 0 ? `${waiting} aguardando você` : "Tudo respondido 🎉"}</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-[var(--p-raised)]">
                  <div className="h-full rounded-full bg-[image:var(--p-gold-grad)] transition-all" style={{ width: `${pct}%` }} />
                </div>
              </section>
            )}

            <section className="flex flex-col gap-3">
              {posts.length === 0 && <p className="rounded-3xl border border-[var(--p-line)] bg-[var(--p-surface)] px-5 py-8 text-center text-sm text-[var(--p-muted)]">Ainda não há posts liberados neste link.</p>}
              {posts.map((p) => {
                const first = p.media[0];
                const chip = CHIP[p.status] ?? CHIP.AGUARDANDO;
                return (
                  <button key={p.id} type="button" onClick={() => setOpenId(p.id)} className="flex items-center gap-3 rounded-[20px] border border-[var(--p-line)] bg-[var(--p-surface)] p-2.5 text-left active:scale-[0.99]">
                    <span className="relative flex h-[72px] w-[58px] shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[linear-gradient(160deg,#2a2112,#7b5f27)]">
                      {first?.kind === "image" && first.src ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={first.src} alt="" className="absolute inset-0 h-full w-full object-cover" />
                      ) : (
                        <Play size={16} className="text-[var(--p-gold)]" />
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13.5px] font-medium leading-snug">{p.title}</span>
                      <span className="block text-[11.5px] font-light text-[var(--p-muted)]">{when(p.scheduledFor)}</span>
                      <span className="mt-0.5 block text-[10px] uppercase tracking-[0.16em] text-[var(--p-faint)]">
                        {p.network} · {p.format}
                      </span>
                    </span>
                    <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[10.5px] ${chip.cls}`}>{chip.label}</span>
                  </button>
                );
              })}
            </section>
          </>
        )}

        <footer className="pt-2 text-center text-[11px] leading-relaxed text-[var(--p-faint)]">Link exclusivo do seu conteúdo. Suas aprovações ficam registradas com data e hora.</footer>
      </main>
    </div>
  );
}
