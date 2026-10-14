import { db } from "@/lib/db";
import type { MediaItem } from "@/lib/content/media";
import { driveFileId, openDriveFile } from "@/lib/social/drive";
import { verifyMediaSignature } from "@/lib/social/media-url";

// Entrega o vídeo do Drive para o Instagram/Facebook buscarem na hora de publicar.
// Só funciona com endereço assinado e temporário; nada é guardado aqui.
export async function GET(request: Request, { params }: { params: Promise<{ targetId: string; idx: string }> }) {
  const { targetId, idx } = await params;
  const url = new URL(request.url);
  const index = Number(idx);
  if (!Number.isInteger(index) || !verifyMediaSignature(targetId, index, Number(url.searchParams.get("exp")), url.searchParams.get("sig") ?? "")) {
    return new Response("Não autorizado", { status: 403 });
  }
  const target = await db.contentPostTarget.findUnique({ where: { id: targetId }, select: { post: { select: { media: true } } } });
  const item = ((target?.post.media as unknown as MediaItem[]) ?? [])[index];
  const fileId = item ? driveFileId(item.url) : null;
  if (!fileId) return new Response("Não encontrado", { status: 404 });
  try {
    const upstream = await openDriveFile(fileId, request.headers.get("range") ?? undefined);
    const headers = new Headers({ "Content-Type": "video/mp4", "Accept-Ranges": "bytes", "Cache-Control": "private, no-store" });
    for (const h of ["content-length", "content-range"]) {
      const v = upstream.headers.get(h);
      if (v) headers.set(h, v);
    }
    return new Response(upstream.body, { status: upstream.status === 206 ? 206 : 200, headers });
  } catch (e) {
    return new Response((e as Error).message, { status: 502 });
  }
}
