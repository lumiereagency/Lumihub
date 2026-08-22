import "server-only";
import { db } from "@/lib/db";

const WINDOW_MINUTES = 15;
const MAX_FAILED_ATTEMPTS_PER_EMAIL = 5;
const MAX_FAILED_ATTEMPTS_PER_IP = 20;

export async function recordLoginAttempt(email: string, ip: string, success: boolean) {
  await db.loginAttempt.create({ data: { email: email.toLowerCase().trim(), ip, success } });
}

// Proteção contra brute force / rate limiting no login (Fase 1.5).
// Bloqueia por e-mail (evita ataque focado em uma conta) e por IP
// (evita varredura de várias contas a partir da mesma origem).
export async function isLoginRateLimited(
  email: string,
  ip: string,
): Promise<{ limited: boolean; reason?: string }> {
  const since = new Date(Date.now() - WINDOW_MINUTES * 60 * 1000);

  const [byEmail, byIp] = await Promise.all([
    db.loginAttempt.count({
      where: { email: email.toLowerCase().trim(), success: false, createdAt: { gt: since } },
    }),
    db.loginAttempt.count({
      where: { ip, success: false, createdAt: { gt: since } },
    }),
  ]);

  if (byEmail >= MAX_FAILED_ATTEMPTS_PER_EMAIL) {
    return { limited: true, reason: "account" };
  }
  if (byIp >= MAX_FAILED_ATTEMPTS_PER_IP) {
    return { limited: true, reason: "ip" };
  }
  return { limited: false };
}
