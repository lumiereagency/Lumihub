"use client";

import { useState, useTransition } from "react";
import { disconnectIntegrationAction } from "@/lib/actions/integration-actions";
import { formatDateTime } from "@/lib/format";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/drawer";
import type { ProviderDefinition } from "@/lib/integrations/providers";
import { IntegrationForm } from "./integration-form";
import { WhatsAppQrPairing } from "./whatsapp-qr-pairing";

export interface IntegrationState {
  id: string;
  status: string;
  config: Record<string, string>;
  connectedAt: string | null;
  credentialPreviews: Record<string, string>;
}

const STATUS_TONE: Record<string, "neutral" | "success" | "error" | "warning"> = {
  CONECTADO: "success",
  PENDENTE: "warning",
  ERRO: "error",
  EXPIRADO: "error",
  DESCONECTADO: "neutral",
};

const STATUS_LABEL: Record<string, string> = {
  CONECTADO: "Conectado",
  PENDENTE: "Pendente",
  ERRO: "Erro",
  EXPIRADO: "Expirado",
  DESCONECTADO: "Desconectado",
};

export function ProviderCard({
  provider,
  state,
  canManage,
  oauthRedirectUri,
}: {
  provider: ProviderDefinition;
  state: IntegrationState | null;
  canManage: boolean;
  oauthRedirectUri?: string;
}) {
  const [open, setOpen] = useState(false);
  const [, startTransition] = useTransition();
  const status = state?.status ?? "DESCONECTADO";

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>{provider.label}</CardTitle>
          <p className="mt-1 text-xs text-text-tertiary">{provider.description}</p>
        </div>
        <Badge tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</Badge>
      </CardHeader>

      {state?.connectedAt && (
        <p className="mb-3 text-xs text-text-tertiary">Conectado em {formatDateTime(new Date(state.connectedAt))}</p>
      )}

      {canManage && (
        <div className="flex gap-2">
          <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>
            {state ? "Gerenciar" : "Conectar"}
          </Button>
          {state && status !== "DESCONECTADO" && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => startTransition(() => disconnectIntegrationAction(state.id))}
            >
              Desconectar
            </Button>
          )}
        </div>
      )}

      <Drawer open={open} onClose={() => setOpen(false)} title={provider.label} description={provider.description}>
        {provider.qrOnly ? (
          <WhatsAppQrPairing />
        ) : (
          <IntegrationForm
            provider={provider}
            currentConfig={state?.config ?? {}}
            credentialPreviews={state?.credentialPreviews ?? {}}
            oauthRedirectUri={oauthRedirectUri}
            onSuccess={() => setOpen(false)}
          />
        )}
      </Drawer>
    </Card>
  );
}
