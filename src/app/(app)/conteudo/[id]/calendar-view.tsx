"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Film, ImageIcon } from "lucide-react";
import { NETWORK_LABELS, STATUS_LABELS } from "@/lib/content/media";
import { toBrtLocalInput } from "@/lib/social/time";
import { cn } from "@/lib/cn";
import type { PostRow } from "./batch-board";

const DOT: Record<string, string> = {
  RASCUNHO: "bg-text-tertiary",
  AGUARDANDO: "bg-warning",
  AJUSTE: "bg-error",
  APROVADO: "bg-success",
  AGENDADO: "bg-[#aab0ff]",
  PUBLICADO: "bg-[#8fd0dc]",
  FALHOU: "bg-error",
};
const MONTHS = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const DOW = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"];
const WEEKDAY = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

const dayOf = (iso: string) => toBrtLocalInput(new Date(iso)).slice(0, 10);
const timeOf = (iso: string) => toBrtLocalInput(new Date(iso)).slice(11, 16);

function Thumb({ post, className }: { post: PostRow; className: string }) {
  const m = post.media[0];
  return (
    <span className={cn("relative flex shrink-0 items-center justify-center overflow-hidden rounded-md bg-card-elevated text-text-tertiary", className)}>
      {m?.src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={m.src} alt="" className="absolute inset-0 h-full w-full object-cover" />
      ) : m?.kind === "video" ? (
        <Film size={12} />
      ) : (
        <ImageIcon size={12} />
      )}
    </span>
  );
}

export function CalendarView({ posts, onOpen }: { posts: PostRow[]; onOpen: (post: PostRow) => void }) {
  const [today] = useState(() => toBrtLocalInput(new Date()).slice(0, 10));
  const dated = useMemo(() => posts.filter((p) => p.scheduledFor), [posts]);
  const undated = posts.filter((p) => !p.scheduledFor);
  const [month, setMonth] = useState(() => {
    const first = dated.map((p) => dayOf(p.scheduledFor!)).sort()[0];
    return (first ?? today).slice(0, 7);
  });
  const [y, m] = month.split("-").map(Number);
  const shift = (delta: number) => {
    const d = new Date(Date.UTC(y, m - 1 + delta, 1));
    setMonth(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`);
  };
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const offset = new Date(Date.UTC(y, m - 1, 1)).getUTCDay();
  const byDay = useMemo(() => {
    const map = new Map<string, PostRow[]>();
    for (const p of dated) {
      const key = dayOf(p.scheduledFor!);
      if (!key.startsWith(month)) continue;
      map.set(key, [...(map.get(key) ?? []), p]);
    }
    for (const list of map.values()) list.sort((a, b) => a.scheduledFor!.localeCompare(b.scheduledFor!));
    return map;
  }, [dated, month]);
  const monthKeys = [...byDay.keys()].sort();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-text-primary">{MONTHS[m - 1]} de {y}</h2>
        <div className="flex gap-1">
          <button type="button" onClick={() => shift(-1)} aria-label="Mês anterior" className="flex h-9 w-9 items-center justify-center rounded-full border border-border text-text-secondary hover:bg-card-elevated"><ChevronLeft size={16} /></button>
          <button type="button" onClick={() => shift(1)} aria-label="Próximo mês" className="flex h-9 w-9 items-center justify-center rounded-full border border-border text-text-secondary hover:bg-card-elevated"><ChevronRight size={16} /></button>
        </div>
      </div>

      {/* Desktop: grade do mês */}
      <div className="hidden grid-cols-7 gap-1.5 md:grid">
        {DOW.map((d) => (
          <p key={d} className="pb-1 text-center text-[10px] tracking-[0.18em] text-text-tertiary">{d}</p>
        ))}
        {Array.from({ length: offset }, (_, i) => (
          <div key={`e${i}`} />
        ))}
        {Array.from({ length: days }, (_, i) => {
          const key = `${month}-${String(i + 1).padStart(2, "0")}`;
          const list = byDay.get(key) ?? [];
          return (
            <div key={key} className={cn("flex min-h-[112px] flex-col gap-1 rounded-2xl border bg-card p-1.5", key === today ? "border-accent" : "border-border")}>
              <span className="px-1 text-[11px] text-text-tertiary">{i + 1}</span>
              {list.map((p) => (
                <button key={p.id} type="button" onClick={() => onOpen(p)} title={`${p.title} · ${STATUS_LABELS[p.status] ?? p.status}`} className="flex items-center gap-1.5 rounded-lg bg-card-elevated p-1 text-left hover:brightness-125">
                  <Thumb post={p} className="h-7 w-5" />
                  <span className="min-w-0 flex-1">
                    <b className="block truncate text-[10.5px] font-medium text-text-primary">{p.title}</b>
                    <span className="flex items-center gap-1 text-[9.5px] text-text-tertiary"><i className={cn("h-1.5 w-1.5 rounded-full", DOT[p.status])} />{timeOf(p.scheduledFor!)} · {STATUS_LABELS[p.status] ?? p.status}</span>
                  </span>
                </button>
              ))}
            </div>
          );
        })}
      </div>

      {/* Celular: agenda por dia */}
      <div className="flex flex-col gap-2 md:hidden">
        {monthKeys.length === 0 && <p className="rounded-2xl border border-dashed border-border px-4 py-6 text-sm text-text-tertiary">Nenhum post com data neste mês.</p>}
        {monthKeys.map((key) => {
          const d = new Date(`${key}T12:00:00-03:00`);
          return (
            <div key={key} className="flex flex-col gap-1.5">
              <p className="pt-1 text-[10px] tracking-[0.2em] text-text-tertiary">{WEEKDAY[d.getUTCDay()].toUpperCase()} · {key.slice(8)}</p>
              {byDay.get(key)!.map((p) => (
                <button key={p.id} type="button" onClick={() => onOpen(p)} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-2 text-left">
                  <Thumb post={p} className="h-[54px] w-11 rounded-xl" />
                  <span className="min-w-0 flex-1">
                    <b className="block text-[13px] font-medium leading-snug text-text-primary">{p.title}</b>
                    <span className="mt-0.5 block text-[11px] text-text-tertiary">{timeOf(p.scheduledFor!)} · {NETWORK_LABELS[p.network] ?? p.network}</span>
                  </span>
                  <span className="flex shrink-0 items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-[10.5px] text-text-secondary"><i className={cn("h-1.5 w-1.5 rounded-full", DOT[p.status])} />{STATUS_LABELS[p.status] ?? p.status}</span>
                </button>
              ))}
            </div>
          );
        })}
      </div>

      {undated.length > 0 && (
        <div className="flex flex-col gap-1.5 rounded-2xl border border-dashed border-border p-3">
          <p className="text-xs font-medium text-text-secondary">Sem data ({undated.length})</p>
          <div className="flex flex-wrap gap-1.5">
            {undated.map((p) => (
              <button key={p.id} type="button" onClick={() => onOpen(p)} className="rounded-full border border-border px-3 py-1 text-xs text-text-secondary hover:bg-card-elevated">{p.title}</button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
