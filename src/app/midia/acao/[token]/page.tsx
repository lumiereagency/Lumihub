import { CalendarClock, CheckCircle2, XCircle } from "lucide-react";
import { db } from "@/lib/db";
import { mediaThemeStyle } from "@/lib/media/theme";
import { resolveActionToken } from "@/lib/media/tokens/action-tokens";
import { respondAvailabilityTokenAction } from "@/lib/actions/media-action-token-actions";
import { formatDateTime } from "@/lib/format";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

// Página pública (sem login) aberta a partir do link de WhatsApp. Nunca
// executa a ação no GET — só mostra o que o clique vai fazer; a gravação
// só acontece quando o membro aperta o botão (POST via server action).
// Isso é obrigatório, não só boa prática: o próprio WhatsApp abre o link
// uma vez sozinho para gerar a prévia da mensagem, e se essa abertura já
// consumisse o token de uso único, o clique de verdade da pessoa cairia
// num link "já usado" sem ela nunca ter respondido nada.
export default async function MediaActionTokenPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const resolved = await resolveActionToken(token);

  const brand = resolved.organizationId ? await db.mediaBrandSettings.findUnique({ where: { organizationId: resolved.organizationId } }) : null;

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-background px-4" style={mediaThemeStyle(brand)}>
      <div className="w-full max-w-[420px] rounded-2xl border border-border bg-card p-6 text-center">
        {brand?.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={brand.logoUrl} alt={brand.environmentName} className="mx-auto mb-4 h-12 w-auto object-contain" />
        ) : (
          <div className="mx-auto mb-4 h-12 w-12 rounded-2xl bg-[image:var(--lh-accent-gradient)]" />
        )}

        {resolved.status === "not_found" && (
          <>
            <XCircle size={32} className="mx-auto mb-3 text-error" />
            <p className="text-sm text-text-secondary">Este link não é válido.</p>
          </>
        )}

        {resolved.status === "expired" && (
          <>
            <XCircle size={32} className="mx-auto mb-3 text-error" />
            <p className="text-sm text-text-secondary">Este link expirou. Fale com a liderança da equipe de mídia.</p>
          </>
        )}

        {resolved.status === "used" && (
          <>
            <CheckCircle2 size={32} className="mx-auto mb-3 text-success" />
            <p className="text-sm font-medium text-text-primary">Resposta já registrada.</p>
            <p className="mt-1 text-sm text-text-secondary">Obrigado, {resolved.memberName}!</p>
          </>
        )}

        {resolved.status === "valid" && (
          <>
            <CalendarClock size={32} className="mx-auto mb-3 text-accent-light" />
            <p className="text-sm text-text-secondary">Olá, {resolved.memberName}.</p>
            <p className="mt-1 text-base font-medium text-text-primary">Você está disponível para servir em:</p>
            <p className="mt-2 text-lg font-semibold text-text-primary">{resolved.eventName}</p>
            <p className="text-sm text-text-tertiary">
              {formatDateTime(resolved.eventStartAt!)}
              {resolved.eventLocation ? ` · ${resolved.eventLocation}` : ""}
            </p>

            <div className="mt-6 flex flex-col gap-2">
              <form action={respondAvailabilityTokenAction.bind(null, token, true)}>
                <Button type="submit" className="w-full">
                  Sim, estou disponível
                </Button>
              </form>
              <form action={respondAvailabilityTokenAction.bind(null, token, false)}>
                <Button type="submit" variant="secondary" className="w-full">
                  Não vou poder
                </Button>
              </form>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
