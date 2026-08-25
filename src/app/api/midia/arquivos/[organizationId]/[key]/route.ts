import { NextResponse } from "next/server";
import { readMediaImage, mimeTypeForKey } from "@/lib/storage/media-files";

// Serve avatares e logo/identidade visual do módulo Mídia ADESF. Sem gate de
// permissão de propósito: são imagens não-sensíveis (mesmo risco de um CDN
// público de avatares) e a logo precisa aparecer na tela de login pública
// do portal (/midia/login), antes de qualquer sessão existir. A chave é um
// UUID aleatório por organização — não há como enumerar arquivos de outra
// organização sem já conhecer a chave.
export async function GET(_request: Request, { params }: { params: Promise<{ organizationId: string; key: string }> }) {
  const { organizationId, key } = await params;
  if (!/^[a-zA-Z0-9-]+$/.test(organizationId) || !/^[a-zA-Z0-9-]+\.[a-z]+$/.test(key)) {
    return new NextResponse("Não encontrado.", { status: 404 });
  }

  const buffer = await readMediaImage(organizationId, key).catch(() => null);
  if (!buffer) return new NextResponse("Não encontrado.", { status: 404 });

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": mimeTypeForKey(key),
      "Cache-Control": "public, max-age=86400",
    },
  });
}
