import { z } from "zod";

export const TIMEZONES = [
  "America/Sao_Paulo",
  "America/Manaus",
  "America/Rio_Branco",
  "America/Noronha",
  "America/New_York",
  "Europe/Lisbon",
  "Europe/London",
] as const;

export const TIMEZONE_LABELS: Record<(typeof TIMEZONES)[number], string> = {
  "America/Sao_Paulo": "Brasília (GMT-3)",
  "America/Manaus": "Manaus (GMT-4)",
  "America/Rio_Branco": "Rio Branco (GMT-5)",
  "America/Noronha": "Fernando de Noronha (GMT-2)",
  "America/New_York": "Nova York (GMT-5/-4)",
  "Europe/Lisbon": "Lisboa (GMT+0/+1)",
  "Europe/London": "Londres (GMT+0/+1)",
};

export const CURRENCIES = ["BRL", "USD", "EUR", "GBP"] as const;

export const CURRENCY_LABELS: Record<(typeof CURRENCIES)[number], string> = {
  BRL: "Real brasileiro (R$)",
  USD: "Dólar americano (US$)",
  EUR: "Euro (€)",
  GBP: "Libra esterlina (£)",
};

export const LOCALES = ["pt-BR", "en-US", "es-ES"] as const;

export const LOCALE_LABELS: Record<(typeof LOCALES)[number], string> = {
  "pt-BR": "Português (Brasil)",
  "en-US": "English (US)",
  "es-ES": "Español",
};

export const organizationSettingsSchema = z.object({
  name: z.string().trim().min(1, "Informe o nome da organização."),
  timezone: z.enum(TIMEZONES, { error: "Selecione um fuso horário." }),
  currency: z.enum(CURRENCIES, { error: "Selecione uma moeda." }),
  locale: z.enum(LOCALES, { error: "Selecione um idioma." }),
});
