"use client";

import { useState, useTransition } from "react";
import type { CSSProperties } from "react";
import { Check, CheckCircle2, Copy, FileUp, Paperclip } from "lucide-react";
import { Logo } from "@/components/layout/logo";
import { submitPaymentProofAction } from "@/lib/actions/public-payment-actions";

// Mesma identidade da página de orçamento: preto quente, dourado, Poppins.
// Pensada para o celular, que é onde o cliente abre o link do WhatsApp.
const THEME: CSSProperties = {
  ["--p-bg" as string]: "#0B0A08",
  ["--p-surface" as string]: "#13110D",
  ["--p-raised" as string]: "#1B1813",
  ["--p-line" as string]: "#2B261D",
  ["--p-text" as string]: "#F5F0E6",
  ["--p-muted" as string]: "#A69E8E",
  ["--p-faint" as string]: "#6F685B",
  ["--p-gold" as string]: "#D6B266",
  ["--p-gold-grad" as string]: "linear-gradient(120deg,#F6DDA0 0%,#D6B266 45%,#9E7B37 100%)",
  fontFamily: "var(--font-poppins), ui-sans-serif, system-ui, sans-serif",
  background: "#0B0A08",
  color: "#F5F0E6",
};

const goldText = "bg-[image:var(--p-gold-grad)] bg-clip-text text-transparent";

interface Props {
  token: string;
  company: string;
  clientName: string;
  description: string;
  amountLabel: string;
  dueLabel: string;
  timing: "upcoming" | "today" | "late";
  status: "open" | "proof" | "paid" | "cancelled";
  pixKey: string | null;
  pixCode: string | null;
  qrSvg: string | null;
  // Várias faturas do mesmo cliente: lista com o Pix de cada uma; o Pix
  // principal é o do total.
  items: { id: string; description: string; amountLabel: string; dueLabel: string; late: boolean; pixCode: string | null }[] | null;
}

function useCopy() {
  const [copied, setCopied] = useState<string | null>(null);
  async function copy(id: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const area = document.createElement("textarea");
      area.value = text;
      document.body.appendChild(area);
      area.select();
      document.execCommand("copy");
      area.remove();
    }
    setCopied(id);
    window.setTimeout(() => setCopied((c) => (c === id ? null : c)), 2500);
  }
  return { copied, copy };
}

