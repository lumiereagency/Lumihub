import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { verifyOAuthState } from "@/lib/integrations/oauth-state";
import { encryptSecret } from "@/lib/integrations/vault";
import { getSocialApp } from "@/lib/social/apps";
import { discoverCandidates } from "@/lib/social/connect";
import { isConnectFamily } from "@/lib/social/networks";

const COOKIE = "lumibase_social_state";

// Volta da rede: troca o código por tokens, lista as contas disponíveis e leva
// a equipe à tela em que escolhe quais ligar ao cliente.
export async function GET(request: NextRequest, { params }: { params: Promise<{ family: string }> }) {
  const { family } = await params;
  const fail = (clientId: string | undefined, message: string) => {
    const url = new URL(clientId ? `/clientes/${clientId}/redes` : "/conteudo", request.url);
    url.searchParams.set("erro", message);
    const res = NextResponse.redirect(url);
    res.cookies.delete(COOKIE);
    return res;
  };
  if (!isConnectFamily(family)) return fail(undefined, "Rede desconhecida.");

  const { searchParams } = request.nextUrl;
  const returnedState = searchParams.get("state");
  const cookieState = request.cookies.get(COOKIE)?.value;
  const state = returnedState && cookieState && returnedState === cookieState ? verifyOAuthState(returnedState) : null;
  if (!state || state.provider !== `social:${family}` || !state.clientId) return fail(undefined, "A conexão expirou. Tente conectar de novo.");

  const denied = searchParams.get("error");
  if (denied) return fail(state.clientId, `Conexão cancelada: ${searchParams.get("error_description") ?? searchParams.get("error_reason") ?? denied}`);
  const code = searchParams.get("code");
  if (!code) return fail(state.clientId, "A rede não devolveu o código de autorização.");

  const app = await getSocialApp(state.organizationId, family);
  if (!app) return fail(state.clientId, "As credenciais do app não estão no cofre de Integrações.");

  try {
    const candidates = await discoverCandidates(family, app, code, state.codeVerifier);
    if (candidates.length === 0) return fail(state.clientId, "Não encontrei contas nesta autorização. Marque as páginas e contas ao conectar.");
    const sealed = encryptSecret(JSON.stringify(candidates));
    const session = await db.socialConnectSession.create({
      data: {
        organizationId: state.organizationId,
        clientId: state.clientId,
        network: family,
        userId: state.userId,
        payloadEnc: sealed.encryptedValue,
        payloadIv: sealed.iv,
        payloadTag: sealed.authTag,
        expiresAt: new Date(Date.now() + 30 * 60 * 1000),
      },
    });
    await db.socialConnectSession.deleteMany({ where: { expiresAt: { lt: new Date() } } });
    const url = new URL(`/clientes/${state.clientId}/redes`, request.url);
    url.searchParams.set("escolher", session.id);
    const res = NextResponse.redirect(url);
    res.cookies.delete(COOKIE);
    return res;
  } catch (e) {
    return fail(state.clientId, (e as Error).message);
  }
}
