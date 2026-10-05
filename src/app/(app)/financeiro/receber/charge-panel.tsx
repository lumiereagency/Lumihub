"use client";

import { useState, useTransition } from "react";
import { Check, Copy, ExternalLink, MessageCircle, Send } from "lucide-react";
import { aiChargeMessageAction, getPaymentLinkAction, previewChargeAction, sendChargeNowAction, type ChargePreview } from "@/lib/actions/billing-actions";
import { AiWriter } from "@/components/ai/ai-writer";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

// Cobrar agora pelo WhatsApp (com prévia editável) e copiar o link de pagamento.
export function ChargePanel({ receivableId }: { receivableId: string }) {
  const [preview, setPreview] = useState<ChargePreview | null>(null);
  const [body, setBody] = useState("");
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();

  function openPreview() {
    setResult(null);
    startTransition(async () => {
      const p = await previewChargeAction(receivableId);
      setPreview(p);
      if (p.ok) setBody(p.body ?? "");
    });
  }

  function send() {
    startTransition(async () => {
      const res = await sendChargeNowAction(receivableId, body);
      setResult(res.ok ? { ok: true, text: "Cobrança enviada no WhatsApp do cliente." } : { ok: false, text: res.error ?? "Não foi possível enviar." });
      if (res.ok) setPreview(null);
    });
  }

  function copyLink() {
    startTransition(async () => {
      const res = await getPaymentLinkAction(receivableId);
      if (res.link) {
        await navigator.clipboard.writeText(res.link).catch(() => {});
        setCopied(true);
        window.setTimeout(() => setCopied(false), 2500);
      }
    });
  }

  function openPage() {
    startTransition(async () => {
      const res = await getPaymentLinkAction(receivableId);
      if (res.link) window.open(res.link, "_blank", "noopener");
    });
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border p-4">
      <p className="text-sm font-medium text-text-primary">Cobrar o cliente</p>
      {!preview && (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="accent" onClick={openPreview} disabled={pending}>
            <MessageCircle size={14} /> Enviar cobrança no WhatsApp
          </Button>
          <Button size="sm" variant="secondary" onClick={copyLink} disabled={pending}>
            {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? "Link copiado" : "Copiar link de pagamento"}
          </Button>
          <Button size="sm" variant="ghost" onClick={openPage} disabled={pending}>
            <ExternalLink size={14} /> Ver página
          </Button>
        </div>
      )}

      {preview && !preview.ok && <p className="text-sm text-error">{preview.error}</p>}

      {preview?.ok && (
        <div className="flex flex-col gap-3">
          {!preview.whatsappConnected && (
            <p className="rounded-xl bg-error/10 px-3 py-2 text-xs text-error">O WhatsApp da empresa está desconectado. Conecte em Configurações → Integrações para enviar.</p>
          )}
          {!preview.phone && <p className="rounded-xl bg-error/10 px-3 py-2 text-xs text-error">Este cliente não tem telefone cadastrado. Adicione na ficha do cliente.</p>}
          {!preview.hasPixKey && (
            <p className="rounded-xl bg-warning/10 px-3 py-2 text-xs text-warning">Nenhuma chave Pix configurada: cadastre em Orçamentos → Configurações para o Pix copia e cola sair na mensagem.</p>
          )}
          <AiWriter
            hasText={body.trim().length > 0}
            generate={({ tone, instructions }) => aiChargeMessageAction(receivableId, { tone, instructions, current: body })}
            onResult={setBody}
          />
          <Textarea label={`Mensagem para ${preview.phone ?? "o cliente"}`} value={body} onChange={(e) => setBody(e.target.value)} rows={8} />
          {preview.pixSeparate && preview.pixCode && <p className="text-xs text-text-tertiary">O código Pix copia e cola vai numa segunda mensagem, logo em seguida, para o cliente copiar com um toque.</p>}
          <div className="flex gap-2">
            <Button size="sm" variant="accent" onClick={send} disabled={pending || !preview.whatsappConnected || !preview.phone}>
              <Send size={14} /> {pending ? "Enviando…" : "Enviar agora"}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setPreview(null)} disabled={pending}>
              Cancelar
            </Button>
          </div>
        </div>
      )}

      {result && <p className={result.ok ? "text-sm text-success" : "text-sm text-error"}>{result.text}</p>}
    </div>
  );
}
