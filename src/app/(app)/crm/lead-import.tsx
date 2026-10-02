"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, FileSpreadsheet, Upload } from "lucide-react";
import { cn } from "@/lib/cn";
import { importLeadsAction, previewLeadImportAction, type ImportRow, type ImportRowStatus } from "@/lib/actions/crm-import-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type FieldKey = keyof ImportRow;

const FIELDS: { key: FieldKey; label: string; synonyms: string[] }[] = [
  { key: "instagram", label: "Instagram", synonyms: ["instagram", "insta", "ig", "arroba", "@", "perfil instagram", "link instagram", "link do instagram"] },
  { key: "company", label: "Empresa / nome do lead", synonyms: ["empresa", "nome", "nome da empresa", "negocio", "cliente", "lead", "marca", "loja", "estabelecimento", "razao social", "nome fantasia", "perfil"] },
  { key: "contactName", label: "Pessoa de contato", synonyms: ["contato", "responsavel", "nome do contato", "pessoa", "dono", "proprietario"] },
  { key: "whatsapp", label: "WhatsApp", synonyms: ["whatsapp", "whats", "zap", "wpp", "celular", "cel"] },
  { key: "phone", label: "Telefone", synonyms: ["telefone", "fone", "tel", "numero"] },
  { key: "website", label: "Site", synonyms: ["site", "website", "url", "pagina"] },
  { key: "city", label: "Cidade", synonyms: ["cidade", "municipio", "local", "localizacao", "bairro"] },
  { key: "segment", label: "Segmento", synonyms: ["segmento", "nicho", "ramo", "categoria", "area", "setor"] },
  { key: "source", label: "Origem", synonyms: ["origem", "fonte", "canal", "como chegou"] },
  { key: "temperature", label: "Temperatura", synonyms: ["temperatura", "interesse", "nivel de interesse"] },
  { key: "stage", label: "Etapa", synonyms: ["etapa", "estagio", "fase", "status", "situacao"] },
  { key: "potentialValue", label: "Valor potencial", synonyms: ["valor", "orcamento", "ticket", "valor potencial", "preco"] },
  { key: "nextContactAt", label: "Próximo contato", synonyms: ["proximo contato", "retorno", "follow up", "followup", "data de retorno", "data do retorno"] },
  { key: "notes", label: "Observações", synonyms: ["observacoes", "observacao", "obs", "notas", "anotacoes", "comentarios", "detalhes"] },
];

const FIELD_LABEL = Object.fromEntries(FIELDS.map((f) => [f.key, f.label])) as Record<FieldKey, string>;

function plain(value: string): string {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9@ ]+/g, " ").replace(/\s+/g, " ").trim();
}

function autoMap(headers: string[]): (FieldKey | "")[] {
  const result: (FieldKey | "")[] = headers.map(() => "");
  const used = new Set<FieldKey>();
  const keys = headers.map(plain);
  for (const pass of ["exact", "contains"] as const) {
    keys.forEach((h, i) => {
      if (result[i] || !h) return;
      const field = FIELDS.find(
        (f) => !used.has(f.key) && f.synonyms.some((s) => (pass === "exact" ? h === s : h.includes(s) && s.length > 2)),
      );
      if (field) {
        result[i] = field.key;
        used.add(field.key);
      }
    });
  }
  return result;
}

function parseCsv(text: string): string[][] {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  const delimiter = [";", ",", "\t"].sort((a, b) => firstLine.split(b).length - firstLine.split(a).length)[0];
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === delimiter) {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

function cellToText(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "boolean") return "";
  return String(value).trim();
}

const STATUS_BADGE: Record<ImportRowStatus["status"], { tone: "success" | "warning" | "error" | "neutral"; label: string }> = {
  novo: { tone: "success", label: "Novo" },
  duplicado: { tone: "warning", label: "Já existe" },
  repetido: { tone: "neutral", label: "Repetido" },
  invalido: { tone: "error", label: "Inválido" },
};

