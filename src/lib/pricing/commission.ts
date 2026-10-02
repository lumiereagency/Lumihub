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
  commissionSplit?: boolean;
}

export interface CommissionLine {
  name: string;
  rule: string;
  base: number | null;
  amount: number;
  split: boolean;
}

const round2 = (v: number) => Math.round(v * 100) / 100;

export interface CommissionResult {
  total: number;
  // Parte paga de uma vez (após o pagamento) e parte de eventos (50% no sinal, 50% na quitação).
  integral: number;
  split: number;
  lines: CommissionLine[];
}

export function computeCommission(items: CommissionItem[], discountPercent = 0): CommissionResult {
  const lines: CommissionLine[] = [];
  for (const i of items) {
    if (i.commissionFixed != null && i.commissionFixed > 0) {
      lines.push({ name: i.name, rule: i.quantity > 1 ? `valor fixo × ${i.quantity}` : "valor fixo", base: null, amount: round2(i.commissionFixed * i.quantity), split: !!i.commissionSplit });
    } else if (i.commissionPercent != null && i.commissionPercent > 0) {
      const base = round2(i.unitPrice * i.quantity * (1 - discountPercent / 100));
      lines.push({
        name: i.name,
        rule: `${i.commissionPercent.toLocaleString("pt-BR")}% ${i.billing === "MENSAL" ? "da 1ª mensalidade" : "do valor"}`,
        base,
        amount: round2((base * i.commissionPercent) / 100),
        split: !!i.commissionSplit,
      });
    }
  }
  const sum = (ls: CommissionLine[]) => round2(ls.reduce((s, l) => s + l.amount, 0));
  return { total: sum(lines), integral: sum(lines.filter((l) => !l.split)), split: sum(lines.filter((l) => l.split)), lines };
}
