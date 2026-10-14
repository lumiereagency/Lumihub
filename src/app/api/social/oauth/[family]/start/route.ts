import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/guard";
import { permKey } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import { createOAuthState, generateCodeVerifier } from "@/lib/integrations/oauth-state";
import { getSocialApp } from "@/lib/social/apps";
import { buildAuthUrl } from "@/lib/social/connect";
import { isConnectFamily } from "@/lib/social/networks";

const COOKIE = "lumibase_social_state";

// Começa a conexão de uma rede social de um cliente: leva a pessoa à tela de consentimento da rede.
export async function GET(request: NextRequest, { params }: { params: Promise<{ family: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.redirect(new URL("/login", request.url));
  if (!hasPermission(user, permKey("TASKS", "EDIT"))) return NextResponse.redirect(new URL("/acesso-negado", request.url));

  const { family } = await params;
  const clientId = request.nextUrl.searchParams.get("clientId") ?? "";
  const back = (message: string) => {
    const url = new URL(clientId ? `/clientes/${clientId}/redes` : "/conteudo", request.url);
    url.searchParams.set("erro", message);
    return NextResponse.redirect(url);
  };
  if (!isConnectFamily(family)) return new NextResponse("Rede desconhecida.", { status: 404 });
  const client = await db.client.findFirst({ where: { id: clientId, organizationId: user.organizationId }, select: { id: true } });
  if (!client) return new NextResponse("Cliente não encontrado.", { status: 404 });

  const app = await getSocialApp(user.organizationId, family);
  if (!app) return back("Cadastre as credenciais do app desta rede em Configurações → Integrações antes de conectar.");

  const state = createOAuthState({ provider: `social:${family}`, organizationId: user.organizationId, userId: user.id, codeVerifier: generateCodeVerifier(), clientId: client.id });
  const response = NextResponse.redirect(buildAuthUrl(family, app, state));
  response.cookies.set({ name: COOKIE, value: state, httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 10 * 60 });
  return response;
}
