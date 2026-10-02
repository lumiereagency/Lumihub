"use client";

import { useMemo, useState, useTransition } from "react";
import {
  Calculator,
  Check,
  CreditCard,
  FileSignature,
  MessageCircle,
  RotateCcw,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { formatCurrency } from "@/lib/format";
import {
  computeQuote,
  DEFAULT_FEE_ROWS,
  type FeeRow,
} from "@/lib/pricing/engine";
import { parseMoney } from "@/lib/pricing/parse";
import { savePricingSettingsAction } from "@/lib/actions/pricing-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

interface SettingsView {
  config: {
    debitFee: number;
    rows: FeeRow[];
    creditMargin: number;
    maxInstallments: number;
  };
  validityDays: number;
  pixKey: string | null;
  whatsappTemplate: string;
  contractMessage: string;
  company: {
    legalName: string;
    document: string | null;
    address: string | null;
    city: string | null;
    representativeName: string | null;
    representativeEmail: string | null;
    representativeDoc: string | null;
  };
}

const pctInput =
  "lb-figures h-10 w-full rounded-xl border border-border bg-card px-3 text-right text-sm text-text-primary focus:outline-none focus:ring-4 focus:ring-accent/15";

function Section({
  icon,
  title,
  description,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4 rounded-3xl border border-border bg-card p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-card-elevated text-text-secondary">
          {icon}
        </span>
        <div>
          <h2 className="text-[17px] font-semibold tracking-tight text-text-primary">
            {title}
          </h2>
          <p className="text-sm text-text-tertiary">{description}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

export function PricingSettingsForm({ settings }: { settings: SettingsView }) {
  const [debitFee, setDebitFee] = useState(String(settings.config.debitFee));
  const [margin, setMargin] = useState(String(settings.config.creditMargin));
  const [maxInstallments, setMaxInstallments] = useState(
    String(settings.config.maxInstallments),
  );
  const [rows, setRows] = useState<
    { n: number; seller: string; buyer: string }[]
  >(
    settings.config.rows.map((r) => ({
      n: r.n,
      seller: String(r.seller),
      buyer: String(r.buyer),
    })),
  );
  const [simValue, setSimValue] = useState("3500");
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(
    null,
  );
  const [pending, startTransition] = useTransition();

  const parsedRows = useMemo(
    () =>
      rows.map((r) => ({
        n: r.n,
        seller: parseMoney(r.seller) ?? 0,
        buyer: parseMoney(r.buyer) ?? 0,
      })),
    [rows],
  );
  const config = useMemo(
    () => ({
      debitFee: parseMoney(debitFee) ?? 0,
      rows: parsedRows,
      creditMargin: parseMoney(margin) ?? 0,
      maxInstallments: Number(maxInstallments) || 1,
    }),
    [debitFee, parsedRows, margin, maxInstallments],
  );
  const sim = useMemo(() => {
    const value = parseMoney(simValue) ?? 0;
    return {
      value,
      quote: computeQuote(
        [
          {
            billing: "PONTUAL",
            quantity: 1,
            unitPrice: value,
            cardMode: "AUTO",
          },
        ],
        config,
      ),
    };
  }, [simValue, config]);

  function setRow(n: number, key: "seller" | "buyer", value: string) {
    setRows((prev) =>
      prev.map((r) => (r.n === n ? { ...r, [key]: value } : r)),
    );
  }

  function submit(formData: FormData) {
    const text = (k: string) => String(formData.get(k) ?? "");
    startTransition(async () => {
      const result = await savePricingSettingsAction({
        debitFee: config.debitFee,
        rows: config.rows,
        creditMargin: config.creditMargin,
        maxInstallments: config.maxInstallments,
        validityDays: Number(formData.get("validityDays")) || 7,
        pixKey: text("pixKey"),
        whatsappTemplate: text("whatsappTemplate"),
        contractMessage: text("contractMessage"),
        companyLegalName: text("companyLegalName"),
        companyDocument: text("companyDocument"),
        companyAddress: text("companyAddress"),
        companyCity: text("companyCity"),
        representativeName: text("representativeName"),
        representativeEmail: text("representativeEmail"),
        representativeDoc: text("representativeDoc"),
      });
      setStatus(
        result.ok
          ? {
              ok: true,
              text: "Configurações salvas. Os próximos orçamentos já usam os novos valores.",
            }
          : { ok: false, text: result.error },
      );
    });
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit(new FormData(e.currentTarget));
      }}
      className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_380px]"
    >
      <div className="flex min-w-0 flex-col gap-5">
        <Section
          icon={<CreditCard size={18} />}
          title="Maquininha e margem"
          description="Pix é o preço de tabela. No cartão, as taxas vão para o cliente e o crédito ganha a margem extra."
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Input
              label="Taxa do débito (%)"
              value={debitFee}
              onChange={(e) => setDebitFee(e.target.value)}
              inputMode="decimal"
            />
            <Input
              label="Margem extra no crédito (%)"
              value={margin}
              onChange={(e) => setMargin(e.target.value)}
              inputMode="decimal"
              hint="Quanto o líquido do crédito fica acima do Pix."
            />
            <Input
              label="Parcelar em até"
              value={maxInstallments}
              onChange={(e) =>
                setMaxInstallments(e.target.value.replace(/\D/g, ""))
              }
              inputMode="numeric"
              hint="vezes (máximo 18)"
            />
          </div>

          <div className="overflow-x-auto rounded-2xl border border-border">
            <table className="w-full min-w-[440px] text-sm">
              <thead className="bg-card-elevated/60 text-xs text-text-tertiary">
                <tr>
                  <th className="px-3 py-2.5 text-left font-medium">
                    Parcelas
                  </th>
                  <th className="px-3 py-2.5 text-right font-medium">
                    Taxa por venda, paga pela Lumière (%)
                  </th>
                  <th className="px-3 py-2.5 text-right font-medium">
                    Juros do parcelamento, pago pelo cliente (%)
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr
                    key={r.n}
                    className={cn(
                      "border-t border-border",
                      r.n > config.maxInstallments && "opacity-45",
                    )}
                  >
                    <td className="px-3 py-1.5 font-medium text-text-primary">
                      {r.n === 1 ? "Crédito à vista" : `${r.n}x`}
                    </td>
                    <td className="px-3 py-1.5">
                      <input
                        aria-label={`Taxa por venda em ${r.n}x`}
                        value={r.seller}
                        onChange={(e) => setRow(r.n, "seller", e.target.value)}
                        className={pctInput}
                        inputMode="decimal"
                      />
                    </td>
                    <td className="px-3 py-1.5">
                      {r.n === 1 ? (
                        <span className="block px-3 text-right text-text-tertiary">
                          —
                        </span>
                      ) : (
                        <input
                          aria-label={`Juros do parcelamento em ${r.n}x`}
                          value={r.buyer}
                          onChange={(e) => setRow(r.n, "buyer", e.target.value)}
                          className={pctInput}
                          inputMode="decimal"
                        />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button
            type="button"
            onClick={() =>
              setRows(
                DEFAULT_FEE_ROWS.map((r) => ({
                  n: r.n,
                  seller: String(r.seller),
                  buyer: String(r.buyer),
                })),
              )
            }
            className="inline-flex w-fit items-center gap-1.5 text-xs font-medium text-text-tertiary hover:text-text-primary"
          >
            <RotateCcw size={13} /> Voltar para a tabela original da maquininha
          </button>
        </Section>

        <Section
          icon={<MessageCircle size={18} />}
          title="Mensagens prontas"
          description="Usadas no envio por WhatsApp. Dá para ajustar o texto em cada envio também."
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Input
              label="Validade padrão do orçamento (dias)"
              name="validityDays"
              inputMode="numeric"
              defaultValue={settings.validityDays}
            />
            <Input
              label="Chave Pix (aparece no orçamento aceito)"
              name="pixKey"
              defaultValue={settings.pixKey ?? ""}
              placeholder="CNPJ, e-mail ou chave aleatória"
            />
          </div>
          <Textarea
            label="Envio do orçamento"
            name="whatsappTemplate"
            rows={7}
            defaultValue={settings.whatsappTemplate}
          />
          <Textarea
            label="Envio do contrato para assinatura"
            name="contractMessage"
            rows={6}
            defaultValue={settings.contractMessage}
          />
          <p className="text-xs text-text-tertiary">
            Variáveis: <code>{"{nome}"}</code> primeiro nome do cliente ·{" "}
            <code>{"{vendedor}"}</code> quem envia · <code>{"{titulo}"}</code>{" "}
            título · <code>{"{link}"}</code> link · <code>{"{validade}"}</code>{" "}
            data de validade
          </p>
        </Section>

        <Section
          icon={<FileSignature size={18} />}
          title="Dados da Lumière no contrato"
          description="Aparecem como CONTRATADA no contrato. O representante assina pelo Autentique."
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Input
              label="Razão social"
              name="companyLegalName"
              defaultValue={settings.company.legalName}
            />
            <Input
              label="CNPJ"
              name="companyDocument"
              defaultValue={settings.company.document ?? ""}
              placeholder="00.000.000/0001-00"
            />
            <div className="sm:col-span-2">
              <Input
                label="Endereço completo"
                name="companyAddress"
                defaultValue={settings.company.address ?? ""}
                placeholder="Rua, número, bairro, cidade/UF, CEP"
              />
            </div>
            <Input
              label="Foro (cidade/UF)"
              name="companyCity"
              defaultValue={settings.company.city ?? ""}
              placeholder="Ex: Goiânia/GO"
            />
            <Input
              label="Representante legal"
              name="representativeName"
              defaultValue={settings.company.representativeName ?? ""}
            />
            <Input
              label="CPF do representante"
              name="representativeDoc"
              defaultValue={settings.company.representativeDoc ?? ""}
            />
            <Input
              label="E-mail do representante"
              name="representativeEmail"
              type="email"
              defaultValue={settings.company.representativeEmail ?? ""}
              hint="Recebe o pedido de assinatura do Autentique."
            />
          </div>
        </Section>
      </div>

      <aside className="flex flex-col gap-4 xl:sticky xl:top-6 xl:self-start">
        <section className="flex flex-col gap-4 rounded-3xl border border-border bg-card p-5">
          <div className="flex items-center gap-2">
            <Calculator size={18} className="text-text-tertiary" />
            <h2 className="text-[17px] font-semibold tracking-tight text-text-primary">
              Simulador
            </h2>
          </div>
          <Input
            label="Preço de tabela (Pix)"
            value={simValue}
            onChange={(e) => setSimValue(e.target.value)}
            inputMode="decimal"
          />
          {sim.quote.oneTime && sim.value > 0 && (
            <div className="flex flex-col gap-1 text-sm">
              <div className="flex justify-between rounded-xl bg-success/10 px-3 py-2 text-success">
                <span>Pix</span>
                <span className="lb-figures font-semibold">
                  {formatCurrency(sim.quote.oneTime.pix)}
                </span>
              </div>
              {sim.quote.oneTime.debit != null && (
                <div className="flex justify-between px-3 py-1.5 text-text-secondary">
                  <span>Débito</span>
                  <span className="lb-figures">
                    {formatCurrency(sim.quote.oneTime.debit)}
                  </span>
                </div>
              )}
              <div className="mt-1 grid grid-cols-[auto_1fr_1fr] gap-x-3 gap-y-1 px-3 text-xs text-text-tertiary">
                <span>Cartão</span>
                <span className="text-right">Cliente paga</span>
                <span className="text-right">Você recebe</span>
                {sim.quote.oneTime.credit.map((c) => (
                  <div key={c.n} className="contents text-sm">
                    <span className="text-text-secondary">{c.n}x</span>
                    <span className="lb-figures text-right text-text-primary">
                      {c.n === 1
                        ? formatCurrency(c.total)
                        : `${formatCurrency(c.installment)}`}
                    </span>
                    <span
                      className={cn(
                        "lb-figures text-right",
                        c.net >= sim.value ? "text-success" : "text-error",
                      )}
                    >
                      {formatCurrency(c.net)}
                    </span>
                  </div>
                ))}
              </div>
              <p className="mt-2 px-3 text-xs text-text-tertiary">
                &quot;Você recebe&quot; é o líquido depois de todas as taxas —
                fica sempre acima do Pix pela margem configurada.
              </p>
            </div>
          )}
        </section>

        {status && (
          <p
            role="status"
            className={cn(
              "flex items-start gap-2 rounded-2xl px-4 py-3 text-sm",
              status.ok
                ? "bg-success/10 text-success"
                : "bg-error/10 text-error",
            )}
          >
            {status.ok && <Check size={16} className="mt-0.5 shrink-0" />}
            {status.text}
          </p>
        )}
        <Button type="submit" disabled={pending} className="w-full">
          {pending ? "Salvando…" : "Salvar configurações"}
        </Button>
      </aside>
    </form>
  );
}
