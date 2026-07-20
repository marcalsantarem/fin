export const formatMoney = (amountCents: number, currency = "BRL") =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(amountCents / 100);

export const toAmountCents = (value: number) => Math.round(value * 100);
