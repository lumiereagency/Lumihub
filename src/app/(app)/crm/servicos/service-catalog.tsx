"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import {
  BookOpenCheck,
  Package,
  Pencil,
  Plus,
  Search,
  SlidersHorizontal,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { formatCurrency } from "@/lib/format";
import { parseMoney } from "@/lib/pricing/parse";
import {
  computeQuote,
  type CardMode,
  type PricingConfig,
} from "@/lib/pricing/engine";
import {
  deleteServiceAction,
  loadGuideCatalogAction,
  saveServiceAction,
  toggleServiceActiveAction,
} from "@/lib/actions/crm-service-actions";
import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/drawer";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export interface ServiceRow {
  id: string;
  name: string;
  category: string | null;
  description: string | null;
  defaultPrice: number | null;
  active: boolean;
  leadCount: number;
  clientCount: number;
  billing: "MENSAL" | "PONTUAL";
  currency: string;
  tagline: string | null;
  features: string[];
  badge: string | null;
  priceIsFrom: boolean;
  monthlyFee: number | null;
  cardMode: CardMode;
  cardPrice: number | null;
  maxInstallments: number | null;
  minMonths: number | null;
  isAddon: boolean;
  terms: string | null;
  fromGuide: boolean;
  commissionPercent: number | null;
  commissionFixed: number | null;
  commissionSplit: boolean;
}

const SUGGESTED_CATEGORIES = [
  "Captação Mobile",
  "Captação Câmera",
  "Produções sob projeto",
  "Sites",
  "Tráfego pago",
  "Social media",
  "Consultoria",
];

const CARD_MODES: { key: CardMode; label: string; hint: string }[] = [
  {
    key: "AUTO",
    label: "Automático",
    hint: "Repassa as taxas da maquininha e soma a margem do crédito.",
  },
  {
    key: "FIXED",
    label: "Valor fixo",
    hint: "Ex: R$ 1.800 em até 5x sem juros.",
  },
  { key: "NONE", label: "Só Pix", hint: "Sem cartão nem parcelamento." },
];

