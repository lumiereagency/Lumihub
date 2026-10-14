import "server-only";
import { parseMoov, readBoxHeader, type Mp4Info } from "./mp4";
import type { MediaProbe } from "./checks";

// O vídeo continua no Drive do cliente. A Lumibase lê pelo mesmo link que já precisa
// estar com "qualquer pessoa com o link" para o cliente aprovar, e nunca guarda o arquivo.

export function driveFileId(raw: string): string | null {
  try {
    const url = new URL(raw);
    if (url.hostname.replace(/^www\./, "") !== "drive.google.com") return null;
    return url.pathname.match(/\/file\/d\/([\w-]+)/)?.[1] ?? url.searchParams.get("id");
  } catch {
    return null;
  }
}

const DOWNLOAD = (id: string) => `https://drive.usercontent.google.com/download?id=${encodeURIComponent(id)}&export=download&confirm=t`;

export class DriveAccessError extends Error {}

// Abre o arquivo (ou um pedaço dele, com `range`). Se o Drive devolver uma página em vez
// do arquivo, o link não está aberto para quem tem o link.
export async function openDriveFile(fileId: string, range?: string): Promise<Response> {
  const res = await fetch(DOWNLOAD(fileId), { headers: range ? { Range: range } : undefined, redirect: "follow" });
  const type = res.headers.get("content-type") ?? "";
  if (!res.ok && res.status !== 206) {
    throw new DriveAccessError(res.status === 404 ? "O arquivo não existe mais no Drive." : `O Drive recusou o acesso (HTTP ${res.status}).`);
  }
  if (type.startsWith("text/html")) {
    throw new DriveAccessError("O Drive não liberou o arquivo. Compartilhe o vídeo como “qualquer pessoa com o link”.");
  }
  return res;
}

function totalFromRange(res: Response): number | null {
  const cr = res.headers.get("content-range");
  const total = cr?.match(/\/(\d+)$/)?.[1];
  if (total) return Number(total);
  const len = res.headers.get("content-length");
  return res.status === 200 && len ? Number(len) : null;
}

async function rangeBytes(fileId: string, from: number, to: number): Promise<{ buf: Buffer; total: number | null }> {
  const res = await openDriveFile(fileId, `bytes=${from}-${to}`);
  const total = totalFromRange(res);
  if (res.status === 200) {
    // O Drive ignorou o Range: não vamos baixar o vídeo inteiro só para conferir.
    await res.body?.cancel();
    throw new DriveAccessError("O Drive não permitiu ler o arquivo por partes.");
  }
  return { buf: Buffer.from(await res.arrayBuffer()), total };
}

// Lê só os cabeçalhos do MP4 (alguns pedidos pequenos) para achar duração e proporção.
export async function probeDriveVideo(fileId: string): Promise<MediaProbe> {
  const base: MediaProbe = { kind: "video" };
  try {
    const first = await rangeBytes(fileId, 0, 4095);
    base.sizeBytes = first.total;
    const total = first.total ?? 0;
    if (!total || first.buf.length < 12 || first.buf.toString("latin1", 4, 8) !== "ftyp") {
      return { ...base, unreadable: "O arquivo não é um MP4/MOV legível." };
    }
    let offset = 0;
    let head = first.buf;
    let headStart = 0;
    for (let hops = 0; hops < 12 && offset < total; hops++) {
      let box = offset >= headStart && offset + 16 <= headStart + head.length ? readBoxHeader(head, offset - headStart) : null;
      if (!box) {
        const piece = await rangeBytes(fileId, offset, offset + 15);
        box = readBoxHeader(piece.buf, 0);
      }
      if (!box) break;
      if (box.type === "moov") {
        if (box.size > 24 * 1024 * 1024) return { ...base, unreadable: "Os dados do vídeo são grandes demais para conferir." };
        const moov = await rangeBytes(fileId, offset, offset + box.size - 1);
        const info: Mp4Info = parseMoov(moov.buf, 0);
        return { ...base, durationSec: info.durationSec, width: info.width, height: info.height };
      }
      offset += box.size;
      head = Buffer.alloc(0);
      headStart = offset;
    }
    return { ...base, unreadable: "Não encontrei a duração no arquivo." };
  } catch (e) {
    return { ...base, unreadable: e instanceof Error ? e.message : "Não consegui ler o arquivo." };
  }
}
