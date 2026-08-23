import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/guard";
import { permKey } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import { readLocalFile } from "@/lib/storage/local";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Não autenticado.", { status: 401 });
  if (!hasPermission(user, permKey("DOCUMENTS", "VIEW"))) {
    return new NextResponse("Sem permissão.", { status: 403 });
  }

  const { id } = await params;
  const document = await db.document.findFirst({ where: { id, organizationId: user.organizationId } });
  if (!document) return new NextResponse("Documento não encontrado.", { status: 404 });

  const buffer = await readLocalFile(user.organizationId, document.storageKey).catch(() => null);
  if (!buffer) return new NextResponse("Arquivo não encontrado no armazenamento.", { status: 404 });

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": document.mimeType,
      "Content-Disposition": `attachment; filename="${encodeURIComponent(document.name)}"`,
      "Content-Length": String(document.size),
    },
  });
}