function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { key: T; label: string }[];
  label: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-text-secondary">{label}</span>
      <div
        className="flex w-fit gap-1 rounded-full border border-border bg-card p-1"
        role="radiogroup"
        aria-label={label}
      >
        {options.map((o) => (
          <button
            key={o.key}
            type="button"
            role="radio"
            aria-checked={value === o.key}
            onClick={() => onChange(o.key)}
            className={cn(
              "h-9 rounded-full px-4 text-sm font-medium transition-colors",
              value === o.key
                ? "bg-ink text-ink-on"
                : "text-text-secondary hover:text-text-primary",
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

const num = (v: FormDataEntryValue | null) => parseMoney(v);

function priceLine(
  s: Pick<
    ServiceRow,
    "defaultPrice" | "currency" | "billing" | "priceIsFrom" | "monthlyFee"
  >,
): string {
  if (s.defaultPrice == null) return "Preço sob consulta";
  const base = `${s.priceIsFrom ? "a partir de " : ""}${formatCurrency(s.defaultPrice, s.currency)}${s.billing === "MENSAL" ? "/mês" : ""}`;
  return s.monthlyFee
    ? `${base} + ${formatCurrency(s.monthlyFee, s.currency)}/mês`
    : base;
}

function cardLine(s: ServiceRow, config: PricingConfig): string | null {
  if (s.defaultPrice == null || s.currency !== "BRL") return null;
  if (s.cardMode === "NONE") return "Só à vista no Pix";
  const q = computeQuote(
    [
      {
        billing: s.billing,
        quantity: 1,
        unitPrice: s.defaultPrice,
        cardMode: s.cardMode,
        cardPrice: s.cardPrice,
        maxInstallments: s.maxInstallments,
      },
    ],
    config,
  );
  if (s.billing === "MENSAL")
    return q.monthly?.card
      ? `Cartão: ${formatCurrency(q.monthly.card)}/mês`
      : null;
  const last = q.oneTime?.credit.at(-1);
  if (!last) return null;
  return last.n === 1
    ? `Cartão: ${formatCurrency(last.total)}`
    : `ou ${last.n}x de ${formatCurrency(last.installment)} no cartão`;
}

export function ServiceCatalog({
  services,
  config,
  canManage,
}: {
  services: ServiceRow[];
  config: PricingConfig;
  canManage: boolean;
}) {
  const [editing, setEditing] = useState<ServiceRow | "new" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [pending, startTransition] = useTransition();

  // Estado do formulário que muda o que aparece na tela.
  const [billing, setBilling] = useState<"MENSAL" | "PONTUAL">("PONTUAL");
  const [cardMode, setCardMode] = useState<CardMode>("AUTO");
  const [currency, setCurrency] = useState<"BRL" | "USD">("BRL");

  function openEditor(target: ServiceRow | "new") {
    setEditing(target);
    setError(null);
    setBilling(target === "new" ? "PONTUAL" : target.billing);
    setCardMode(target === "new" ? "AUTO" : target.cardMode);
    setCurrency(
      target === "new" ? "BRL" : target.currency === "USD" ? "USD" : "BRL",
    );
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return services;
    return services.filter((s) =>
      [s.name, s.category, s.tagline].some((v) => v?.toLowerCase().includes(q)),
    );
  }, [services, query]);

  const grouped = useMemo(() => {
    const map = new Map<string, ServiceRow[]>();
    for (const s of filtered) {
      const key = s.category || "Sem categoria";
      map.set(key, [...(map.get(key) ?? []), s]);
    }
    return [...map.entries()];
  }, [filtered]);

  const categories = useMemo(
    () => [
      ...new Set([
        ...services.map((s) => s.category).filter((c): c is string => !!c),
        ...SUGGESTED_CATEGORIES,
      ]),
    ],
    [services],
  );

  const hasGuide = services.some((s) => s.fromGuide);

  function loadGuide() {
    if (
      hasGuide &&
      !confirm(
        "Recarregar a tabela do Guia? Preços e textos dos serviços do Guia voltam ao que está no documento. Serviços criados por vocês não mudam.",
      )
    )
      return;
    startTransition(async () => {
      const result = await loadGuideCatalogAction();
      if (!result.ok) return setNotice(result.error);
      setNotice(
        `Tabela do Guia carregada: ${result.created} novo${result.created === 1 ? "" : "s"}, ${result.updated} atualizado${result.updated === 1 ? "" : "s"}.`,
      );
    });
  }

  function submit(formData: FormData) {
    const input = {
      name: String(formData.get("name") ?? ""),
      category: String(formData.get("category") ?? ""),
      description: String(formData.get("description") ?? ""),
      defaultPrice: num(formData.get("defaultPrice")),
      billing,
      currency,
      tagline: String(formData.get("tagline") ?? ""),
      features: String(formData.get("features") ?? "")
        .split("\n")
        .map((l) => l.replace(/^[-•·\s]+/, "").trim())
        .filter(Boolean),
      badge: String(formData.get("badge") ?? ""),
      priceIsFrom: formData.get("priceIsFrom") === "on",
      monthlyFee:
        billing === "PONTUAL" ? num(formData.get("monthlyFee")) : null,
      cardMode: currency === "USD" ? ("NONE" as const) : cardMode,
      cardPrice: cardMode === "FIXED" ? num(formData.get("cardPrice")) : null,
      maxInstallments: num(formData.get("maxInstallments")),
      minMonths: num(formData.get("minMonths")),
      isAddon: formData.get("isAddon") === "on",
      terms: String(formData.get("terms") ?? ""),
      commissionPercent: formData.get("commissionType") === "PERCENT" ? num(formData.get("commissionValue")) : null,
      commissionFixed: formData.get("commissionType") === "FIXED" ? num(formData.get("commissionValue")) : null,
      commissionSplit: formData.get("commissionSplit") === "on",
    };
    startTransition(async () => {
      const result = await saveServiceAction(
        editing && editing !== "new" ? editing.id : null,
        input,
      );
      if (!result.ok) return setError(result.error);
      setError(null);
      setEditing(null);
    });
  }

  const current = editing && editing !== "new" ? editing : null;
  const activeCount = services.filter((s) => s.active).length;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-border bg-card p-4 sm:p-5">
        <div>
          <h2 className="text-[17px] font-semibold tracking-tight text-text-primary">
            Catálogo de serviços
          </h2>
          <p className="text-sm text-text-tertiary">
            {activeCount} ativo{activeCount === 1 ? "" : "s"} · aparecem nos
            orçamentos, nos leads e nos clientes
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canManage && (
            <>
              <Link
                href="/propostas/configuracoes"
                className="inline-flex h-11 items-center gap-2 rounded-full border border-border bg-card px-4 text-sm font-medium text-text-primary hover:bg-card-elevated"
              >
                <SlidersHorizontal size={16} />{" "}
                <span className="hidden sm:inline">Taxas e pagamento</span>
              </Link>
              <Button
                variant="secondary"
                onClick={loadGuide}
                disabled={pending}
              >
                <BookOpenCheck size={16} />{" "}
                <span className="hidden sm:inline">
                  {hasGuide ? "Recarregar Guia" : "Carregar tabela do Guia"}
                </span>
              </Button>
              <Button onClick={() => openEditor("new")}>
                <Plus size={16} />{" "}
                <span className="hidden sm:inline">Novo serviço</span>
              </Button>
            </>
          )}
        </div>
      </div>

      {notice && (
        <p
          role="status"
          className="rounded-2xl bg-success/10 px-4 py-3 text-sm text-success"
        >
          {notice}
        </p>
      )}

      {services.length > 6 && (
        <label className="relative block max-w-sm">
          <Search
            size={16}
            className="pointer-events-none absolute left-4 top-1/2 z-10 -translate-y-1/2 text-text-tertiary"
          />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar serviço"
            aria-label="Buscar serviço"
            className="h-11 w-full rounded-full border border-border bg-card pl-11 pr-4 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-4 focus:ring-accent/15"
          />
        </label>
      )}

      {services.length === 0 ? (
        <EmptyState
          icon={<Package size={24} />}
          title="Nenhum serviço cadastrado"
          description="Carregue a tabela do Guia Comercial com um clique (captação, produções, sites, Cutlist, UGC, Figuras Públicas…) ou cadastre os seus."
          action={
            canManage && (
              <div className="flex flex-wrap justify-center gap-2">
                <Button onClick={loadGuide} disabled={pending}>
                  <BookOpenCheck size={16} /> Carregar tabela do Guia
                </Button>
                <Button variant="secondary" onClick={() => openEditor("new")}>
                  <Plus size={16} /> Cadastrar manualmente
                </Button>
              </div>
            )
          }
        />
      ) : (
        grouped.map(([category, items]) => (
          <section key={category} className="flex flex-col gap-3">
            <h3 className="px-1 text-sm font-semibold text-text-secondary">
              {category}
            </h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {items.map((s) => {
                const card = cardLine(s, config);
                return (
                  <article
                    key={s.id}
                    className={cn(
                      "flex flex-col gap-3 rounded-3xl border border-border bg-card p-5",
                      !s.active && "opacity-60",
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-semibold text-text-primary">
                          {s.name}
                        </p>
                        {s.tagline && (
                          <p className="text-xs text-text-tertiary">
                            {s.tagline}
                          </p>
                        )}
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        {s.badge && (
                          <span className="rounded-full bg-accent/15 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-accent-light">
                            {s.badge}
                          </span>
                        )}
                        {!s.active && (
                          <span className="rounded-full bg-card-elevated px-2.5 py-1 text-xs font-medium text-text-secondary">
                            Pausado
                          </span>
                        )}
                      </div>
                    </div>
                    <div>
                      <p className="lb-figures text-lg font-semibold tracking-tight text-text-primary">
                        {priceLine(s)}
                      </p>
                      {card && (
                        <p className="lb-figures text-xs text-text-tertiary">
                          {card}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      <span className="rounded-full bg-card-elevated px-2.5 py-1 text-xs text-text-secondary">
                        {s.billing === "MENSAL" ? "Recorrente" : "Pontual"}
                      </span>
                      {s.minMonths && (
                        <span className="rounded-full bg-card-elevated px-2.5 py-1 text-xs text-text-secondary">
                          Mínimo {s.minMonths} meses
                        </span>
                      )}
                      {s.isAddon && (
                        <span className="rounded-full bg-card-elevated px-2.5 py-1 text-xs text-text-secondary">
                          Adicional
                        </span>
                      )}
                      {canManage && (s.commissionPercent != null || s.commissionFixed != null || s.isAddon) && (
                        <span className="rounded-full bg-success/10 px-2.5 py-1 text-xs text-success">
                          Comissão{" "}
                          {s.commissionFixed != null
                            ? formatCurrency(s.commissionFixed)
                            : s.commissionPercent != null
                              ? `${s.commissionPercent.toLocaleString("pt-BR")}%`
                              : "do plano"}
                          {s.commissionSplit ? " · 50/50" : ""}
                        </span>
                      )}
                    </div>
                    {s.features.length > 0 && (
                      <ul className="flex flex-col gap-1 text-sm text-text-secondary">
                        {s.features.slice(0, 4).map((f) => (
                          <li key={f} className="flex gap-2">
                            <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-text-tertiary" />
                            {f}
                          </li>
                        ))}
                      </ul>
                    )}
                    <div className="mt-auto flex items-center justify-between gap-2 border-t border-border pt-3">
                      <span className="text-xs text-text-tertiary">
                        {s.leadCount} lead{s.leadCount === 1 ? "" : "s"} ·{" "}
                        {s.clientCount} cliente{s.clientCount === 1 ? "" : "s"}
                      </span>
                      {canManage && (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            disabled={pending}
                            onClick={() =>
                              startTransition(
                                async () =>
                                  void (await toggleServiceActiveAction(s.id)),
                              )
                            }
                            className="h-8 rounded-full px-3 text-xs font-medium text-text-secondary hover:bg-card-elevated"
                          >
                            {s.active ? "Pausar" : "Reativar"}
                          </button>
                          <button
                            type="button"
                            onClick={() => openEditor(s)}
                            className="flex h-8 w-8 items-center justify-center rounded-full text-text-tertiary hover:bg-card-elevated hover:text-text-primary"
                            aria-label={`Editar ${s.name}`}
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            type="button"
                            disabled={pending}
                            onClick={() => {
                              if (
                                confirm(
                                  `Excluir "${s.name}"? Ele sai de todos os leads e clientes onde estava marcado. Orçamentos já feitos continuam iguais.`,
                                )
                              )
                                startTransition(
                                  async () =>
                                    void (await deleteServiceAction(s.id)),
                                );
                            }}
                            className="flex h-8 w-8 items-center justify-center rounded-full text-text-tertiary hover:bg-error/10 hover:text-error"
                            aria-label={`Excluir ${s.name}`}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        ))
      )}

      <Drawer
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing === "new" ? "Novo serviço" : "Editar serviço"}
        widthClassName="max-w-[600px]"
      >
        {editing && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              submit(new FormData(e.currentTarget));
            }}
            key={current?.id ?? "new"}
            className="flex flex-col gap-4"
          >
            {error && (
              <p className="rounded-2xl bg-error/10 px-4 py-3 text-sm text-error">
                {error}
              </p>
            )}
            <Input
              label="Nome do serviço"
              name="name"
              required
              autoFocus
              defaultValue={current?.name ?? ""}
              placeholder="Ex: Captação Mobile · Crescimento"
            />
            <div>
              <Input
                label="Categoria"
                name="category"
                list="service-categories"
                defaultValue={current?.category ?? ""}
                placeholder="Ex: Captação Mobile"
              />
              <datalist id="service-categories">
                {categories.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>
            <Input
              label="Frase curta (aparece no orçamento)"
              name="tagline"
              defaultValue={current?.tagline ?? ""}
              placeholder="Ex: Ritmo de 2 posts por semana · 8 vídeos por mês"
            />

            <div className="flex flex-wrap gap-4">
              <Segmented
                label="Cobrança"
                value={billing}
                onChange={setBilling}
                options={[
                  { key: "PONTUAL", label: "Pontual" },
                  { key: "MENSAL", label: "Mensal" },
                ]}
              />
              <Segmented
                label="Moeda"
                value={currency}
                onChange={setCurrency}
                options={[
                  { key: "BRL", label: "R$" },
                  { key: "USD", label: "US$" },
                ]}
              />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Input
                label={
                  billing === "MENSAL"
                    ? "Preço por mês (Pix)"
                    : "Preço à vista (Pix)"
                }
                name="defaultPrice"
                inputMode="decimal"
                defaultValue={current?.defaultPrice ?? ""}
                placeholder="Ex: 2290"
              />
              {billing === "PONTUAL" ? (
                <Input
                  label="Mensalidade junto (opcional)"
                  name="monthlyFee"
                  inputMode="decimal"
                  defaultValue={current?.monthlyFee ?? ""}
                  placeholder="Ex: 100 (hospedagem)"
                />
              ) : (
                <Input
                  label="Contrato mínimo (meses)"
                  name="minMonths"
                  inputMode="numeric"
                  defaultValue={current?.minMonths ?? ""}
                  placeholder="Ex: 3"
                />
              )}
            </div>
            {billing === "PONTUAL" && (
              <input type="hidden" name="minMonths" value="" />
            )}
            <label className="flex items-center gap-2 text-sm text-text-secondary">
              <input
                type="checkbox"
                name="priceIsFrom"
                defaultChecked={current?.priceIsFrom ?? false}
                className="h-4 w-4 accent-[var(--lh-accent)]"
              />
              Mostrar como &quot;a partir de&quot; (valor final depende do
              briefing)
            </label>

            {currency === "BRL" && (
              <div className="flex flex-col gap-3 rounded-2xl border border-border p-4">
                <Segmented
                  label="Cartão"
                  value={cardMode}
                  onChange={setCardMode}
                  options={CARD_MODES.map((m) => ({
                    key: m.key,
                    label: m.label,
                  }))}
                />
                <p className="text-xs text-text-tertiary">
                  {CARD_MODES.find((m) => m.key === cardMode)?.hint}
                </p>
                {cardMode !== "NONE" && (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {cardMode === "FIXED" && (
                      <Input
                        label="Total no cartão"
                        name="cardPrice"
                        inputMode="decimal"
                        defaultValue={current?.cardPrice ?? ""}
                        placeholder="Ex: 1800"
                      />
                    )}
                    {billing === "PONTUAL" && (
                      <Input
                        label="Máximo de parcelas"
                        name="maxInstallments"
                        inputMode="numeric"
                        defaultValue={current?.maxInstallments ?? ""}
                        placeholder={`Padrão: até ${config.maxInstallments}x`}
                      />
                    )}
                  </div>
                )}
              </div>
            )}

            <Textarea
              label="O que está incluso (um item por linha)"
              name="features"
              rows={5}
              defaultValue={current?.features.join("\n") ?? ""}
              placeholder={
                "8 vídeos por mês\nPlanejamento de pautas do mês\nCapas e legendas na tela"
              }
            />
            <Textarea
              label="Condições (entram no orçamento e no contrato)"
              name="terms"
              rows={2}
              defaultValue={current?.terms ?? ""}
              placeholder="Ex: Locomoção por conta do cliente."
            />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Input
                label="Selo (opcional)"
                name="badge"
                defaultValue={current?.badge ?? ""}
                placeholder="Ex: Mais vendido"
              />
              <label className="flex items-center gap-2 self-end pb-3 text-sm text-text-secondary">
                <input
                  type="checkbox"
                  name="isAddon"
                  defaultChecked={current?.isAddon ?? false}
                  className="h-4 w-4 accent-[var(--lh-accent)]"
                />
                É um adicional
              </label>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-[180px_minmax(0,1fr)]">
              <label className="flex flex-col gap-1.5 text-sm font-medium text-text-secondary">
                Comissão do comercial
                <select
                  name="commissionType"
                  defaultValue={current?.commissionFixed != null ? "FIXED" : current?.commissionPercent != null ? "PERCENT" : "NONE"}
                  className="h-11 rounded-xl border border-border bg-card px-3 text-sm text-text-primary focus:outline-none focus:ring-4 focus:ring-accent/15"
                >
                  <option value="PERCENT">% do valor</option>
                  <option value="FIXED">Valor fixo (R$)</option>
                  <option value="NONE">Sem comissão / segue o plano</option>
                </select>
              </label>
              <Input
                label="Valor"
                name="commissionValue"
                inputMode="decimal"
                defaultValue={current?.commissionFixed ?? current?.commissionPercent ?? ""}
                placeholder="Ex: 20 (para 20%) ou 500"
                hint="Paga de uma vez após o pagamento do cliente, mesmo parcelado. Nos mensais, a % é sobre a 1ª mensalidade."
              />
            </div>
            <label className="flex items-start gap-2.5 text-sm text-text-secondary">
              <input
                type="checkbox"
                name="commissionSplit"
                defaultChecked={current?.commissionSplit ?? false}
                className="mt-0.5 h-4 w-4 accent-[var(--lh-accent)]"
              />
              <span>
                Evento com sinal: pagar 50% da comissão quando o sinal entra e 50% na quitação
                <span className="block text-xs text-text-tertiary">Desmarcado, a comissão é paga inteira de uma vez.</span>
              </span>
            </label>
            <Textarea
              label="Anotações internas (não aparecem para o cliente)"
              name="description"
              rows={2}
              defaultValue={current?.description ?? ""}
            />
            <Button type="submit" disabled={pending} className="mt-1 w-full">
              {pending ? "Salvando…" : "Salvar serviço"}
            </Button>
          </form>
        )}
      </Drawer>
    </div>
  );
}
