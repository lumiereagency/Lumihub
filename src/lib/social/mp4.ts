// Leitura mínima de MP4/MOV para conferir duração e proporção antes de agendar.
// Só olha as "caixas" (atoms) do arquivo; nunca decodifica vídeo.

export interface Mp4Info {
  durationSec: number | null;
  width: number | null;
  height: number | null;
}

interface Box {
  type: string;
  start: number;
  size: number;
  header: number;
}

export function readBoxHeader(buf: Buffer, offset: number): Box | null {
  if (offset + 8 > buf.length) return null;
  let size = buf.readUInt32BE(offset);
  const type = buf.toString("latin1", offset + 4, offset + 8);
  let header = 8;
  if (size === 1) {
    if (offset + 16 > buf.length) return null;
    size = Number(buf.readBigUInt64BE(offset + 8));
    header = 16;
  } else if (size === 0) {
    size = buf.length - offset;
  }
  if (size < header) return null;
  return { type, start: offset, size, header };
}

function* children(buf: Buffer, from: number, to: number): Generator<Box> {
  let offset = from;
  while (offset + 8 <= to) {
    const box = readBoxHeader(buf, offset);
    if (!box) return;
    yield box;
    offset += box.size;
  }
}

function parseMvhd(buf: Buffer, box: Box): number | null {
  const p = box.start + box.header;
  const version = buf[p];
  if (version === 1) {
    if (p + 32 > buf.length) return null;
    const timescale = buf.readUInt32BE(p + 20);
    const duration = Number(buf.readBigUInt64BE(p + 24));
    return timescale ? duration / timescale : null;
  }
  if (p + 20 > buf.length) return null;
  const timescale = buf.readUInt32BE(p + 12);
  const duration = buf.readUInt32BE(p + 16);
  return timescale ? duration / timescale : null;
}

function parseTkhd(buf: Buffer, box: Box): { width: number; height: number } | null {
  const p = box.start + box.header;
  const version = buf[p];
  const matrix = version === 1 ? p + 52 : p + 40;
  const dims = version === 1 ? p + 88 : p + 76;
  if (dims + 8 > buf.length) return null;
  let width = buf.readUInt32BE(dims) / 65536;
  let height = buf.readUInt32BE(dims + 4) / 65536;
  // Celular filma "deitado" e marca a rotação na matriz: troca largura e altura.
  const a = buf.readInt32BE(matrix);
  const b = buf.readInt32BE(matrix + 4);
  if (a === 0 && b !== 0) [width, height] = [height, width];
  if (!width || !height) return null;
  return { width: Math.round(width), height: Math.round(height) };
}

// `buf` precisa conter a caixa "moov" inteira, começando em `moovStart`.
export function parseMoov(buf: Buffer, moovStart = 0): Mp4Info {
  const moov = readBoxHeader(buf, moovStart);
  const info: Mp4Info = { durationSec: null, width: null, height: null };
  if (!moov || moov.type !== "moov") return info;
  const end = Math.min(buf.length, moov.start + moov.size);
  for (const child of children(buf, moov.start + moov.header, end)) {
    if (child.type === "mvhd") info.durationSec = parseMvhd(buf, child);
    if (child.type === "trak") {
      const trakEnd = Math.min(end, child.start + child.size);
      for (const inner of children(buf, child.start + child.header, trakEnd)) {
        if (inner.type === "tkhd" && info.width === null) {
          const dims = parseTkhd(buf, inner);
          if (dims) {
            info.width = dims.width;
            info.height = dims.height;
          }
        }
      }
    }
  }
  if (info.durationSec !== null) info.durationSec = Math.round(info.durationSec * 10) / 10;
  return info;
}