export function PaymentView(p: Props) {
  const { copied, copy } = useCopy();
  const [status, setStatus] = useState(p.status);
  const [proofOpen, setProofOpen] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const data = new FormData(e.currentTarget);
    if (p.items) data.set("scope", "all");
    startTransition(async () => {
      const res = await submitPaymentProofAction(p.token, data);
      if (res.ok) {
        setStatus("proof");
        setProofOpen(false);
      } else setError(res.error ?? "Não foi possível enviar. Tente de novo.");
    });
  }

  const dueChip = p.items
    ? p.timing === "late"
      ? "Há faturas vencidas"
      : p.timing === "today"
        ? "Uma delas vence hoje"
        : `A primeira vence em ${p.dueLabel}`
    : p.timing === "today"
      ? "Vence hoje"
      : p.timing === "late"
        ? `Venceu em ${p.dueLabel}`
        : `Vence em ${p.dueLabel}`;

  return (
    <div style={THEME} className="relative min-h-dvh">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-80 bg-[radial-gradient(60%_100%_at_50%_0%,rgba(214,178,102,0.16),transparent)]" />
      <main className="relative mx-auto flex w-full max-w-md flex-col gap-6 px-5 pb-16 pt-8">
        <header className="flex items-center gap-3">
          <Logo size="md" gradientId="pay-mark" className="h-6 w-9" />
          <span className="truncate text-[11px] font-medium uppercase tracking-[0.24em] text-[var(--p-muted)]">{p.company}</span>
        </header>

        <section className="flex flex-col gap-2">
          <p className="text-sm text-[var(--p-muted)]">Olá, {p.clientName}</p>
          <p className={`text-[40px] font-semibold leading-tight tracking-tight ${goldText}`}>{p.amountLabel}</p>
          <p className="text-[15px] text-[var(--p-text)]">{p.description}</p>
          {status !== "paid" && status !== "cancelled" && (
            <span
              className={`mt-1 w-fit rounded-full border px-3 py-1 text-xs ${
                p.timing === "late" ? "border-[#7A3B2A] text-[#E8A48C]" : "border-[var(--p-line)] text-[var(--p-muted)]"
              }`}
            >
              {dueChip}
            </span>
          )}
        </section>

        {p.items && status !== "paid" && status !== "cancelled" && (
          <section className="flex flex-col divide-y divide-[var(--p-line)] rounded-3xl border border-[var(--p-line)] bg-[var(--p-surface)] px-5">
            {p.items.map((it) => (
              <div key={it.id} className="flex items-center justify-between gap-3 py-3.5">
                <div className="min-w-0">
                  <p className="truncate text-sm">{it.description}</p>
                  <p className={`text-xs ${it.late ? "text-[#E8A48C]" : "text-[var(--p-faint)]"}`}>{it.dueLabel}</p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <span className="text-sm font-medium">{it.amountLabel}</span>
                  {it.pixCode && (
                    <button type="button" onClick={() => copy(it.id, it.pixCode!)} className="flex items-center gap-1 text-[11px] text-[var(--p-gold)] hover:underline">
                      {copied === it.id ? <Check size={11} /> : <Copy size={11} />}
                      {copied === it.id ? "Copiado" : "Pix só desta"}
                    </button>
                  )}
                </div>
              </div>
            ))}
            <div className="flex items-center justify-between py-3.5">
              <span className="text-xs uppercase tracking-[0.18em] text-[var(--p-faint)]">Total</span>
              <span className={`text-base font-semibold ${goldText}`}>{p.amountLabel}</span>
            </div>
          </section>
        )}

        {status === "paid" ? (
          <section className="flex flex-col items-center gap-3 rounded-3xl border border-[var(--p-line)] bg-[var(--p-surface)] px-6 py-10 text-center">
            <CheckCircle2 size={40} className="text-[var(--p-gold)]" />
            <p className="text-lg font-semibold">Pagamento confirmado</p>
            <p className="text-sm text-[var(--p-muted)]">Obrigado! Esta fatura já está paga, não precisa fazer mais nada.</p>
          </section>
        ) : status === "cancelled" ? (
          <section className="rounded-3xl border border-[var(--p-line)] bg-[var(--p-surface)] px-6 py-8 text-center text-sm text-[var(--p-muted)]">
            Esta cobrança foi cancelada. Se tiver dúvidas, fale com a gente pelo WhatsApp.
          </section>
        ) : (
          <>
            {status === "proof" && (
              <div className="flex items-start gap-3 rounded-2xl border border-[var(--p-gold)]/40 bg-[var(--p-raised)] px-4 py-3 text-sm">
                <Check size={18} className="mt-0.5 shrink-0 text-[var(--p-gold)]" />
                <p>Recebemos seu comprovante. Assim que conferirmos, a fatura é baixada e você recebe a confirmação.</p>
              </div>
            )}

            {p.pixCode ? (
              <section className="flex flex-col gap-5 rounded-3xl border border-[var(--p-line)] bg-[var(--p-surface)] p-5">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-[var(--p-gold)]">Pague com Pix</p>
                  <span className="text-xs text-[var(--p-faint)]">valor já preenchido</span>
                </div>

                <button
                  type="button"
                  onClick={() => copy("code", p.pixCode!)}
                  className="flex h-14 w-full items-center justify-center gap-2 rounded-full bg-[image:var(--p-gold-grad)] text-[15px] font-semibold text-[#1A1408] shadow-[0_10px_30px_-12px_rgba(214,178,102,0.7)] active:scale-[0.99]"
                >
                  {copied === "code" ? <Check size={18} /> : <Copy size={18} />}
                  {copied === "code" ? "Código copiado" : p.items ? "Copiar Pix do total" : "Copiar código Pix"}
                </button>

                <ol className="flex flex-col gap-1.5 text-[13px] text-[var(--p-muted)]">
                  <li>1. Abra o app do seu banco e entre em Pix.</li>
                  <li>2. Escolha “Pix copia e cola” e cole o código.</li>
                  <li>3. Confira o valor e confirme.</li>
                </ol>

                {p.qrSvg && (
                  <div className="flex flex-col items-center gap-2 border-t border-[var(--p-line)] pt-5">
                    <p className="text-xs text-[var(--p-faint)]">Está no computador? Aponte a câmera do celular:</p>
                    <div className="w-52 rounded-2xl bg-white p-3 [&_svg]:h-auto [&_svg]:w-full" dangerouslySetInnerHTML={{ __html: p.qrSvg }} />
                  </div>
                )}

                <div className="flex items-center justify-between gap-3 border-t border-[var(--p-line)] pt-4">
                  <div className="min-w-0">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--p-faint)]">Chave Pix</p>
                    <p className="truncate text-sm">{p.pixKey}</p>
                    <p className="truncate text-xs text-[var(--p-faint)]">{p.company}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => copy("key", p.pixKey!)}
                    className="flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-[var(--p-line)] px-3.5 text-xs text-[var(--p-text)] hover:border-[var(--p-gold)]"
                  >
                    {copied === "key" ? <Check size={13} /> : <Copy size={13} />}
                    {copied === "key" ? "Copiada" : "Copiar chave"}
                  </button>
                </div>
              </section>
            ) : (
              <section className="rounded-3xl border border-[var(--p-line)] bg-[var(--p-surface)] px-6 py-8 text-center text-sm text-[var(--p-muted)]">
                Os dados de pagamento estão sendo atualizados. Responda nossa mensagem no WhatsApp que enviamos a chave Pix.
              </section>
            )}

            <section className="flex flex-col gap-3">
              {!proofOpen ? (
                <button
                  type="button"
                  onClick={() => setProofOpen(true)}
                  className="flex h-12 w-full items-center justify-center gap-2 rounded-full border border-[var(--p-line)] text-sm text-[var(--p-text)] hover:border-[var(--p-gold)]"
                >
                  <FileUp size={16} /> {status === "proof" ? "Enviar outro comprovante" : "Já paguei, enviar comprovante"}
                </button>
              ) : (
                <form onSubmit={submit} className="flex flex-col gap-3 rounded-3xl border border-[var(--p-line)] bg-[var(--p-surface)] p-5">
                  <p className="text-sm font-medium">Enviar comprovante</p>
                  <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-dashed border-[var(--p-line)] px-4 py-4 text-sm text-[var(--p-muted)] hover:border-[var(--p-gold)]">
                    <Paperclip size={16} className="shrink-0" />
                    <span className="truncate">{fileName ?? "Escolher foto ou PDF do comprovante"}</span>
                    <input
                      type="file"
                      name="file"
                      accept="image/*,application/pdf"
                      className="sr-only"
                      onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
                    />
                  </label>
                  <textarea
                    name="note"
                    rows={2}
                    maxLength={500}
                    placeholder="Mensagem (opcional)"
                    className="rounded-2xl border border-[var(--p-line)] bg-[var(--p-raised)] px-4 py-3 text-sm text-[var(--p-text)] placeholder:text-[var(--p-faint)] focus:border-[var(--p-gold)] focus:outline-none"
                  />
                  {error && <p className="text-sm text-[#E8A48C]">{error}</p>}
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      disabled={pending}
                      className="flex h-11 flex-1 items-center justify-center rounded-full bg-[var(--p-text)] text-sm font-medium text-[#0B0A08] disabled:opacity-60"
                    >
                      {pending ? "Enviando…" : "Enviar"}
                    </button>
                    <button type="button" onClick={() => setProofOpen(false)} className="h-11 rounded-full px-4 text-sm text-[var(--p-muted)]">
                      Cancelar
                    </button>
                  </div>
                </form>
              )}
            </section>
          </>
        )}

        <footer className="pt-4 text-center text-[11px] leading-relaxed text-[var(--p-faint)]">
          Pagamento via Pix direto para {p.company}.
          <br />
          Dúvidas? Responda a mensagem no WhatsApp.
        </footer>
      </main>
    </div>
  );
}
