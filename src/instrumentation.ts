// Roda uma vez quando o servidor sobe: religa o WhatsApp da empresa, para que
// cobranças e lembretes não falhem logo depois de uma atualização do sistema.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  setTimeout(async () => {
    try {
      const { ensureWhatsAppSessions } = await import("@/lib/integrations/whatsapp-baileys");
      await ensureWhatsAppSessions();
    } catch (e) {
      console.error("[LUMIBASE] não foi possível religar o WhatsApp ao iniciar", (e as Error).message);
    }
  }, 5000);
}