export function LeadImport({ onDone }: { onDone: (message: string) => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [fileName, setFileName] = useState<string | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [data, setData] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<(FieldKey | "")[]>([]);
  const [source, setSource] = useState("Planilha");
  const [statuses, setStatuses] = useState<ImportRowStatus[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  const rows: ImportRow[] = useMemo(
    () =>
      data.map((cells) => {
        const row: ImportRow = {};
        mapping.forEach((field, i) => {
          if (field && cells[i]) row[field] = cells[i];
        });
        return row;
      }),
    [data, mapping],
  );

  const counts = useMemo(() => {
    const c = { novo: 0, duplicado: 0, repetido: 0, invalido: 0 };
    statuses?.forEach((s) => c[s.status]++);
    return c;
  }, [statuses]);

  async function readFile(file: File) {
    setError(null);
    setStatuses(null);
    try {
      let table: string[][];
      if (/\.(xlsx|xlsm)$/i.test(file.name)) {
        const { readSheet } = await import("read-excel-file/browser");
        const sheet = (await readSheet(file)) as unknown[][];
        table = sheet.map((r) => r.map(cellToText));
      } else if (/\.(csv|txt)$/i.test(file.name)) {
        table = parseCsv(await file.text()).map((r) => r.map((c) => c.trim()));
      } else {
        setError("Envie um arquivo .xlsx (Excel) ou .csv. No Google Sheets: Arquivo → Fazer download → Excel ou CSV.");
        return;
      }
      table = table.filter((r) => r.some((c) => c));
      if (table.length < 2) {
        setError("Não encontrei linhas com dados — a primeira linha precisa ser o cabeçalho com os nomes das colunas.");
        return;
      }
      const [head, ...body] = table;
      const width = Math.max(head.length, ...body.map((r) => r.length));
      const normalizedHead = Array.from({ length: width }, (_, i) => head[i] || `Coluna ${i + 1}`);
      setFileName(file.name);
      setHeaders(normalizedHead);
      setData(body.map((r) => Array.from({ length: width }, (_, i) => r[i] ?? "")));
      setMapping(autoMap(normalizedHead));
    } catch {
      setError("Não consegui ler esse arquivo. Confira se é um Excel (.xlsx) ou CSV válido.");
    }
  }

  function changeMapping(index: number, field: FieldKey | "") {
    setStatuses(null);
    setMapping((prev) => prev.map((f, i) => (i === index ? field : field && f === field ? "" : f)));
  }

  const hasCompany = mapping.includes("company");

  if (!fileName) {
    return (
      <div className="flex flex-col gap-4">
        <label
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            const file = e.dataTransfer.files[0];
            if (file) readFile(file);
          }}
          className={cn(
            "flex cursor-pointer flex-col items-center justify-center gap-3 rounded-3xl border-2 border-dashed px-6 py-14 text-center transition-colors",
            dragging ? "border-accent bg-accent/5" : "border-border hover:bg-card-elevated",
          )}
        >
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-card-elevated text-text-secondary">
            <Upload size={22} />
          </span>
          <span className="text-[15px] font-semibold text-text-primary">Arraste a planilha aqui ou clique para escolher</span>
          <span className="max-w-sm text-sm text-text-tertiary">Excel (.xlsx) ou CSV. A primeira linha precisa ter os nomes das colunas — a base reconhece sozinha.</span>
          <input type="file" accept=".xlsx,.xlsm,.csv,.txt" className="sr-only" onChange={(e) => e.target.files?.[0] && readFile(e.target.files[0])} />
        </label>
        {error && <p className="rounded-2xl bg-error/10 px-4 py-3 text-sm text-error">{error}</p>}
        <div className="rounded-2xl bg-card-elevated px-4 py-3 text-sm text-text-secondary">
          Leads que já existem no CRM (mesmo nome ou mesmo Instagram) são identificados e <strong className="text-text-primary">não</strong> entram de novo. Os
          importados ficam no seu nome.
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-3 rounded-2xl bg-card-elevated px-4 py-3">
        <FileSpreadsheet size={20} className="shrink-0 text-success" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-text-primary">{fileName}</p>
          <p className="text-xs text-text-tertiary">{data.length} linhas encontradas</p>
        </div>
        <button
          type="button"
          onClick={() => {
            setFileName(null);
            setStatuses(null);
          }}
          className="text-sm font-medium text-text-secondary hover:text-text-primary"
        >
          Trocar arquivo
        </button>
      </div>

      <section className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold text-text-primary">1. Confira as colunas</h3>
        <p className="-mt-2 text-sm text-text-tertiary">Já liguei cada coluna da planilha a um campo do CRM. Ajuste se algo estiver errado.</p>
        <div className="overflow-x-auto rounded-2xl border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="whitespace-nowrap bg-bg-secondary text-left text-xs text-text-tertiary">
                <th className="px-3 py-2.5 font-medium">Coluna da planilha</th>
                <th className="px-3 py-2.5 font-medium">Exemplo</th>
                <th className="px-3 py-2.5 font-medium">Vai para</th>
              </tr>
            </thead>
            <tbody>
              {headers.map((header, i) => (
                <tr key={i} className="border-t border-border">
                  <td className="px-3 py-2 font-medium text-text-primary">{header}</td>
                  <td className="max-w-[180px] truncate px-3 py-2 text-text-tertiary">{data.find((r) => r[i])?.[i] ?? "—"}</td>
                  <td className="px-3 py-2">
                    <select
                      value={mapping[i] ?? ""}
                      onChange={(e) => changeMapping(i, e.target.value as FieldKey | "")}
                      className={cn(
                        "h-9 w-full min-w-[170px] rounded-xl border bg-card px-2.5 text-sm focus:outline-none",
                        mapping[i] ? "border-success/40 text-text-primary" : "border-border text-text-tertiary",
                      )}
                      aria-label={`Campo para ${header}`}
                    >
                      <option value="">Ignorar coluna</option>
                      {FIELDS.map((f) => (
                        <option key={f.key} value={f.key}>
                          {f.label}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!hasCompany && <p className="text-sm font-medium text-warning">Escolha qual coluna é a “Empresa / nome do lead” — ela é obrigatória.</p>}
        <label className="flex flex-col gap-1.5 text-sm font-medium text-text-secondary">
          Origem para quem não tiver na planilha
          <input
            value={source}
            onChange={(e) => setSource(e.target.value)}
            className="h-10 rounded-xl border border-border bg-card px-3 text-sm text-text-primary focus:outline-none focus:ring-4 focus:ring-accent/15"
          />
        </label>
      </section>

      <section className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold text-text-primary">2. Verifique duplicados</h3>
        {!statuses ? (
          <Button
            variant="secondary"
            disabled={!hasCompany || pending}
            onClick={() =>
              startTransition(async () => {
                setError(null);
                const result = await previewLeadImportAction(rows);
                if ("error" in result) setError(result.error);
                else setStatuses(result.statuses);
              })
            }
          >
            {pending ? "Verificando…" : "Verificar planilha"}
          </Button>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {(["novo", "duplicado", "repetido", "invalido"] as const).map((k) => (
                <div key={k} className="rounded-2xl border border-border px-3 py-2.5">
                  <p className="text-xl font-semibold text-text-primary">{counts[k]}</p>
                  <p className="text-xs text-text-tertiary">{STATUS_BADGE[k].label}</p>
                </div>
              ))}
            </div>
            <div className="scrollbar-thin max-h-[300px] overflow-auto rounded-2xl border border-border">
              <table className="w-full text-sm">
                <thead className="sticky top-0">
                  <tr className="whitespace-nowrap bg-bg-secondary text-left text-xs text-text-tertiary">
                    <th className="px-3 py-2.5 font-medium">Linha</th>
                    <th className="px-3 py-2.5 font-medium">{FIELD_LABEL.company}</th>
                    <th className="px-3 py-2.5 font-medium">Situação</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, i) => {
                    const s = statuses[i];
                    return (
                      <tr key={i} className="border-t border-border align-top">
                        <td className="px-3 py-2 text-text-tertiary">{i + 2}</td>
                        <td className="px-3 py-2">
                          <p className="font-medium text-text-primary">{row.company || "—"}</p>
                          {row.instagram && <p className="text-xs text-text-tertiary">{row.instagram}</p>}
                        </td>
                        <td className="px-3 py-2">
                          <Badge tone={STATUS_BADGE[s.status].tone} dot>
                            {STATUS_BADGE[s.status].label}
                          </Badge>
                          {"message" in s && <p className="mt-1 max-w-[320px] text-xs text-text-tertiary">{s.message}</p>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>

      {error && <p className="rounded-2xl bg-error/10 px-4 py-3 text-sm text-error">{error}</p>}

      {statuses && (
        <Button
          disabled={pending || counts.novo === 0}
          onClick={() =>
            startTransition(async () => {
              const result = await importLeadsAction(rows, source);
              if ("error" in result) return setError(result.error);
              router.refresh();
              onDone(`${result.created} lead${result.created === 1 ? "" : "s"} importado${result.created === 1 ? "" : "s"}${result.skipped ? ` · ${result.skipped} ignorado${result.skipped === 1 ? "" : "s"}` : ""}.`);
            })
          }
        >
          <CheckCircle2 size={16} />
          {pending ? "Importando…" : counts.novo === 0 ? "Nada novo para importar" : `Importar ${counts.novo} lead${counts.novo === 1 ? "" : "s"}`}
        </Button>
      )}
    </div>
  );
}
