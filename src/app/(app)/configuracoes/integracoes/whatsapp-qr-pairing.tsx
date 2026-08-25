"use client";

import { useEffect, useState, useTransition } from "react";
import { connectWhatsAppAction, getWhatsAppStatusAction } from "@/lib/actions/whatsapp-actions";
import { Button } from "@/components/ui/button";

// Conexão via Baileys (WebSocket não-oficial que simula o WhatsApp Web) —
// sem campos de formulário, o pareamento é só escanear o QR code. O status
// muda de forma assíncrona (aguardando -> QR -> conectado), por isso o
// polling em vez de um único request/response.
export function WhatsAppQrPairing() {
  const [status, setStatus] = useState<{ status: string; qrDataUrl: string | null; phoneNumber: string | null } | null>(
    null,
  );
  const [, startTransition] = useTransition();

  useEffect(() => {
    let active = true;
    const poll = async () => {
      const result = await getWhatsAppStatusAction();
      if (active) setStatus(result);
    };
    poll();
    const interval = setInterval(poll, 3000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  if (!status) {
    return <p className="text-sm text-text-tertiary">Carregando...</p>;
  }

  if (status.status === "connected") {
    return (
      <p className="rounded-[10px] border border-success/30 bg-success/10 px-3 py-2.5 text-sm text-success">
        Conectado como +{status.phoneNumber}
      </p>
    );
  }

  if (status.status === "qr" && status.qrDataUrl) {
    return (
      <div className="flex flex-col items-center gap-3 text-center">
        <p className="text-sm text-text-secondary">
          No celular do número que vai usar: WhatsApp → Aparelhos conectados → Conectar um aparelho, e escaneie o
          código abaixo.
        </p>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={status.qrDataUrl} alt="QR code de pareamento do WhatsApp" className="h-56 w-56 rounded-[10px] border border-border" />
        <p className="text-xs text-text-tertiary">O código expira em segundos e é renovado sozinho — não precisa recarregar a página.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-text-secondary">
        Conecta o número de WhatsApp que vai enviar lembretes e mensagens — funciona como o WhatsApp Web, sem
        precisar de aprovação da Meta. Use um número dedicado se puder: por ser uma conexão não-oficial, existe risco
        do número ser bloqueado pelo WhatsApp.
      </p>
      <Button
        disabled={status.status === "connecting"}
        onClick={() => startTransition(async () => { await connectWhatsAppAction(); })}
      >
        {status.status === "connecting" ? "Gerando QR code..." : "Conectar WhatsApp"}
      </Button>
    </div>
  );
}
