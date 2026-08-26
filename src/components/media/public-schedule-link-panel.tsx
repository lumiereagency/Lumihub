"use client";

import { useState, useTransition } from "react";
import { Copy, Check, RefreshCw, Link2 } from "lucide-react";
import { rotatePublicScheduleLinkAction } from "@/lib/actions/media-public-link-actions";
import { Button } from "@/components/ui/button";

export function PublicScheduleLinkPanel({ token: initialToken }: { token: string }) {
  const [token, setToken] = useState(initialToken);
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();

  const url = typeof window !== "undefined" ? `${window.location.origin}/midia/publico/${token}` : `/midia/publico/${token}`;

  function copy() {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function rotate() {
    if (!confirm("Gerar um novo link vai desativar o link atual imediatamente. Continuar?")) return;
    startTransition(async () => {
      const result = await rotatePublicScheduleLinkAction();
      setToken(result.token);
    });
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4">
      <p className="text-sm text-text-secondary">
        Link somente leitura, sem necessidade de login — compartilhe com o pastor, a gestão ou os obreiros para que saibam quem está
        escalado em cada culto do mês. Atualiza sozinho assim que uma escala é publicada ou uma troca é aprovada.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-2 rounded-[10px] border border-border bg-card-elevated px-3 py-2">
          <Link2 size={14} className="shrink-0 text-text-tertiary" />
          <span className="truncate text-sm text-text-primary">{url}</span>
        </div>
        <Button type="button" variant="secondary" size="sm" onClick={copy}>
          {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? "Copiado" : "Copiar"}
        </Button>
        <Button type="button" variant="outline" size="sm" disabled={pending} onClick={rotate}>
          <RefreshCw size={14} /> {pending ? "Gerando..." : "Gerar novo link"}
        </Button>
      </div>
    </div>
  );
}
