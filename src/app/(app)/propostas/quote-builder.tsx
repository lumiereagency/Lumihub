"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Building2, ChevronDown, Minus, Plus, Search, Trash2, UserPlus, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { formatCurrency } from "@/lib/format";
import { computeQuote, type CardMode, type PricingConfig } from "@/lib/pricing/engine";
import { parseMoney } from "@/lib/pricing/parse";
import { quickLeadForQuoteAction, saveQuoteAction } from "@/lib/actions/quote-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { QuoteSummary } from "./quote-summary";

export interface CatalogService {
  id: string;
  name: string;
  category: string | null;
  tagline: string | null;
  features: string[];
  billing: "MENSAL" | "PONTUAL";
  currency: string;
  price: number;
  priceIsFrom: boolean;
  monthlyFee: number | null;
  cardMode: CardMode;
  cardPrice: number | null;
  maxInstallments: number | null;
  minMonths: number | null;
  badge: string | null;
  isAddon: boolean;
  terms: string | null;
}

export interface BuilderItem {
  key: string;
  serviceId: string | null;
  name: string;
  tagline: string | null;
  features: string[];
  billing: "MENSAL" | "PONTUAL";
  quantity: number;
  unitPrice: number;
  minPrice: number | null;
  monthlyFee: number | null;
  cardMode: CardMode;
  cardPrice: number | null;
  maxInstallments: number | null;
  minMonths: number | null;
  terms: string | null;
}

export interface BuilderInitial {
  id: string | null;
  title: string;
  leadId: string | null;
  clientId: string | null;
  recipientName: string;
  recipientPhone: string;
  intro: string;
  notes: string;
  validUntil: string;
  currency: "BRL" | "USD";
  discountPercent: number;
  maxInstallments: number | null;
  items: BuilderItem[];
}

interface Party {
  kind: "lead" | "client";
  id: string;
  name: string;
  contactName: string | null;
  phone: string | null;
  convertedClientId?: string | null;
}

let keySeq = 0;
const newKey = () => `item-${Date.now()}-${keySeq++}`;

function fromService(s: CatalogService): BuilderItem {
  return {
    key: newKey(),
    serviceId: s.id,
    name: s.name,
    tagline: s.tagline,
    features: s.features,
    billing: s.billing,
    quantity: 1,
    unitPrice: s.price,
    minPrice: s.priceIsFrom ? s.price : null,
    monthlyFee: s.monthlyFee,
    cardMode: s.cardMode,
    cardPrice: s.cardPrice,
    maxInstallments: s.maxInstallments,
    minMonths: s.minMonths,
    terms: s.terms,
  };
}

