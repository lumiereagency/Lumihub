import "server-only";
import crypto from "node:crypto";
import { cookies, headers } from "next/headers";
import { db } from "@/lib/db";
import { SESSION_COOKIE_NAME } from "@/lib/auth/session-cookie";

export { SESSION_COOKIE_NAME };
const DEFAULT_SESSION_HOURS = 12;
const REMEMBER_SESSION_DAYS = 30;

function generateToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export async function getRequestMeta() {
  const h = await headers();
  const forwardedFor = h.get("x-forwarded-for");
  const ip = forwardedFor?.split(",")[0]?.trim() ?? h.get("x-real-ip") ?? null;
  const userAgent = h.get("user-agent");
  return { ip, userAgent };
}

export async function createSession(userId: string, remember: boolean) {
  const token = generateToken();
  const tokenHash = hashToken(token);
  const { ip, userAgent } = await getRequestMeta();

  const expiresAt = new Date(
    Date.now() +
      (remember ? REMEMBER_SESSION_DAYS * 24 : DEFAULT_SESSION_HOURS) * 60 * 60 * 1000,
  );

  await db.session.create({
    data: { userId, tokenHash, ip: ip ?? undefined, userAgent: userAgent ?? undefined, expiresAt },
  });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export type CurrentUser = {
  id: string;
  organizationId: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  role: { id: string; key: string; name: string };
  permissions: Set<string>;
  sessionId: string;
};

// Valida a sessão a partir do cookie e retorna o usuário autenticado com suas
// permissões efetivas (join Role -> RolePermission -> Permission). Retorna
// null quando não há sessão válida — nunca lança para fluxo de rota pública.
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;

  const tokenHash = hashToken(token);
  const session = await db.session.findUnique({
    where: { tokenHash },
    include: {
      user: {
        include: {
          role: {
            include: { permissions: { include: { permission: true } } },
          },
        },
      },
    },
  });

  if (!session || session.revokedAt || session.expiresAt < new Date()) {
    return null;
  }
  if (!session.user.isActive || session.user.deletedAt) {
    return null;
  }

  // Atualiza lastActiveAt no máximo a cada 5 minutos para reduzir escrita no banco.
  const staleMs = Date.now() - session.lastActiveAt.getTime();
  if (staleMs > 5 * 60 * 1000) {
    await db.session.update({
      where: { id: session.id },
      data: { lastActiveAt: new Date() },
    });
  }

  return {
    id: session.user.id,
    organizationId: session.user.organizationId,
    name: session.user.name,
    email: session.user.email,
    avatarUrl: session.user.avatarUrl,
    role: { id: session.user.role.id, key: session.user.role.key, name: session.user.role.name },
    permissions: new Set(session.user.role.permissions.map((rp) => rp.permission.key)),
    sessionId: session.id,
  };
}

export async function destroyCurrentSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (token) {
    const tokenHash = hashToken(token);
    await db.session.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
  cookieStore.delete(SESSION_COOKIE_NAME);
}

export async function listActiveSessions(userId: string) {
  return db.session.findMany({
    where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { lastActiveAt: "desc" },
  });
}

export async function revokeSession(sessionId: string, ownerUserId: string) {
  await db.session.updateMany({
    where: { id: sessionId, userId: ownerUserId },
    data: { revokedAt: new Date() },
  });
}

export async function revokeAllOtherSessions(userId: string, currentSessionId: string) {
  await db.session.updateMany({
    where: { userId, id: { not: currentSessionId }, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}
