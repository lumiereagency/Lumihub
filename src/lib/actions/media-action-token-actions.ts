"use server";

import { redirect } from "next/navigation";
import { respondAvailabilityToken, respondAssignmentViaToken, respondSwapViaToken } from "@/lib/media/tokens/action-tokens";

// Ações públicas (sem requireMediaMember/requireUser) — o token já é a
// autorização, mesmo modelo de confiança do link de redefinir senha. Nunca
// recebem ID de membro/evento/escala do cliente, só o token opaco (e, no
// caso da confirmação mensal, o assignmentId — validado contra o token
// dentro de respondAssignmentViaToken antes de qualquer gravação).

export async function respondAvailabilityTokenAction(token: string, available: boolean): Promise<void> {
  await respondAvailabilityToken(token, available);
  redirect(`/midia/acao/${token}`);
}

export async function respondAssignmentTokenAction(token: string, assignmentId: string, available: boolean): Promise<void> {
  await respondAssignmentViaToken(token, assignmentId, available);
  redirect(`/midia/acao/${token}`);
}

export async function respondSwapTokenAction(token: string, accept: boolean): Promise<void> {
  await respondSwapViaToken(token, accept);
  redirect(`/midia/acao/${token}`);
}
