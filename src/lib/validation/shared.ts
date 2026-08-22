export const PAYMENT_METHODS = [
  "PIX",
  "TRANSFERENCIA",
  "BOLETO",
  "CARTAO_CREDITO",
  "CARTAO_DEBITO",
  "DINHEIRO",
  "OUTRO",
] as const;

export const PAYMENT_METHOD_LABELS: Record<(typeof PAYMENT_METHODS)[number], string> = {
  PIX: "Pix",
  TRANSFERENCIA: "Transferência",
  BOLETO: "Boleto",
  CARTAO_CREDITO: "Cartão de crédito",
  CARTAO_DEBITO: "Cartão de débito",
  DINHEIRO: "Dinheiro",
  OUTRO: "Outro",
};
