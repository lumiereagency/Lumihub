"use client";

import { useState, useTransition } from "react";
import { Sparkles, Wand2 } from "lucide-react";
import { cn } from "@/lib/cn";

const TONES = [
  { key: "amigavel", label: "Amigável" },
  { key: "direto", label: "Direto" },
  { key: "firme", label: "Firme e educado" },
] as const;

type Result = { ok: boolean; body?: string; error?: string };

// Barra "Escrever com IA": escolhe o tom, dá um pedido opcional e a Lumi AI
// escreve (ou melhora) o texto. O resultado vai para o campo, editável.
export function AiWriter({
  generate,
  onResult,
  hasText,
}: {
  generate: (input: { tone: string; instructions: string }) => Promise<Result>;
  onResult: (body: string) => void;
  hasText: boolean;
}) {
  const [tone, setTone] = useState<string>("amigavel");
  const [instructions, setInstructions] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function run() {
    setError(null);
    start(async () => {
      const res = await generate({ tone, instructions });
      if (res.ok && res.body) onResult(res.body);
      else setError(res.error ?? "A IA não conseguiu escrever agora.");
    });
  }

  return (
    <div className="flex flex-col gap-2.5 rounded-2xl border border-accent/25 bg-accent/[0.06] p-3">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="mr-1 flex items-center gap-1.5 text-xs font-medium text-text-secondary">
          <Sparkles size={13} className="text-accent-light" /> Lumi AI
        </span>
        {TONES.map((t) => (
          <button
            key={t.key}
            type="button"
            aria-pressed={tone === t.key}
            onClick={() => setTone(t.key)}
            className={cn(
              "rounded-full px-2.5 py-1 text-xs transition-colors",
              tone === t.key ? "bg-card text-text-primary ring-1 ring-accent/50" : "text-text-tertiary hover:text-text-primary",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              run();
            }
          }}
          maxLength={300}
          placeholder="Pedido opcional (ex.: mencionar que é a 2ª parcela, oferecer combinar nova data)"
          className="h-9 min-w-0 flex-1 rounded-xl border border-border bg-card px-3 text-xs text-text-primary placeholder:text-text-tertiary focus:border-accent/60 focus:outline-none"
        />
        <button
          type="button"
          onClick={run}
          disabled={pending}
          className="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-full bg-[image:var(--lh-accent-gradient)] px-4 text-xs font-semibold text-accent-on disabled:opacity-60"
        >
          <Wand2 size={13} /> {pending ? "Escrevendo…" : hasText ? "Melhorar com IA" : "Escrever com IA"}
        </button>
      </div>
      {error && <p className="text-xs text-error">{error}</p>}
      <p className="text-[11px] text-text-tertiary">A IA sugere; você revisa antes de salvar ou enviar.</p>
    </div>
  );
}