export function QuoteBuilder({
  initial,
  leads,
  clients,
  services,
  config,
  canManage,
}: {
  initial: BuilderInitial;
  leads: Party[];
  clients: Party[];
  services: CatalogService[];
  config: PricingConfig;
  canManage: boolean;
}) {
  const router = useRouter();
  const [title, setTitle] = useState(initial.title);
  const [party, setParty] = useState<Party | null>(
    () => (initial.clientId ? clients.find((c) => c.id === initial.clientId) : null) ?? (initial.leadId ? leads.find((l) => l.id === initial.leadId) : null) ?? null,
  );
  const [recipientName, setRecipientName] = useState(initial.recipientName);
  const [recipientPhone, setRecipientPhone] = useState(initial.recipientPhone);
  const [intro, setIntro] = useState(initial.intro);
  const [notes, setNotes] = useState(initial.notes);
  const [validUntil, setValidUntil] = useState(initial.validUntil);
  const [currency, setCurrency] = useState<"BRL" | "USD">(initial.currency);
  const [discount, setDiscount] = useState(String(initial.discountPercent || ""));
  const [maxInstallments, setMaxInstallments] = useState(initial.maxInstallments ? String(initial.maxInstallments) : "");
  const [items, setItems] = useState<BuilderItem[]>(initial.items);
  const [partyQuery, setPartyQuery] = useState("");
  const [partyOpen, setPartyOpen] = useState(false);
  const [newLead, setNewLead] = useState<{ company: string; contactName: string; whatsapp: string } | null>(null);
  const [catalogQuery, setCatalogQuery] = useState("");
  const [category, setCategory] = useState<string>("Todos");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const parties = useMemo(() => {
    const q = partyQuery.trim().toLowerCase();
    // Lead já convertido aparece só como cliente.
    const all = [...clients, ...leads.filter((l) => !l.convertedClientId)];
    return (q ? all.filter((p) => [p.name, p.contactName, p.phone].some((v) => v?.toLowerCase().includes(q))) : all).slice(0, 8);
  }, [partyQuery, leads, clients]);

  const catalog = useMemo(() => services.filter((s) => s.currency === currency), [services, currency]);
  const categories = useMemo(() => ["Todos", ...new Set(catalog.map((s) => s.category ?? "Outros"))], [catalog]);
  const visibleCatalog = useMemo(() => {
    const q = catalogQuery.trim().toLowerCase();
    return catalog.filter(
      (s) => (category === "Todos" || (s.category ?? "Outros") === category) && (!q || [s.name, s.tagline, s.category].some((v) => v?.toLowerCase().includes(q))),
    );
  }, [catalog, catalogQuery, category]);

  const quote = useMemo(
    () =>
      computeQuote(items, config, {
        discountPercent: canManage ? (parseMoney(discount) ?? 0) : initial.discountPercent,
        maxInstallments: maxInstallments ? Number(maxInstallments) : null,
        currency,
      }),
    [items, config, discount, maxInstallments, currency, canManage, initial.discountPercent],
  );

  function choose(p: Party) {
    setParty(p);
    setPartyOpen(false);
    setPartyQuery("");
    setRecipientName((prev) => prev || p.contactName || "");
    setRecipientPhone((prev) => prev || p.phone || "");
  }

  function addService(s: CatalogService) {
    setItems((prev) => {
      const same = prev.find((i) => i.serviceId === s.id);
      if (same) return prev.map((i) => (i === same ? { ...i, quantity: i.quantity + 1 } : i));
      return [...prev, fromService(s)];
    });
    if (!title.trim()) setTitle(s.category ? `${s.category}` : s.name);
  }

  function update(key: string, patch: Partial<BuilderItem>) {
    setItems((prev) => prev.map((i) => (i.key === key ? { ...i, ...patch } : i)));
  }

  function createLead() {
    if (!newLead) return;
    startTransition(async () => {
      const result = await quickLeadForQuoteAction(newLead);
      if (!result.ok) return setError(result.error);
      setError(null);
      choose({ kind: "lead", id: result.id, name: result.company, contactName: newLead.contactName || null, phone: newLead.whatsapp || null });
      setNewLead(null);
    });
  }

  function save() {
    if (!party) return setError("Escolha para quem é o orçamento.");
    startTransition(async () => {
      const result = await saveQuoteAction(initial.id, {
        title,
        leadId: party.kind === "lead" ? party.id : null,
        clientId: party.kind === "client" ? party.id : null,
        recipientName,
        recipientPhone,
        intro,
        notes,
        validUntil: validUntil || null,
        currency,
        discountPercent: parseMoney(discount) ?? 0,
        maxInstallments: maxInstallments ? Number(maxInstallments) : null,
        items: items.map((i) => ({
          serviceId: i.serviceId,
          name: i.name,
          tagline: i.tagline,
          features: i.features.map((f) => f.trim()).filter(Boolean),
          billing: i.billing,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          monthlyFee: i.monthlyFee,
          cardMode: i.cardMode,
          cardPrice: i.cardPrice,
          maxInstallments: i.maxInstallments,
          minMonths: i.minMonths,
          terms: i.terms,
        })),
      });
      if (!result.ok) return setError(result.error);
      router.push(`/propostas/${result.id}`);
    });
  }

  function addCustom() {
    setItems((prev) => [
      ...prev,
      {
        key: newKey(),
        serviceId: null,
        name: "Item personalizado",
        tagline: null,
        features: [],
        billing: "PONTUAL",
        quantity: 1,
        unitPrice: 0,
        minPrice: null,
        monthlyFee: null,
        cardMode: "AUTO",
        cardPrice: null,
        maxInstallments: null,
        minMonths: null,
        terms: null,
      },
    ]);
  }

  const card = "flex flex-col gap-4 rounded-3xl border border-border bg-card p-5 sm:p-6";

  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_400px]">
      <div className="flex min-w-0 flex-col gap-5">
        {/* Para quem */}
        <section className={card}>
          <h2 className="text-[17px] font-semibold tracking-tight text-text-primary">Para quem</h2>
          {party ? (
            <div className="flex items-center justify-between gap-3 rounded-2xl bg-card-elevated/60 px-4 py-3">
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent/15 text-accent-light">
                  <Building2 size={18} />
                </span>
                <div className="min-w-0">
                  <p className="truncate font-medium text-text-primary">{party.name}</p>
                  <p className="text-xs text-text-tertiary">{party.kind === "client" ? "Cliente" : "Lead"}</p>
                </div>
              </div>
              <button type="button" onClick={() => setParty(null)} className="h-9 rounded-full px-3 text-sm text-text-secondary hover:bg-card">
                Trocar
              </button>
            </div>
          ) : newLead ? (
            <div className="flex flex-col gap-3 rounded-2xl border border-border p-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <Input label="Empresa ou nome" value={newLead.company} onChange={(e) => setNewLead({ ...newLead, company: e.target.value })} autoFocus />
                <Input label="Contato" value={newLead.contactName} onChange={(e) => setNewLead({ ...newLead, contactName: e.target.value })} />
                <Input label="WhatsApp" value={newLead.whatsapp} onChange={(e) => setNewLead({ ...newLead, whatsapp: e.target.value })} inputMode="tel" />
              </div>
              <div className="flex gap-2">
                <Button type="button" onClick={createLead} disabled={pending || !newLead.company.trim()}>
                  Criar lead
                </Button>
                <Button type="button" variant="ghost" onClick={() => setNewLead(null)}>
                  Cancelar
                </Button>
              </div>
            </div>
          ) : (
            <div className="relative">
              <Search size={16} className="pointer-events-none absolute left-4 top-[22px] z-10 -translate-y-1/2 text-text-tertiary" />
              <input
                value={partyQuery}
                onChange={(e) => {
                  setPartyQuery(e.target.value);
                  setPartyOpen(true);
                }}
                onFocus={() => setPartyOpen(true)}
                placeholder="Buscar lead ou cliente pelo nome ou telefone"
                aria-label="Buscar lead ou cliente"
                className="h-11 w-full rounded-full border border-border bg-card pl-11 pr-4 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-4 focus:ring-accent/15"
              />
              {partyOpen && (
                <div className="absolute inset-x-0 top-12 z-20 flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-xl">
                  {parties.map((p) => (
                    <button key={`${p.kind}-${p.id}`} type="button" onClick={() => choose(p)} className="flex items-center justify-between gap-3 px-4 py-2.5 text-left hover:bg-card-elevated">
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium text-text-primary">{p.name}</span>
                        {p.contactName && <span className="block truncate text-xs text-text-tertiary">{p.contactName}</span>}
                      </span>
                      <span className="shrink-0 rounded-full bg-card-elevated px-2 py-0.5 text-[11px] text-text-secondary">{p.kind === "client" ? "Cliente" : "Lead"}</span>
                    </button>
                  ))}
                  {parties.length === 0 && <p className="px-4 py-3 text-sm text-text-tertiary">Nada encontrado.</p>}
                  <button
                    type="button"
                    onClick={() => {
                      setNewLead({ company: partyQuery, contactName: "", whatsapp: "" });
                      setPartyOpen(false);
                    }}
                    className="flex items-center gap-2 border-t border-border px-4 py-3 text-left text-sm font-medium text-accent-light hover:bg-card-elevated"
                  >
                    <UserPlus size={16} /> Cadastrar novo lead{partyQuery ? ` "${partyQuery}"` : ""}
                  </button>
                </div>
              )}
            </div>
          )}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Input label="Nome de quem recebe" value={recipientName} onChange={(e) => setRecipientName(e.target.value)} placeholder="Aparece no link: Olá, Mariana." />
            <Input label="WhatsApp de quem recebe" value={recipientPhone} onChange={(e) => setRecipientPhone(e.target.value)} inputMode="tel" placeholder="(00) 00000-0000" />
          </div>
        </section>

        {/* Serviços */}
        <section className={card}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-[17px] font-semibold tracking-tight text-text-primary">Serviços</h2>
            {canManage && (
              <div className="flex gap-1 rounded-full border border-border p-1">
                {(["BRL", "USD"] as const).map((cur) => (
                  <button
                    key={cur}
                    type="button"
                    aria-pressed={currency === cur}
                    onClick={() => {
                      if (cur !== currency && items.length && !confirm("Trocar a moeda remove os itens já adicionados. Continuar?")) return;
                      if (cur !== currency) setItems([]);
                      setCurrency(cur);
                    }}
                    className={cn("h-8 rounded-full px-3 text-xs font-medium", currency === cur ? "bg-ink text-ink-on" : "text-text-secondary")}
                  >
                    {cur === "BRL" ? "Real (R$)" : "Dólar (US$)"}
                  </button>
                ))}
              </div>
            )}
          </div>

          {items.length > 0 && (
            <ul className="flex flex-col gap-2">
              {items.map((item) => {
                const priceLocked = !canManage && item.minPrice == null;
                const open = expanded === item.key;
                return (
                  <li key={item.key} className="rounded-2xl border border-border">
                    <div className="flex flex-wrap items-center gap-3 px-4 py-3">
                      <button type="button" onClick={() => setExpanded(open ? null : item.key)} className="flex min-w-0 flex-1 items-center gap-2 text-left" aria-expanded={open}>
                        <ChevronDown size={16} className={cn("shrink-0 text-text-tertiary transition-transform", open && "rotate-180")} />
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium text-text-primary">{item.name}</span>
                          <span className="block text-xs text-text-tertiary">
                            {item.billing === "MENSAL" ? "Mensal" : "Pontual"}
                            {item.monthlyFee ? ` + ${formatCurrency(item.monthlyFee, currency)}/mês` : ""}
                            {item.cardMode === "NONE" ? " · só Pix" : item.cardMode === "FIXED" ? ` · cartão ${formatCurrency(item.cardPrice ?? 0, currency)}` : ""}
                            {item.minPrice != null ? ` · a partir de ${formatCurrency(item.minPrice, currency)}` : ""}
                          </span>
                        </span>
                      </button>
                      <div className="flex items-center gap-1 rounded-full border border-border p-0.5">
                        <button type="button" aria-label="Diminuir quantidade" onClick={() => update(item.key, { quantity: Math.max(1, item.quantity - 1) })} className="flex h-7 w-7 items-center justify-center rounded-full text-text-secondary hover:bg-card-elevated">
                          <Minus size={13} />
                        </button>
                        <span className="lb-figures w-6 text-center text-sm text-text-primary">{item.quantity}</span>
                        <button type="button" aria-label="Aumentar quantidade" onClick={() => update(item.key, { quantity: Math.min(999, item.quantity + 1) })} className="flex h-7 w-7 items-center justify-center rounded-full text-text-secondary hover:bg-card-elevated">
                          <Plus size={13} />
                        </button>
                      </div>
                      <label className="relative w-[120px]">
                        <span className="sr-only">Preço de {item.name}</span>
                        <input
                          key={`${item.key}-${item.unitPrice}`}
                          defaultValue={item.unitPrice}
                          disabled={priceLocked}
                          inputMode="decimal"
                          onBlur={(e) => {
                            const v = parseMoney(e.target.value);
                            if (v == null) return;
                            update(item.key, { unitPrice: item.minPrice != null && !canManage ? Math.max(v, item.minPrice) : v });
                          }}
                          className="lb-figures h-9 w-full rounded-xl border border-border bg-card px-3 text-right text-sm text-text-primary disabled:border-transparent disabled:bg-transparent disabled:text-text-primary"
                        />
                      </label>
                      <button type="button" aria-label={`Remover ${item.name}`} onClick={() => setItems((prev) => prev.filter((i) => i.key !== item.key))} className="flex h-9 w-9 items-center justify-center rounded-full text-text-tertiary hover:bg-error/10 hover:text-error">
                        <Trash2 size={15} />
                      </button>
                    </div>
                    {open && (
                      <div className="flex flex-col gap-3 border-t border-border px-4 py-4">
                        {canManage ? (
                          <>
                            <Input label="Nome no orçamento" value={item.name} onChange={(e) => update(item.key, { name: e.target.value })} />
                            <Input label="Frase curta" value={item.tagline ?? ""} onChange={(e) => update(item.key, { tagline: e.target.value || null })} />
                            {!item.serviceId && (
                              <div className="flex flex-wrap gap-3">
                                {(["PONTUAL", "MENSAL"] as const).map((b) => (
                                  <button key={b} type="button" aria-pressed={item.billing === b} onClick={() => update(item.key, { billing: b })} className={cn("h-9 rounded-full border px-4 text-sm", item.billing === b ? "border-transparent bg-ink text-ink-on" : "border-border text-text-secondary")}>
                                    {b === "PONTUAL" ? "Pontual" : "Mensal"}
                                  </button>
                                ))}
                                {(["AUTO", "NONE"] as const).map((m) => (
                                  <button key={m} type="button" aria-pressed={item.cardMode === m} onClick={() => update(item.key, { cardMode: m })} className={cn("h-9 rounded-full border px-4 text-sm", item.cardMode === m ? "border-transparent bg-ink text-ink-on" : "border-border text-text-secondary")}>
                                    {m === "AUTO" ? "Aceita cartão" : "Só Pix"}
                                  </button>
                                ))}
                              </div>
                            )}
                            <Textarea
                              label="O que está incluso (um por linha)"
                              rows={4}
                              value={item.features.join("\n")}
                              onChange={(e) => update(item.key, { features: e.target.value.split("\n") })}
                            />
                            <Textarea label="Condições" rows={2} value={item.terms ?? ""} onChange={(e) => update(item.key, { terms: e.target.value || null })} />
                          </>
                        ) : (
                          <>
                            {item.tagline && <p className="text-sm text-text-secondary">{item.tagline}</p>}
                            <ul className="flex flex-col gap-1 text-sm text-text-secondary">
                              {item.features.map((f) => (
                                <li key={f}>• {f}</li>
                              ))}
                            </ul>
                            {item.terms && <p className="text-xs text-text-tertiary">{item.terms}</p>}
                            <p className="text-xs text-text-tertiary">Preço e itens seguem a tabela. Condição diferente só com a diretoria.</p>
                          </>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          <div className="flex flex-col gap-3 rounded-2xl bg-card-elevated/40 p-3 sm:p-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <label className="relative flex-1">
                <Search size={15} className="pointer-events-none absolute left-3.5 top-1/2 z-10 -translate-y-1/2 text-text-tertiary" />
                <input
                  value={catalogQuery}
                  onChange={(e) => setCatalogQuery(e.target.value)}
                  placeholder="Adicionar serviço do catálogo"
                  aria-label="Buscar serviço do catálogo"
                  className="h-10 w-full rounded-full border border-border bg-card pl-10 pr-4 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-4 focus:ring-accent/15"
                />
              </label>
              {canManage && (
                <button type="button" onClick={addCustom} className="h-10 shrink-0 rounded-full border border-dashed border-border px-4 text-sm text-text-secondary hover:text-text-primary">
                  + Item personalizado
                </button>
              )}
            </div>
            <div className="scrollbar-thin -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
              {categories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  aria-pressed={category === cat}
                  onClick={() => setCategory(cat)}
                  className={cn("h-8 shrink-0 rounded-full px-3 text-xs font-medium", category === cat ? "bg-ink text-ink-on" : "bg-card text-text-secondary hover:text-text-primary")}
                >
                  {cat}
                </button>
              ))}
            </div>
            {catalog.length === 0 ? (
              <p className="px-1 py-2 text-sm text-text-tertiary">Nenhum serviço {currency === "USD" ? "em dólar " : ""}no catálogo. Carregue a tabela do Guia em CRM → Serviços.</p>
            ) : (
              <div className="grid max-h-[340px] grid-cols-1 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
                {visibleCatalog.map((s) => {
                  const count = items.filter((i) => i.serviceId === s.id).reduce((n, i) => n + i.quantity, 0);
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => addService(s)}
                      className={cn("flex items-start justify-between gap-3 rounded-2xl border bg-card px-3.5 py-3 text-left transition-colors hover:border-text-tertiary/60", count ? "border-accent/50" : "border-border")}
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium text-text-primary">{s.name}</span>
                        <span className="lb-figures block text-xs text-text-tertiary">
                          {s.priceIsFrom ? "a partir de " : ""}
                          {formatCurrency(s.price, s.currency)}
                          {s.billing === "MENSAL" ? "/mês" : ""}
                          {s.badge ? ` · ${s.badge}` : ""}
                        </span>
                      </span>
                      <span className={cn("flex h-7 min-w-7 shrink-0 items-center justify-center rounded-full px-1.5 text-xs font-semibold", count ? "bg-accent text-white" : "bg-card-elevated text-text-secondary")}>
                        {count || <Plus size={14} />}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        {/* Mensagem e validade */}
        <section className={card}>
          <h2 className="text-[17px] font-semibold tracking-tight text-text-primary">Apresentação</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_200px]">
            <Input label="Título do orçamento" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex: Captação Mobile + Site" />
            <Input label="Válido até" type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />
          </div>
          <Textarea
            label="Mensagem para o cliente (aparece no topo do link)"
            rows={4}
            value={intro}
            onChange={(e) => setIntro(e.target.value)}
            placeholder="Ex: Foi ótimo conversar com você! Montei este plano pensando no seu objetivo de postar com constância sem perder qualidade…"
          />
          {canManage && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Input label="Desconto da diretoria (%)" value={discount} onChange={(e) => setDiscount(e.target.value)} inputMode="decimal" placeholder="0" />
              <Input label="Limitar parcelas em" value={maxInstallments} onChange={(e) => setMaxInstallments(e.target.value.replace(/\D/g, ""))} inputMode="numeric" placeholder={`Padrão: até ${config.maxInstallments}x`} />
            </div>
          )}
          <Textarea label="Anotações internas (o cliente não vê)" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </section>
      </div>

      <aside className="flex flex-col gap-4 xl:sticky xl:top-6 xl:self-start">
        <section className="flex flex-col gap-4 rounded-3xl border border-border bg-card p-5">
          <h2 className="text-[17px] font-semibold tracking-tight text-text-primary">Valores</h2>
          <QuoteSummary quote={quote} compact />
        </section>
        {error && (
          <p role="alert" className="flex items-start justify-between gap-2 rounded-2xl bg-error/10 px-4 py-3 text-sm text-error">
            {error}
            <button type="button" onClick={() => setError(null)} aria-label="Fechar aviso">
              <X size={15} />
            </button>
          </p>
        )}
        <Button type="button" onClick={save} disabled={pending || items.length === 0} className="w-full">
          {pending ? "Salvando…" : initial.id ? "Salvar alterações" : "Salvar orçamento"}
        </Button>
        <p className="text-center text-xs text-text-tertiary">Depois de salvar você envia o link pelo WhatsApp com um clique.</p>
      </aside>
    </div>
  );
}
