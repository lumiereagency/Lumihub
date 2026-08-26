import { CalendarClock, CheckCircle2, XCircle, Repeat } from "lucide-react";
import { db } from "@/lib/db";
import { mediaThemeStyle } from "@/lib/media/theme";
import { resolveActionToken } from "@/lib/media/tokens/action-tokens";
import { respondAvailabilityTokenAction, respondAssignmentTokenAction, respondSwapTokenAction } from "@/lib/actions/media-action-token-actions";
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
//
// Três formatos de token compartilham esta mesma página (§ decisão de
// design: uma única resolução/página em vez de 3 rotas), diferenciados por
// resolved.kind: "availability" (pergunta pontual, uso único), "schedule"
// (confirmação mensal — lista todos os dias do membro, revisitável, nunca
// marcada como usada) e "swap" (substituto sugerido pela IA aceita/recusa
// a troca, uso único).
export default async function MediaActionTokenPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const resolved = await resolveActionToken(token);

  const organizationId = "organizationId" in resolved ? resolved.organizationId : null;
  const brand = organizationId ? await db.mediaBrandSettings.findUnique({ where: { organizationId } }) : null;

  const CONFIRMATION_LABELS: Record<string, string> = {
    PENDING: "Aguardando resposta",
    CONFIRMED: "Confirmado",
    DECLINED: "Não vai poder",
  };

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-background px-4 py-10" style={mediaThemeStyle(brand)}>
      <div className="w-full max-w-[440px] rounded-2xl border border-border bg-card p-6 text-center">
        {brand?.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={brand.logoUrl} alt={brand.environmentName} className="mx-auto mb-4 h-12 w-auto object-contain" />
        ) : (
          <div className="mx-auto mb-4 h-12 w-12 rounded-2xl bg-[image:var(--lh-accent-gradient)]" />
        )}

        {resolved.kind === "not_found" && (
          <>
            <XCircle size={32} className="mx-auto mb-3 text-error" />
            <p className="text-sm text-text-secondary">Este link não é válido.</p>
          </>
        )}

        {resolved.kind === "expired" && (
          <>
            <XCircle size={32} className="mx-auto mb-3 text-error" />
            <p className="text-sm text-text-secondary">Este link expirou. Fale com a liderança da equipe de mídia.</p>
          </>
        )}

        {resolved.kind === "availability" && resolved.status === "used" && (
          <>
            <CheckCircle2 size={32} className="mx-auto mb-3 text-success" />
            <p className="text-sm font-medium text-text-primary">Resposta já registrada.</p>
            <p className="mt-1 text-sm text-text-secondary">Obrigado, {resolved.memberName}!</p>
          </>
        )}

        {resolved.kind === "availability" && resolved.status === "valid" && (
          <>
            <CalendarClock size={32} className="mx-auto mb-3 text-accent-light" />
            <p className="text-sm text-text-secondary">Olá, {resolved.memberName}.</p>
            <p className="mt-1 text-base font-medium text-text-primary">Você está disponível para servir em:</p>
            <p className="mt-2 text-lg font-semibold text-text-primary">{resolved.eventName}</p>
            <p className="text-sm text-text-tertiary">
              {formatDateTime(resolved.eventStartAt)}
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

        {resolved.kind === "schedule" && (
          <>
            <CalendarClock size={32} className="mx-auto mb-3 text-accent-light" />
            <p className="text-sm text-text-secondary">Olá, {resolved.memberName}.</p>
            <p className="mt-1 text-base font-medium text-text-primary">Sua escala em {resolved.scheduleName}</p>
            <p className="mt-1 text-xs text-text-tertiary">Confirme cada dia — pode responder um de cada vez, quando puder.</p>

            <div className="mt-5 flex flex-col gap-3 text-left">
              {resolved.assignments.map((a) => (
                <div key={a.assignmentId} className="rounded-xl border border-border p-3">
                  <p className="text-sm font-medium text-text-primary">{a.eventName}</p>
                  <p className="text-xs text-text-tertiary">
                    {formatDateTime(a.eventStartAt)}
                    {a.eventLocation ? ` · ${a.eventLocation}` : ""} · {a.functionName}
                  </p>

                  {a.confirmationStatus === "PENDING" && (
                    <div className="mt-3 flex gap-2">
                      <form action={respondAssignmentTokenAction.bind(null, token, a.assignmentId, true)} className="flex-1">
                        <Button type="submit" size="sm" className="w-full">
                          Sim
                        </Button>
                      </form>
                      <form action={respondAssignmentTokenAction.bind(null, token, a.assignmentId, false)} className="flex-1">
                        <Button type="submit" size="sm" variant="secondary" className="w-full">
                          Não vou poder
                        </Button>
                      </form>
                    </div>
                  )}

                  {a.confirmationStatus === "CONFIRMED" && (
                    <div className="mt-2 flex items-center gap-1.5 text-xs font-medium text-success">
                      <CheckCircle2 size={14} /> {CONFIRMATION_LABELS.CONFIRMED}
                    </div>
                  )}

                  {a.confirmationStatus === "DECLINED" && (
                    <div className="mt-2 flex items-center gap-1.5 text-xs font-medium text-text-tertiary">
                      <XCircle size={14} /> {CONFIRMATION_LABELS.DECLINED} · buscando substituto
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}

        {resolved.kind === "swap" && resolved.status === "used" && (
          <>
            <CheckCircle2 size={32} className="mx-auto mb-3 text-success" />
            <p className="text-sm font-medium text-text-primary">Resposta já registrada.</p>
            <p className="mt-1 text-sm text-text-secondary">Obrigado, {resolved.memberName}!</p>
          </>
        )}

        {resolved.kind === "swap" && resolved.status === "valid" && (
          <>
            <Repeat size={32} className="mx-auto mb-3 text-accent-light" />
            <p className="text-sm text-text-secondary">Olá, {resolved.memberName}.</p>
            <p className="mt-1 text-base font-medium text-text-primary">
              {resolved.previousMemberName} não vai poder servir e a equipe sugeriu você para cobrir:
            </p>
            <p className="mt-2 text-lg font-semibold text-text-primary">{resolved.functionName}</p>
            <p className="text-sm text-text-tertiary">{resolved.eventName}</p>
            <p className="text-sm text-text-tertiary">
              {formatDateTime(resolved.eventStartAt)}
              {resolved.eventLocation ? ` · ${resolved.eventLocation}` : ""}
            </p>

            <div className="mt-6 flex flex-col gap-2">
              <form action={respondSwapTokenAction.bind(null, token, true)}>
                <Button type="submit" className="w-full">
                  Sim, eu cubro
                </Button>
              </form>
              <form action={respondSwapTokenAction.bind(null, token, false)}>
                <Button type="submit" variant="secondary" className="w-full">
                  Não posso
                </Button>
              </form>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
