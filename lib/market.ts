export type MarketCode = "GB" | "US";
export type SupportedLocale = "en-GB" | "en-US";
export type SupportedCurrency = "GBP" | "USD";

export type WorkspaceMarketSettings = {
  market: MarketCode;
  countryCode: MarketCode;
  locale: SupportedLocale;
  currency: SupportedCurrency;
  timezone: string;
  taxRegistrationStatus: "registered" | "not_registered" | "pending";
  pricesIncludeTax: boolean;
};

export const MARKET_PRESETS: Record<MarketCode, WorkspaceMarketSettings> = {
  GB: {
    market: "GB",
    countryCode: "GB",
    locale: "en-GB",
    currency: "GBP",
    timezone: "Europe/London",
    taxRegistrationStatus: "registered",
    pricesIncludeTax: false,
  },
  US: {
    market: "US",
    countryCode: "US",
    locale: "en-US",
    currency: "USD",
    timezone: "America/New_York",
    taxRegistrationStatus: "registered",
    pricesIncludeTax: false,
  },
};

export function localeForCurrency(currency: string): SupportedLocale {
  return currency.toUpperCase() === "USD" ? "en-US" : "en-GB";
}

export function marketForCountry(countryCode: string): MarketCode {
  return countryCode.toUpperCase() === "US" ? "US" : "GB";
}

export function normaliseMarketSettings(input: { market?: unknown; countryCode?: unknown; locale?: unknown; currency?: unknown; timezone?: unknown; taxRegistrationStatus?: unknown; pricesIncludeTax?: unknown }): WorkspaceMarketSettings {
  const market = marketForCountry(String(input.market ?? input.countryCode ?? "GB"));
  const preset = MARKET_PRESETS[market];
  const timezone = validTimezone(input.timezone) ? String(input.timezone) : preset.timezone;
  const taxRegistrationStatus = ["registered", "not_registered", "pending"].includes(String(input.taxRegistrationStatus))
    ? input.taxRegistrationStatus as WorkspaceMarketSettings["taxRegistrationStatus"]
    : preset.taxRegistrationStatus;
  return {
    market,
    countryCode: market,
    locale: market === "US" ? "en-US" : "en-GB",
    currency: market === "US" ? "USD" : "GBP",
    timezone,
    taxRegistrationStatus,
    pricesIncludeTax: input.pricesIncludeTax === true,
  };
}

export function validTimezone(value: unknown): value is string {
  if (typeof value !== "string" || value.length > 80) return false;
  try {
    new Intl.DateTimeFormat("en", { timeZone: value }).format(new Date(0));
    return true;
  } catch {
    return false;
  }
}

export function formatMoney(valueMinor: number, currency = "GBP", locale = localeForCurrency(currency)) {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: currency.toUpperCase(),
    minimumFractionDigits: valueMinor % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(valueMinor / 100);
}

function parsedDate(value: string | Date): Date {
  if (value instanceof Date) return value;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return new Date(`${value}T12:00:00Z`);
  return new Date(value.includes("T") ? value : `${value.replace(" ", "T")}Z`);
}

export function formatDate(
  value: string | Date,
  locale: string,
  timezone: string,
  options: Intl.DateTimeFormatOptions = { day: "numeric", month: "long", year: "numeric" },
) {
  const date = parsedDate(value);
  return Number.isNaN(date.getTime()) ? String(value) : new Intl.DateTimeFormat(locale, { ...options, timeZone: timezone }).format(date);
}

export function formatDateTime(value: string | Date, locale: string, timezone: string) {
  return formatDate(value, locale, timezone, { dateStyle: "medium", timeStyle: "short" });
}

