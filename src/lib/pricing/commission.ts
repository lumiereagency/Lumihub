// Comissão de quem vende. Regra da diretoria: a Lumière recebe o valor de uma
// vez (a maquininha antecipa o parcelado), então a comissão também é paga
// integralmente, de uma vez, após a confirmação do pagamento — o
// parcelamento do cliente não muda nada para o comercial. A base é sempre o
// valor de tabela (Pix); taxas e margem do cartão ficam com a empresa.

export interface CommissionItem {
  name: string;
  billing: "MENSAL" | "PONTUAL";
  quantity: number;
  unitPrice: number;
  commissionPercent: number | null;
  commissionFixed: number | null;
}

export interface CommissionLine {
  name: string;
  rule: string;
  base: number | null;
  amount: number;
}

const round2 = (v: number) => Math.round(v * 100) / 100;

export function computeCommission(items: CommissionItem[], discountPercent = 0): { total: number; lines: CommissionLine[] } {
  const lines: CommissionLine[] = [];
  for (const i of items) {
    if (i.commissionFixed != null && i.commissionFixed > 0) {
      lines.push({ name: i.name, rule: i.quantity > 1 ? `valor fixo × ${i.quantity}` : "valor fixo", base: null, amount: round2(i.commissionFixed * i.quantity) });
    } else if (i.commissionPercent != null && i.commissionPercent > 0) {
      const base = round2(i.unitPrice * i.quantity * (1 - discountPercent / 100));
      lines.push({
        name: i.name,
        rule: `${i.commissionPercent.toLocaleString("pt-BR")}% ${i.billing === "MENSAL" ? "da 1ª mensalidade" : "do valor"}`,
        base,
        amount: round2((base * i.commissionPercent) / 100),
      });
    }
  }
  return { total: round2(lines.reduce((s, l) => s + l.amount, 0)), lines };
}
