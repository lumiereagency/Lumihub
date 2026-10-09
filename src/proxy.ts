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
  // Orçamento enviado ao cliente por link (token aleatório é a credencial).
  "/orcamento",
  // Link de pagamento enviado na cobrança (token aleatório é a credencial).
  "/pagar",
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
    pathname.startsWith("/api/midia/arquivos/") ||
    // Rotas de cron (§ mesmo bug de novo, achado ao adicionar o cron de
    // escalonamento de trocas): chamadas por curl do crontab do servidor,
    // sem cookie nenhum — sem esta linha, o proxy redireciona a chamada
    // pra /login antes dela chegar na checagem de CRON_SECRET da própria
    // rota, e o job nunca roda de verdade (nem generate-receivables, que
    // já existia, nem o de escalonamento novo).
    pathname.startsWith("/api/cron/");

  // Guarda o endereço pedido para o portal de mídia voltar para ele depois do login.
  const forwarded = new Headers(request.headers);
  forwarded.set("x-lb-path", pathname + request.nextUrl.search);

  if (isPublic) {
    return NextResponse.next({ request: { headers: forwarded } });
  }

  const hasSessionCookie = request.cookies.has(SESSION_COOKIE_NAME);
  if (!hasSessionCookie) {
    // Quem abre uma página do portal de mídia sem estar logado vai para o login
    // do portal (e volta para a página pedida), não para o login da LUMIBASE.
    if (pathname.startsWith("/midia/")) {
      const mediaLogin = new URL("/midia/login", request.url);
      mediaLogin.searchParams.set("next", pathname + request.nextUrl.search);
      return NextResponse.redirect(mediaLogin);
    }
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next({ request: { headers: forwarded } });
}

export const config = {
  // Ícones, manifesto e telas de abertura do app precisam abrir sem login
  // (o navegador busca antes de existir sessão, inclusive na tela de login).
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|apple-icon.png|manifest.webmanifest|icons/|splash/|sw.js).*)"],
};
