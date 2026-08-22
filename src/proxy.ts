import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE_NAME } from "@/lib/auth/session-cookie";

// Checagem leve (sem acesso a banco) para redirecionar rápido usuários sem
// cookie de sessão. A validação completa (sessão válida + RBAC) acontece no
// layout autenticado, que roda em runtime Node.js com acesso ao Postgres.
const PUBLIC_PATHS = ["/login", "/esqueci-senha", "/redefinir-senha", "/setup", "/acesso-negado"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isPublic =
    PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`)) ||
    pathname.startsWith("/api/webhooks");

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
