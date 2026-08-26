import "server-only";
import path from "node:path";
import { makeWASocket, useMultiFileAuthState as loadBaileysAuthState, DisconnectReason, type WASocket } from "baileys";
import QRCode from "qrcode";
import { db } from "@/lib/db";

interface SessionState {
  sock: WASocket | null;
  qrDataUrl: string | null;
  status: "connecting" | "qr" | "connected" | "disconnected";
  phoneNumber: string | null;
}

// Singleton em memória do processo (mesmo padrão do cliente Prisma em
// @/lib/db) — a conexão do WhatsApp é um WebSocket persistente, não algo
// que se recria a cada requisição. Uma sessão por organização.
declare global {
  var __lumibaseWhatsAppSessions: Map<string, SessionState> | undefined;
}
const sessions = globalThis.__lumibaseWhatsAppSessions ?? new Map<string, SessionState>();
globalThis.__lumibaseWhatsAppSessions = sessions;

function authDir(organizationId: string): string {
  return path.join(process.cwd(), "storage", "whatsapp-auth", organizationId);
}

export interface WhatsAppSessionStatus {
  status: "connecting" | "qr" | "connected" | "disconnected";
  qrDataUrl: string | null;
  phoneNumber: string | null;
}

export function getWhatsAppSessionStatus(organizationId: string): WhatsAppSessionStatus {
  const session = sessions.get(organizationId);
  if (!session) return { status: "disconnected", qrDataUrl: null, phoneNumber: null };
  return { status: session.status, qrDataUrl: session.qrDataUrl, phoneNumber: session.phoneNumber };
}

// Conecta (ou reconecta) a sessão do WhatsApp de uma organização via
// Baileys — um WebSocket não-oficial que simula o WhatsApp Web (pareado
// por QR code, sem aprovação da Meta). Idempotente: chamar de novo com uma
// sessão já conectando/conectada não faz nada.
export async function startWhatsAppSession(organizationId: string): Promise<void> {
  const existing = sessions.get(organizationId);
  if (existing && (existing.status === "connecting" || existing.status === "connected")) return;

  const session: SessionState = { sock: null, qrDataUrl: null, status: "connecting", phoneNumber: null };
  sessions.set(organizationId, session);

  const { state, saveCreds } = await loadBaileysAuthState(authDir(organizationId));
  const sock = makeWASocket({ auth: state });
  session.sock = sock;

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", async (update) => {
    const current = sessions.get(organizationId);
    if (!current) return;

    if (update.qr) {
      current.qrDataUrl = await QRCode.toDataURL(update.qr);
      current.status = "qr";
    }

    if (update.connection === "open") {
      current.status = "connected";
      current.qrDataUrl = null;
      current.phoneNumber = sock.user?.id?.split(":")[0] ?? null;

      await db.integration.upsert({
        where: { organizationId_provider: { organizationId, provider: "WHATSAPP_BUSINESS" } },
        create: {
          organizationId,
          provider: "WHATSAPP_BUSINESS",
          category: "COMUNICACAO",
          status: "CONECTADO",
          config: { connectedNumber: current.phoneNumber ?? "" },
          connectedAt: new Date(),
        },
        update: {
          status: "CONECTADO",
          config: { connectedNumber: current.phoneNumber ?? "" },
          connectedAt: new Date(),
        },
      });
    }

    if (update.connection === "close") {
      const statusCode = (update.lastDisconnect?.error as { output?: { statusCode?: number } } | undefined)?.output
        ?.statusCode;
      const loggedOut = statusCode === DisconnectReason.loggedOut;

      current.sock = null;
      current.status = "disconnected";

      if (loggedOut) {
        current.qrDataUrl = null;
        sessions.delete(organizationId);
        await db.integration.updateMany({
          where: { organizationId, provider: "WHATSAPP_BUSINESS" },
          data: { status: "DESCONECTADO", connectedAt: null },
        });
      } else {
        // Queda de conexão sem logout explícito (rede, etc.) — reconecta
        // sozinho usando as credenciais já pareadas, sem pedir QR de novo.
        await startWhatsAppSession(organizationId);
      }
    }
  });
}

export async function disconnectWhatsAppSession(organizationId: string): Promise<void> {
  const session = sessions.get(organizationId);
  if (session?.sock) {
    try {
      await session.sock.logout();
    } catch {
      // segue o fluxo mesmo se o logout remoto falhar — a sessão local é
      // removida de qualquer forma.
    }
  }
  sessions.delete(organizationId);
}

export async function sendWhatsAppBaileysMessage(
  organizationId: string,
  to: string,
  message: string,
): Promise<{ delivered: boolean; pending: boolean; error?: string }> {
  const session = sessions.get(organizationId);
  if (!session || session.status === "disconnected") {
    // Sem sessão em memória (ex: logo após um restart do servidor) mas com
    // credenciais já pareadas em disco — tenta reconectar sozinho em
    // segundo plano, sem pedir QR de novo. Não bloqueia este envio.
    void startWhatsAppSession(organizationId);
    console.info(`[LUMIBASE][whatsapp:pendente] WhatsApp reconectando (Baileys). Mensagem não enviada.\nPara: ${to}\n${message}`);
    return { delivered: false, pending: true };
  }
  if (!session.sock || session.status !== "connected") {
    console.info(`[LUMIBASE][whatsapp:pendente] WhatsApp não conectado (Baileys). Mensagem não enviada.\nPara: ${to}\n${message}`);
    return { delivered: false, pending: true };
  }

  try {
    const digits = normalizeBrazilPhoneDigits(to);
    // onWhatsApp confirma que o número existe de verdade no WhatsApp E
    // devolve o JID canônico — sem isso, um número sem o "55" na frente
    // (bug real encontrado: telefones aqui são salvos no formato local,
    // "11987654321", não internacional) monta um JID que nunca corresponde
    // a nenhuma conta, e sendMessage "funciona" (não lança erro) sem a
    // mensagem chegar a lugar nenhum — daí parecer que o disparo "não
    // funciona" mesmo sem nenhum erro no log.
    const [check] = (await session.sock.onWhatsApp(digits)) ?? [];
    if (!check?.exists) {
      return { delivered: false, pending: false, error: `Número ${digits} não está registrado no WhatsApp (confira o DDD e o dígito 9).` };
    }
    await session.sock.sendMessage(check.jid, { text: message });
    return { delivered: true, pending: false };
  } catch (err) {
    console.error("[LUMIBASE][whatsapp:erro] Falha ao enviar mensagem via Baileys.", err);
    return { delivered: false, pending: false, error: (err as Error).message };
  }
}

// Números de membros são digitados em formato local brasileiro
// ("11987654321" ou com máscara "(11) 98765-4321"), sem código do país —
// o JID do WhatsApp exige o "55" na frente. DDD + número local sempre tem
// 10 (fixo) ou 11 (celular) dígitos no Brasil, então o código do país nunca
// é ambíguo com um número que já veio completo (12/13 dígitos).
function normalizeBrazilPhoneDigits(phone: string): string {
  let digits = phone.replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("0")) digits = digits.slice(1);
  if (digits.length === 10 || digits.length === 11) digits = `55${digits}`;
  return digits;
}
