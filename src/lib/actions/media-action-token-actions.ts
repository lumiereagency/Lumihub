"use server";

import { redirect } from "next/navigation";
import { respondAvailabilityToken } from "@/lib/media/tokens/action-tokens";

// Ação pública (sem requireMediaMember/requireUser) — o token já é a
// autorização, mesmo modelo de confiança do link de redefinir senha. Nunca
// recebe o ID do membro nem do evento do cliente, só o token opaco.
export async function respondAvailabilityTokenAction(token: string, available: boolean): Promise<void> {
  await respondAvailabilityToken(token, available);
  redirect(`/midia/acao/${token}`);
}
