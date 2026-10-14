"use client";

import type { ReactNode } from "react";
import { Bookmark, Film, Heart, ImageIcon, MessageCircle, MoreHorizontal, Send, Share2, ThumbsUp } from "lucide-react";
import type { SocialNetwork } from "@/lib/social/networks";

export interface PreviewMedia {
  kind: "video" | "image";
  src: string | null;
  embed: string | null;
}

export interface PreviewProps {
  network: SocialNetwork;
  format: string;
  accountName: string;
  title: string;
  caption: string;
  media: PreviewMedia[];
  showZones: boolean;
}

function Surface({ media, className = "" }: { media: PreviewMedia | undefined; className?: string }) {
  return (
    <div className={`${className.includes("absolute") ? "" : "relative "}overflow-hidden bg-[#14110b] ${className}`}>
      {media?.src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={media.src} alt="" className="absolute inset-0 h-full w-full object-cover" />
      ) : media?.embed ? (
        <iframe src={media.embed} title="Vídeo do post" allow="autoplay; fullscreen" className="absolute inset-0 h-full w-full border-0" />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-[#2a2112] to-[#7b5f27] text-white/70">{media?.kind === "video" ? <Film size={32} /> : <ImageIcon size={32} />}</div>
      )}
    </div>
  );
}

const Zone = ({ children }: { children: ReactNode }) => (
  <div className="pointer-events-none absolute inset-0 z-10">{children}</div>
);
const hatch = "bg-[repeating-linear-gradient(135deg,rgba(230,90,70,.30)_0_8px,rgba(230,90,70,.10)_8px_16px)]";

function Phone({ children }: { children: ReactNode }) {
  return <div className="relative mx-auto w-[290px] overflow-hidden rounded-[34px] border-[7px] border-[#2a2722] bg-black text-white shadow-xl">{children}</div>;
}

function clampCaption(text: string, max: number): { text: string; cut: boolean } {
  const oneLine = text.replace(/\s+/g, " ").trim();
  return oneLine.length > max ? { text: oneLine.slice(0, max).trimEnd(), cut: true } : { text: oneLine, cut: false };
}

function Vertical({ p, brand, side, zoneLabel }: { p: PreviewProps; brand: ReactNode; side: string[]; zoneLabel: string }) {
  const cap = clampCaption(p.caption || p.title, 90);
  return (
    <Phone>
      <div className="relative h-[515px]">
        <Surface media={p.media[0]} className="absolute inset-0" />
        <div className="pointer-events-none absolute left-0 right-0 top-0 z-20 flex items-center justify-between px-4 pt-4 text-[13px] font-semibold [text-shadow:0_1px_6px_#000]">{brand}</div>
        <div className="pointer-events-none absolute bottom-[170px] right-2.5 z-20 flex flex-col gap-3.5 text-center text-[10px]">
          {side.map((s) => (
            <div key={s}>
              <i className="mx-auto mb-0.5 block h-7 w-7 rounded-full bg-white/25" />
              {s}
            </div>
          ))}
        </div>
        <div className="pointer-events-none absolute bottom-3 left-3 right-14 z-20 text-[12px] leading-snug [text-shadow:0_1px_6px_#000]">
          <b className="mb-1 block text-[12.5px]">{p.accountName}</b>
          {cap.text}
          {cap.cut && <span className="text-white/60">… mais</span>}
        </div>
        {p.showZones && (
          <Zone>
            <div className={`absolute inset-x-0 bottom-0 h-[150px] border-t border-dashed border-[#ff7a66] ${hatch}`} />
            <div className={`absolute bottom-[150px] right-0 top-[250px] w-[58px] border-l border-dashed border-[#ff7a66] ${hatch}`} />
            <span className="absolute bottom-[158px] left-2.5 rounded-full bg-black/75 px-2 py-0.5 text-[9.5px] text-[#ffb3a6]">{zoneLabel}</span>
          </Zone>
        )}
      </div>
    </Phone>
  );
}

