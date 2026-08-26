import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE_NAME } from "@/lib/auth/session-cookie";

// Checagem leve (sem acesso a banco) para redirecionar rápido usuários sem
// cookie de sessão. A validação completa (sessão válida + RBAC) acontece no
// layout autenticado, que roda em runtime Node.js com acesso ao Postgres.
//
// /midia/login, /midia/acao e /midia/publico precisam funcionar para quem
// NUNCA logou no LUMIBASE (convite novo, link de WhatsApp, link público
// compartilhado com quem nem tem conta) — sem cookie nenhum. Só essas três
// entram aqui; o resto de /midia (dashboard, escala, disponibilidade...)
// continua exigindo cookie normalmente, a checagem de sessão real desses
// três também acontece dentro de cada página/action, não é "sem proteção".
const PUBLIC_PATHS = [
  "/login",
  "/esqueci-senha",
  "/redefinir-senha",
  "/setup",
  "/acesso-negado",
  "/midia/login",
  "/midia/acao",
  "/midia/publico",
];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isPublic =
    PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`)) ||
    pathname.startsWith("/api/webhooks") ||
    // Logo/avatares do Mídia ADESF — a própria rota já não tem gate de
    // permissão de propósito (comentário em route.ts), justamente para
    // aparecer em /midia/login e /midia/publico antes de existir sessão;
    // sem esta linha o proxy intercepta a requisição da <img> antes dela
    // chegar na rota e devolve o HTML de /login no lugar da imagem.
    pathname.startsWith("/api/midia/arquivos/");

  if (isPublic) {
    return NextResponse.next();
  }

  const hasSessionCookie = request.cookies.has(SESSION_COOKIE_NAME);
  if (!hasSessionCookie) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
