import { db } from "@/lib/db";
import { readLocalFile } from "@/lib/storage/local";
import type { MediaItem } from "@/lib/content/media";

// Imagem de um post, servida só com o token do lote (página do cliente e tela da equipe).
export async function GET(_req: Request, { params }: { params: Promise<{ token: string; postId: string; idx: string }> }) {
  const { token, postId, idx } = await params;
  if (token.length < 16 || token.length > 64) return new Response("Não encontrado", { status: 404 });
  const post = await db.contentPost.findFirst({ where: { id: postId, batch: { publicToken: token } }, select: { organizationId: true, media: true } });
  const item = ((post?.media as unknown as MediaItem[]) ?? [])[Number(idx)];
  if (!post || !item?.storageKey) return new Response("Não encontrado", { status: 404 });
  try {
    const buf = await readLocalFile(post.organizationId, item.storageKey);
    const type = item.storageKey.endsWith(".png") ? "image/png" : item.storageKey.endsWith(".webp") ? "image/webp" : "image/jpeg";
    return new Response(new Uint8Array(buf), { headers: { "Content-Type": type, "Cache-Control": "private, max-age=3600" } });
  } catch {
    return new Response("Não encontrado", { status: 404 });
  }
}
