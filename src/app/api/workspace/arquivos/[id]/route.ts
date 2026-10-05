import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/guard";
import { permKey } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import { readLocalFile } from "@/lib/storage/local";

// Arquivos dos cartões do Workspace: só para quem acessa o Workspace da mesma organização.
export async function GET(request: Request, ctx: RouteContext<"/api/workspace/arquivos/[id]">) {
  const user = await getCurrentUser();
  if (!user || !hasPermission(user, permKey("TASKS", "VIEW"))) return new NextResponse("Não autorizado", { status: 401 });
  const { id } = await ctx.params;
  const a = await db.taskAttachment.findFirst({ where: { id, task: { organizationId: user.organizationId } } });
  if (!a?.storageKey) return new NextResponse("Não encontrado", { status: 404 });
  const buf = await readLocalFile(user.organizationId, `workspace/${a.storageKey}`).catch(() => null);
  if (!buf) return new NextResponse("Arquivo indisponível", { status: 404 });
  const download = new URL(request.url).searchParams.has("baixar");
  const inline = !download && /^(image|video|audio)\/|^application\/pdf$/.test(a.mimeType ?? "");
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": a.mimeType ?? "application/octet-stream",
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(a.name)}`,
      "Cache-Control": "private, max-age=86400",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
