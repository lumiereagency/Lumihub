import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/guard";
import { permKey } from "@/lib/auth/permissions";
import { loadContractData } from "@/lib/contracts/contract-data";
import { renderContractPdf } from "@/lib/contracts/contract-pdf";

export const runtime = "nodejs";

// PDF do contrato gerado a partir do orçamento (pré-visualização e download).
export async function GET(request: Request, { params }: RouteContext<"/api/propostas/[id]/contrato">) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (!hasPermission(user, permKey("CRM", "VIEW")) && !hasPermission(user, permKey("CONTRACTS", "VIEW"))) {
    return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
  }
  const { id } = await params;
  const data = await loadContractData(user.organizationId, id);
  if (!data) return NextResponse.json({ error: "Orçamento não encontrado." }, { status: 404 });

  const pdf = await renderContractPdf(data);
  const download = new URL(request.url).searchParams.has("download");
  const fileName = `contrato-${data.code}-${data.contratante.name.normalize("NFD").replace(/[^\w]+/g, "-").toLowerCase().slice(0, 40)}.pdf`;
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${fileName}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
