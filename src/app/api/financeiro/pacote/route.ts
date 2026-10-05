import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { hasPermission, isDirector } from "@/lib/auth/guard";
import { permKey } from "@/lib/auth/permissions";
import { buildAccountingPackage } from "@/lib/finance/accounting-export";
import { audit } from "@/lib/audit";

// Pacote do mês para a contabilidade (.zip com planilhas e comprovantes).
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (!isDirector(user) && !hasPermission(user, permKey("REPORTS", "EXPORT"))) return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
  const mes = new URL(request.url).searchParams.get("mes") ?? "";
  if (!/^\d{4}-\d{2}$/.test(mes)) return NextResponse.json({ error: "Mês inválido." }, { status: 400 });
  const { file, name } = await buildAccountingPackage(user.organizationId, mes);
  await audit({ organizationId: user.organizationId, userId: user.id, action: "ACCOUNTING_EXPORT", entityType: "Organization", metadata: { mes } });
  return new NextResponse(Buffer.from(file), {
    headers: { "Content-Type": "application/zip", "Content-Disposition": `attachment; filename="${name}"`, "Cache-Control": "no-store" },
  });
}
