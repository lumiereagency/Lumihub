"use client";

import { useState, useTransition } from "react";
import { Search, Users, Video, Clock, Repeat2, Scissors, Plus, Check } from "lucide-react";
import { searchYoutubeProspectsAction, importYoutubeProspectAction } from "@/lib/actions/crm-prospecting-actions";
import type { YoutubeProspect, LeadTemperature } from "@/lib/integrations/youtube";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";

const TEMPERATURE_LABEL: Record<LeadTemperature, string> = {
  QUENTE: "Quente",
  MORNO: "Morno",
  FRIO: "Frio",
};
// Vermelho/laranja/azul mapeia direto pra intuição de temperatura, mesmo
// sem tom próprio de "fogo" no Badge — reaproveita as tonalidades existentes.
const TEMPERATURE_TONE: Record<LeadTemperature, "error" | "warning" | "info"> = {
  QUENTE: "error",
  MORNO: "warning",
  FRIO: "info",
};

function formatCompactNumber(n: number): string {
  return new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 }).format(n);
}

export function YoutubeProspectingSearch() {
  const [query, setQuery] = useState("");
  const [minSubscribers, setMinSubscribers] = useState("50000");
  const [prospects, setProspects] = useState<YoutubeProspect[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [searching, startSearch] = useTransition();
  const [importedIds, setImportedIds] = useState<Set<string>>(new Set());
  const [importingId, setImportingId] = useState<string | null>(null);
  const [importMessage, setImportMessage] = useState<{ channelId: string; text: string; ok: boolean } | null>(null);

  function search() {
    setError(null);
    startSearch(async () => {
      const result = await searchYoutubeProspectsAction(query, Number(minSubscribers) || undefined);
      if ("error" in result) {
        setError(result.error);
        setProspects(null);
        return;
      }
      setProspects(result.prospects);
    });
  }

  function importProspect(prospect: YoutubeProspect) {
    setImportingId(prospect.channelId);
    setImportMessage(null);
    startSearch(async () => {
      const result = await importYoutubeProspectAction(prospect);
      setImportingId(null);
      if (result.success) {
        setImportedIds((prev) => new Set(prev).add(prospect.channelId));
        setImportMessage({ channelId: prospect.channelId, text: result.success, ok: true });
      } else {
        setImportMessage({ channelId: prospect.channelId, text: result.error ?? "Erro ao importar.", ok: false });
      }
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-border bg-card p-4">
        <div className="min-w-64 flex-1">
          <Input
            label="Nicho ou palavra-chave"
            placeholder="Ex: humor anos 90, podcast de negócios, banda de rock brasileira"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && search()}
          />
        </div>
        <div className="w-44">
          <Input
            label="Mín. de inscritos"
            type="number"
            value={minSubscribers}
            onChange={(e) => setMinSubscribers(e.target.value)}
          />
        </div>
        <Button onClick={search} disabled={searching || !query.trim()}>
          <Search size={16} /> {searching ? "Buscando..." : "Buscar"}
        </Button>
      </div>

      {error && (
        <div className="rounded-2xl border border-error/30 bg-error/10 px-4 py-3 text-sm text-text-primary">{error}</div>
      )}

      {prospects === null && !error && (
        <EmptyState
          icon={<Video size={28} />}
          title="Busque um nicho pra começar"
          description="O sistema traz canais reais do YouTube naquele nicho, já classificados por quem tem mais chance de precisar de produção de cortes."
        />
      )}

      {prospects !== null && prospects.length === 0 && !error && (
        <EmptyState icon={<Video size={28} />} title="Nenhum canal encontrado com esse filtro" description="Tente um termo mais amplo ou reduza o mínimo de inscritos." />
      )}

      {prospects !== null && prospects.length > 0 && (
        <div className="flex flex-col gap-3">
          {prospects.map((p) => {
            const imported = importedIds.has(p.channelId);
            const message = importMessage?.channelId === p.channelId ? importMessage : null;
            return (
              <div key={p.channelId} className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    {p.thumbnailUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.thumbnailUrl} alt="" className="h-10 w-10 rounded-full" />
                    )}
                    <div>
                      <a href={p.channelUrl} target="_blank" rel="noopener noreferrer" className="font-medium text-text-primary hover:underline">
                        {p.title}
                      </a>
                      <p className="line-clamp-1 max-w-lg text-xs text-text-tertiary">{p.description || "Sem descrição."}</p>
                    </div>
                  </div>
                  <Badge tone={TEMPERATURE_TONE[p.temperature]}>{TEMPERATURE_LABEL[p.temperature]}</Badge>
                </div>

                <div className="flex flex-wrap items-center gap-4 text-xs text-text-secondary">
                  <span className="flex items-center gap-1">
                    <Users size={12} /> {formatCompactNumber(p.subscriberCount)} inscritos
                  </span>
                  <span className="flex items-center gap-1">
                    <Video size={12} /> {formatCompactNumber(p.videoCount)} vídeos
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock size={12} /> {p.daysSinceLastUpload === null ? "sem dados de upload" : `último vídeo há ${p.daysSinceLastUpload}d`}
                  </span>
                  <span className="flex items-center gap-1">
                    <Repeat2 size={12} /> {p.avgUploadIntervalDays === null ? "frequência desconhecida" : `posta a cada ${p.avgUploadIntervalDays}d em média`}
                  </span>
                  <span className="flex items-center gap-1">
                    <Scissors size={12} /> {p.shortsRatio === null ? "sem dados de Shorts" : `${Math.round(p.shortsRatio * 100)}% Shorts`}
                  </span>
                </div>

                <div className="mt-1 flex items-center gap-3">
                  <Button size="sm" variant={imported ? "secondary" : "primary"} disabled={imported || importingId === p.channelId} onClick={() => importProspect(p)}>
                    {imported ? (
                      <>
                        <Check size={14} /> Adicionado
                      </>
                    ) : (
                      <>
                        <Plus size={14} /> {importingId === p.channelId ? "Adicionando..." : "Adicionar ao funil"}
                      </>
                    )}
                  </Button>
                  {message && <span className={message.ok ? "text-xs text-success" : "text-xs text-error"}>{message.text}</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
