import { NETWORK_LABEL, NETWORK_LIMITS, type SocialNetwork } from "./networks";

// Resultado da leitura de um arquivo do post (feita no servidor).
export interface MediaProbe {
  kind: "video" | "image";
  // Para o vídeo vindo de link que não é do Drive (YouTube/Vimeo/outro).
  unsupportedLink?: boolean;
  width?: number | null;
  height?: number | null;
  durationSec?: number | null;
  sizeBytes?: number | null;
  // Não foi possível ler o arquivo (formato diferente de MP4, arquivo fechado...).
  unreadable?: string | null;
}

export type CheckLevel = "ok" | "warn" | "error";
export interface Check {
  level: CheckLevel;
  title: string;
  detail: string;
}

export interface CheckInput {
  network: SocialNetwork;
  format: string;
  title: string;
  caption: string;
  media: MediaProbe[];
  account: { status: string; statusMessage?: string | null } | null;
  scheduledFor: Date | null;
  tiktokPublic?: boolean;
  // Reddit: comunidade escolhida para o post.
  subreddit?: string;
}

const MB = 1024 * 1024;

function fmtDuration(sec: number): string {
  const total = Math.round(sec);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

function ratioLabel(w: number, h: number): string {
  const r = w / h;
  if (Math.abs(r - 9 / 16) < 0.03) return "9:16";
  if (Math.abs(r - 4 / 5) < 0.03) return "4:5";
  if (Math.abs(r - 1) < 0.03) return "1:1";
  if (Math.abs(r - 16 / 9) < 0.03) return "16:9";
  return `${w}×${h}`;
}

function countHashtags(text: string): number {
  return (text.match(/(^|\s)#[\p{L}\p{N}_]+/gu) ?? []).length;
}

export function runChecks(input: CheckInput): Check[] {
  const { network, format, caption, media, account } = input;
  const out: Check[] = [];
  const ok = (title: string, detail: string) => out.push({ level: "ok", title, detail });
  const warn = (title: string, detail: string) => out.push({ level: "warn", title, detail });
  const err = (title: string, detail: string) => out.push({ level: "error", title, detail });
  const label = NETWORK_LABEL[network];

  if (!account) err(`Conta do ${label} não conectada`, "Conecte a conta do cliente para poder agendar nesta rede.");
  else if (account.status !== "ATIVA") err(`Conta do ${label} precisa ser reconectada`, account.statusMessage ?? "A conexão expirou ou foi revogada. Reconecte a conta do cliente.");

  if (media.length === 0) {
    err("Post sem arquivo", "Adicione uma imagem ou o link de um vídeo do Drive.");
    return out;
  }
  const videos = media.filter((m) => m.kind === "video");
  const images = media.filter((m) => m.kind === "image");
  const video = videos[0];

  if (videos.some((v) => v.unsupportedLink)) {
    err("Vídeo não está no Drive", "Para publicar, o vídeo precisa ser um link do Google Drive (com acesso por link). Links do YouTube e do Vimeo servem só para aprovação.");
  }

  const probed = video && !video.unsupportedLink ? video : null;
  if (probed?.unreadable) warn("Não consegui ler o vídeo", `${probed.unreadable} Confira duração e proporção antes de agendar.`);

  const vertical = probed?.width && probed?.height ? probed.height > probed.width : null;
  const limits = NETWORK_LIMITS;

  if (network === "INSTAGRAM") {
    const l = limits.INSTAGRAM;
    const asReels = format === "REELS" || (videos.length > 0 && images.length === 0);
    if (asReels) {
      if (videos.length !== 1 || images.length > 0) err("Reels aceita um vídeo", "Deixe só um vídeo neste post, ou mude o formato para Feed (carrossel).");
      if (probed?.width && probed?.height) {
        if (vertical) ok(`Formato ${ratioLabel(probed.width, probed.height)}`, "Proporção vertical, ideal para Reels.");
        else warn("Vídeo não é vertical", `O vídeo é ${ratioLabel(probed.width, probed.height)}. No Reels ele aparece com faixas pretas; o ideal é 9:16.`);
      }
      if (probed?.durationSec != null) {
        if (probed.durationSec > l.reelsMaxSeconds) err(`Duração ${fmtDuration(probed.durationSec)}`, "O Reels aceita até 15 minutos.");
        else if (probed.durationSec < l.reelsMinSeconds) err(`Duração ${fmtDuration(probed.durationSec)}`, "O Reels precisa ter pelo menos 3 segundos.");
        else ok(`Duração ${fmtDuration(probed.durationSec)}`, "Dentro do limite do Reels.");
      }
      if (probed?.sizeBytes && probed.sizeBytes > l.reelsMaxMB * MB) err("Arquivo muito grande", `O Reels aceita até ${l.reelsMaxMB} MB. Este tem ${Math.round(probed.sizeBytes / MB)} MB.`);
    } else {
      if (media.length > l.carouselMax) err("Carrossel com itens demais", `O Instagram aceita até ${l.carouselMax} itens. Este post tem ${media.length}.`);
      for (const img of images) {
        if (img.width && img.height) {
          const r = img.width / img.height;
          if (r < l.feedRatio[0] - 0.01 || r > l.feedRatio[1] + 0.01) {
            err("Proporção da imagem fora do aceito", `O Instagram aceita de 4:5 a 1,91:1. Esta imagem é ${ratioLabel(img.width, img.height)}.`);
            break;
          }
        }
      }
      if (images.length > 0 && !out.some((c) => c.level === "error" && c.title.startsWith("Proporção"))) ok("Imagem no formato do Feed", "Proporção dentro do aceito pelo Instagram.");
    }
    const tags = countHashtags(caption);
    if (tags > l.hashtagsMax) err("Hashtags demais", `O Instagram aceita até ${l.hashtagsMax}. A legenda tem ${tags}.`);
    if (caption.length > l.captionMax) err("Legenda longa demais", `${caption.length} de ${l.captionMax} caracteres.`);
    else if (caption.length > l.captionMax * 0.9) warn("Legenda perto do limite", `${caption.length} de ${l.captionMax} caracteres.`);
    else ok("Legenda dentro do limite", `${caption.length} de ${l.captionMax} caracteres.`);
  }

  if (network === "FACEBOOK") {
    const l = limits.FACEBOOK;
    if (videos.length > 0 && images.length > 0) err("Imagem e vídeo juntos", "No Facebook, publique só imagens ou só um vídeo por post.");
    if (videos.length > 1) err("Um vídeo por post", "O Facebook publica um vídeo por vez.");
    if (probed?.sizeBytes && probed.sizeBytes > l.videoMaxMB * MB) err("Arquivo muito grande", `Acima de ${l.videoMaxMB} MB o envio pela Lumibase fica instável. Este tem ${Math.round(probed.sizeBytes / MB)} MB.`);
    if (probed?.durationSec != null) ok(`Duração ${fmtDuration(probed.durationSec)}`, "Dentro do limite do Facebook.");
    if (caption.length > l.captionMax) err("Texto longo demais", `${caption.length} de ${l.captionMax} caracteres.`);
    else ok("Texto dentro do limite", `${caption.length} caracteres.`);
  }

  if (network === "TIKTOK") {
    const l = limits.TIKTOK;
    if (images.length > 0 || videos.length === 0) err("TikTok publica só vídeo", "Nesta versão, o TikTok recebe vídeo. Imagens ainda não são enviadas.");
    if (videos.length > 1) err("Um vídeo por post", "O TikTok publica um vídeo por vez.");
    if (probed?.width && probed?.height) {
      if (vertical) ok(`Formato ${ratioLabel(probed.width, probed.height)}`, "O vídeo está na proporção vertical ideal.");
      else warn("Vídeo não é vertical", `O vídeo é ${ratioLabel(probed.width, probed.height)}; no TikTok o ideal é 9:16.`);
    }
    if (probed?.durationSec != null) {
      if (probed.durationSec > l.videoMaxSeconds) err(`Duração ${fmtDuration(probed.durationSec)}`, "O limite é de 10 minutos por vídeo.");
      else ok(`Duração ${fmtDuration(probed.durationSec)}`, "Dentro do limite da rede (até 10 minutos).");
    }
    if (probed?.sizeBytes && probed.sizeBytes > l.videoMaxMB * MB) err("Arquivo muito grande", `Acima de ${l.videoMaxMB} MB o envio fica instável. Este tem ${Math.round(probed.sizeBytes / MB)} MB.`);
    else if (probed?.sizeBytes) ok(`Tamanho ${Math.round(probed.sizeBytes / MB)} MB`, "Aceito pela rede.");
    if (caption.length > l.captionMax) err("Legenda longa demais", `${caption.length} de ${l.captionMax} caracteres.`);
    else if (caption.length > l.captionMax * 0.9) warn("Legenda perto do limite", `${caption.length} de ${l.captionMax} caracteres. Considere encurtar.`);
    else ok("Legenda dentro do limite", `${caption.length} de ${l.captionMax} caracteres.`);
    if (input.tiktokPublic === false) warn("TikTok ainda em modo privado", "Enquanto o app do TikTok não passa pela auditoria, os vídeos saem como privados (só a conta vê). Veja o guia em Integrações.");
  }

  if (network === "YOUTUBE") {
    const l = limits.YOUTUBE;
    if (images.length > 0 || videos.length === 0) err("YouTube publica só vídeo", "Adicione o link de um vídeo do Drive.");
    if (videos.length > 1) err("Um vídeo por post", "O YouTube publica um vídeo por vez.");
    if (input.title.length > l.titleMax) err("Título longo demais", `${input.title.length} de ${l.titleMax} caracteres.`);
    else if (!input.title.trim()) err("Título obrigatório", "O YouTube exige um título.");
    else ok("Título dentro do limite", `${input.title.length} de ${l.titleMax} caracteres.`);
    if (caption.length > l.descriptionMax) err("Descrição longa demais", `${caption.length} de ${l.descriptionMax} caracteres.`);
    if (probed?.durationSec != null) {
      if (format === "REELS" && probed.durationSec > l.shortsMaxSeconds) warn("Passa de 3 minutos", "Com mais de 3 minutos o vídeo não vira Shorts: será publicado como vídeo normal.");
      else ok(`Duração ${fmtDuration(probed.durationSec)}`, format === "REELS" ? "Dentro do limite de Shorts (até 3 minutos)." : "Vídeo normal.");
    }
    if (format === "REELS" && probed?.width && probed?.height) {
      if (vertical) ok(`Formato ${ratioLabel(probed.width, probed.height)}`, "Vertical, como o Shorts pede.");
      else warn("Vídeo não é vertical", "Para virar Shorts o vídeo precisa ser vertical. Será publicado como vídeo normal.");
    }
    if (probed?.sizeBytes && probed.sizeBytes > l.videoMaxMB * MB) err("Arquivo muito grande", `Acima de ${l.videoMaxMB} MB o envio fica instável. Este tem ${Math.round(probed.sizeBytes / MB)} MB.`);
  }

  if (network === "TWITTER") {
    const l = limits.TWITTER;
    const text = caption.trim() || input.title;
    if (videos.length > 0 && images.length > 0) err("Imagem e vídeo juntos", "No X, publique só imagens (até 4) ou só um vídeo por post.");
    if (images.length > l.images) err("Imagens demais", `O X aceita até ${l.images} imagens por post. Este tem ${images.length}.`);
    if (videos.length > 1) err("Um vídeo por post", "O X publica um vídeo por vez.");
    if (text.length > l.textMaxPremium) err("Texto longo demais", `${text.length} de ${l.textMaxPremium} caracteres.`);
    else if (text.length > l.textMax) warn("Texto passa de 280 caracteres", `Só contas com X Premium aceitam textos longos (${text.length} caracteres). Em conta comum, o X recusa a publicação.`);
    else ok("Texto dentro do limite", `${text.length} de ${l.textMax} caracteres.`);
    if (probed?.durationSec != null) {
      if (probed.durationSec > l.videoMaxSeconds) err(`Duração ${fmtDuration(probed.durationSec)}`, "O limite é de 20 minutos por vídeo.");
      else if (probed.durationSec > l.videoSoftSeconds) warn(`Duração ${fmtDuration(probed.durationSec)}`, "Contas sem X Premium aceitam vídeos de até 2:20. Acima disso o X pode recusar.");
      else ok(`Duração ${fmtDuration(probed.durationSec)}`, "Dentro do limite do X.");
    }
    if (probed?.sizeBytes && probed.sizeBytes > l.videoMaxMB * MB) err("Arquivo muito grande", `Acima de ${l.videoMaxMB} MB o envio fica instável. Este tem ${Math.round(probed.sizeBytes / MB)} MB.`);
  }

  if (network === "THREADS") {
    const l = limits.THREADS;
    const text = caption.trim() || input.title;
    if (media.length > l.carouselMax) err("Itens demais", `O Threads aceita até ${l.carouselMax} itens por post. Este tem ${media.length}.`);
    if (text.length > l.textMax) err("Texto longo demais", `${text.length} de ${l.textMax} caracteres.`);
    else ok("Texto dentro do limite", `${text.length} de ${l.textMax} caracteres.`);
    if (countHashtags(text) > 1) warn("Mais de uma hashtag", "O Threads trata só uma hashtag por post como tópico.");
    if (probed?.durationSec != null) {
      if (probed.durationSec > l.videoMaxSeconds) err(`Duração ${fmtDuration(probed.durationSec)}`, "O Threads aceita vídeos de até 5 minutos.");
      else ok(`Duração ${fmtDuration(probed.durationSec)}`, "Dentro do limite do Threads.");
    }
    if (probed?.sizeBytes && probed.sizeBytes > l.videoMaxMB * MB) err("Arquivo muito grande", `O Threads aceita até 1 GB. Este tem ${Math.round(probed.sizeBytes / MB)} MB.`);
    if (probed?.width && probed?.height) {
      const r = probed.width / probed.height;
      if (r < 0.01 || r > 10) err("Proporção fora do aceito", "O Threads aceita proporções de 0,01:1 a 10:1.");
    }
    ok("Limite diário", "O Threads aceita até 250 posts por dia por perfil pela API.");
  }

  if (network === "LINKEDIN") {
    const l = limits.LINKEDIN;
    const text = caption.trim() || input.title;
    if (videos.length > 0 && images.length > 0) err("Imagem e vídeo juntos", "No LinkedIn, publique só imagens ou só um vídeo por post.");
    if (videos.length > 1) err("Um vídeo por post", "O LinkedIn publica um vídeo por vez.");
    if (images.length > l.images) err("Imagens demais", `O LinkedIn aceita até ${l.images} imagens por post.`);
    if (text.length > l.textMax) err("Texto longo demais", `${text.length} de ${l.textMax} caracteres.`);
    else ok("Texto dentro do limite", `${text.length} de ${l.textMax} caracteres.`);
    if (probed?.durationSec != null) {
      if (probed.durationSec > l.videoMaxSeconds) err(`Duração ${fmtDuration(probed.durationSec)}`, "O LinkedIn aceita vídeos de até 30 minutos.");
      else if (probed.durationSec < l.videoMinSeconds) err(`Duração ${fmtDuration(probed.durationSec)}`, "O LinkedIn exige pelo menos 3 segundos.");
      else ok(`Duração ${fmtDuration(probed.durationSec)}`, "Dentro do limite do LinkedIn.");
    }
    if (probed?.sizeBytes && probed.sizeBytes > l.videoMaxMB * MB) err("Arquivo muito grande", `O LinkedIn aceita vídeos de até ${l.videoMaxMB} MB. Este tem ${Math.round(probed.sizeBytes / MB)} MB.`);
    if (account && account.status === "ATIVA") ok("Autor da publicação", "A publicação sai no perfil ou na página escolhida ao conectar a conta.");
  }

  if (network === "REDDIT") {
    const l = limits.REDDIT;
    if (videos.length > 0) err("Reddit sem vídeo por aqui", "Nesta versão, o Reddit recebe texto e uma imagem. Para vídeo, publique direto no Reddit.");
    if (images.length > 1) err("Uma imagem por post", "O Reddit recebe uma imagem por post nesta versão.");
    if (!input.title.trim()) err("Título obrigatório", "O Reddit exige um título.");
    else if (input.title.length > l.titleMax) err("Título longo demais", `${input.title.length} de ${l.titleMax} caracteres.`);
    else ok("Título dentro do limite", `${input.title.length} de ${l.titleMax} caracteres.`);
    if (!input.subreddit?.trim()) err("Escolha a comunidade", "Informe o subreddit (ex.: r/suamarca) ou u/usuario para publicar no perfil.");
    else ok("Comunidade escolhida", input.subreddit.trim());
    if (caption.length > l.textMax) err("Texto longo demais", `${caption.length} de ${l.textMax} caracteres.`);
    warn("Regras da comunidade", "Cada comunidade tem regras próprias e moderadores podem remover o post. Confira antes de agendar.");
  }

  if (input.scheduledFor && input.scheduledFor.getTime() < Date.now() - 60_000) {
    warn("Horário já passou", "O post será publicado na próxima rodada (em até 5 minutos).");
  }
  return out;
}

export function hasBlockingError(checks: Check[]): boolean {
  return checks.some((c) => c.level === "error");
}