function InstagramFeed({ p }: { p: PreviewProps }) {
  const cap = clampCaption(p.caption, 125);
  return (
    <Phone>
      <div className="flex items-center justify-between border-b border-white/10 bg-[#0a0a0a] px-4 py-3 text-[15px] font-semibold italic">
        Instagram <span className="flex gap-3 not-italic"><Heart size={17} /><Send size={17} /></span>
      </div>
      <div className="flex items-center gap-2 bg-[#0a0a0a] px-3 py-2.5">
        <i className="h-7 w-7 rounded-full bg-gradient-to-tr from-[#f9a34a] via-[#d6249f] to-[#5b51d8]" />
        <b className="text-[12px]">{p.accountName.replace(/^@/, "")}</b>
        <MoreHorizontal size={16} className="ml-auto" />
      </div>
      <Surface media={p.media[0]} className="aspect-[4/5] w-full" />
      <div className="flex items-center gap-3 bg-[#0a0a0a] px-3 py-2.5"><Heart size={18} /><MessageCircle size={18} /><Send size={18} /><Bookmark size={18} className="ml-auto" /></div>
      <p className="bg-[#0a0a0a] px-3 pb-4 text-[12px] leading-snug">
        <b>{p.accountName.replace(/^@/, "")}</b> {cap.text}
        {cap.cut && <span className="text-white/50">… mais</span>}
      </p>
    </Phone>
  );
}

function FacebookPost({ p }: { p: PreviewProps }) {
  const video = p.media[0]?.kind === "video";
  return (
    <Phone>
      <div className="flex items-center justify-between bg-[#18191a] px-4 py-3 text-[16px] font-bold text-[#4a8cff]">facebook</div>
      <div className="flex items-center gap-2 bg-[#18191a] px-3 py-2.5">
        <i className="h-8 w-8 rounded-full bg-[#2f5a63]" />
        <div className="leading-tight">
          <b className="block text-[12.5px]">{p.accountName}</b>
          <small className="text-[10.5px] text-white/50">Agendado · Público</small>
        </div>
        <MoreHorizontal size={16} className="ml-auto" />
      </div>
      <p className="bg-[#18191a] px-3 pb-2.5 text-[12.5px] leading-snug">{p.caption || p.title}</p>
      <Surface media={p.media[0]} className={video ? "aspect-video w-full" : "aspect-[4/5] w-full"} />
      <div className="flex justify-around border-t border-white/10 bg-[#18191a] py-2.5 text-[11.5px] text-white/60">
        <span className="flex items-center gap-1"><ThumbsUp size={14} /> Curtir</span>
        <span className="flex items-center gap-1"><MessageCircle size={14} /> Comentar</span>
        <span className="flex items-center gap-1"><Share2 size={14} /> Compartilhar</span>
      </div>
    </Phone>
  );
}

function YoutubeVideo({ p }: { p: PreviewProps }) {
  return (
    <Phone>
      <Surface media={p.media[0]} className="aspect-video w-full" />
      <div className="bg-[#0f0f0f] px-3 py-3">
        <b className="block text-[13px] leading-snug">{p.title}</b>
        <p className="mt-1 text-[11px] text-white/50">{p.accountName} · agora</p>
        <p className="mt-2 line-clamp-3 text-[11.5px] text-white/70">{p.caption}</p>
      </div>
    </Phone>
  );
}

export function NetworkPreview(p: PreviewProps) {
  if (p.network === "INSTAGRAM") return p.format === "REELS" ? <Vertical p={p} brand={<><span>Reels</span><span>📷</span></>} side={["2.481", "136", "Enviar"]} zoneLabel="Zona coberta pelo Instagram" /> : <InstagramFeed p={p} />;
  if (p.network === "FACEBOOK") return <FacebookPost p={p} />;
  if (p.network === "TIKTOK") return <Vertical p={p} brand={<><span>Seguindo &nbsp; Para você</span><span>🔍</span></>} side={["1,2 mil", "84", "Salvar", "Enviar"]} zoneLabel="Zona coberta pelo TikTok" />;
  return p.format === "VIDEO" ? <YoutubeVideo p={p} /> : <Vertical p={p} brand={<><span>Shorts</span><span>🔍</span></>} side={["12 mil", "Não gostei", "312", "Compart."]} zoneLabel="Zona coberta pelo YouTube" />;
}

