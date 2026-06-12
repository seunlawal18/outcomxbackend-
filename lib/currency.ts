// ── Region / Currency System ─────────────────────────────────────

export type Region =
  | "nigeria"
  | "ghana"
  | "kenya"
  | "uk"
  | "usa"
  | "europe"
  | "southafrica"
  | "other";

export interface CurrencyConfig {
  symbol:       string;
  code:         string;
  name:         string;
  locale:       string;
  startBalance: number;  // starting demo balance in local currency
  minStake:     number;  // minimum stake ≈ $0.99 equivalent
  flag:         string;
  decimals:     number;  // decimal places to show
}

// minStake is set to the local-currency equivalent of ~$0.99 USD
// Exchange rates (approximate 2026): NGN≈1520, GHS≈15.5, KES≈130, GBP≈0.79, EUR≈0.92, ZAR≈18.5
export const REGION_CURRENCIES: Record<Region, CurrencyConfig> = {
  nigeria:     { symbol: "₦",   code: "NGN", name: "Nigerian Naira",     locale: "en-NG", startBalance: 50_000, minStake: 1_500, flag: "🇳🇬", decimals: 0 },
  ghana:       { symbol: "₵",   code: "GHS", name: "Ghanaian Cedi",      locale: "en-GH", startBalance: 1_000,  minStake: 15,    flag: "🇬🇭", decimals: 2 },
  kenya:       { symbol: "KSh", code: "KES", name: "Kenyan Shilling",    locale: "en-KE", startBalance: 10_000, minStake: 130,   flag: "🇰🇪", decimals: 0 },
  uk:          { symbol: "£",   code: "GBP", name: "British Pound",      locale: "en-GB", startBalance: 500,    minStake: 0.79,  flag: "🇬🇧", decimals: 2 },
  usa:         { symbol: "$",   code: "USD", name: "US Dollar",          locale: "en-US", startBalance: 500,    minStake: 0.99,  flag: "🇺🇸", decimals: 2 },
  europe:      { symbol: "€",   code: "EUR", name: "Euro",               locale: "de-DE", startBalance: 500,    minStake: 0.92,  flag: "🇪🇺", decimals: 2 },
  southafrica: { symbol: "R",   code: "ZAR", name: "South African Rand", locale: "en-ZA", startBalance: 5_000,  minStake: 18,    flag: "🇿🇦", decimals: 0 },
  other:       { symbol: "$",   code: "USD", name: "US Dollar",          locale: "en-US", startBalance: 500,    minStake: 0.99,  flag: "🌍",  decimals: 2 },
};

export const REGION_OPTIONS: { value: Region; label: string; flag: string }[] = [
  { value: "nigeria",     label: "Nigeria",        flag: "🇳🇬" },
  { value: "ghana",       label: "Ghana",          flag: "🇬🇭" },
  { value: "kenya",       label: "Kenya",          flag: "🇰🇪" },
  { value: "southafrica", label: "South Africa",   flag: "🇿🇦" },
  { value: "uk",          label: "United Kingdom", flag: "🇬🇧" },
  { value: "usa",         label: "United States",  flag: "🇺🇸" },
  { value: "europe",      label: "Europe",         flag: "🇪🇺" },
  { value: "other",       label: "Other",          flag: "🌍"  },
];

// Default (Nigeria)
export const DEFAULT_REGION: Region = "nigeria";
export const DEFAULT_CURRENCY = REGION_CURRENCIES[DEFAULT_REGION];

// ── Formatting helpers ───────────────────────────────────────────

export function formatCurrency(amount: number, cfg: CurrencyConfig, compact = false): string {
  const sym = cfg.symbol;
  if (compact) {
    if (amount >= 1_000_000_000) return `${sym}${(amount / 1_000_000_000).toFixed(1)}B`;
    if (amount >= 1_000_000)     return `${sym}${(amount / 1_000_000).toFixed(1)}M`;
    if (amount >= 1_000)         return `${sym}${(amount / 1_000).toFixed(0)}K`;
    return `${sym}${amount.toLocaleString(cfg.locale, { maximumFractionDigits: cfg.decimals })}`;
  }
  return `${sym}${amount.toLocaleString(cfg.locale, { minimumFractionDigits: cfg.decimals, maximumFractionDigits: cfg.decimals })}`;
}

export function formatVolumeCurrency(v: number, cfg: CurrencyConfig): string {
  const sym = cfg.symbol;
  if (v >= 1_000_000_000) return `${sym}${(v / 1_000_000_000).toFixed(1)}B Vol.`;
  if (v >= 1_000_000)     return `${sym}${(v / 1_000_000).toFixed(1)}M Vol.`;
  if (v >= 1_000)         return `${sym}${(v / 1_000).toFixed(0)}K Vol.`;
  return `${sym}${v} Vol.`;
}

// Generate 4 sensible quick-stake amounts for the trade panel
// Starts at minStake, scales up to ~10% of startBalance
export function getQuickAmounts(cfg: CurrencyConfig): number[] {
  const min = cfg.minStake;
  const max = cfg.startBalance;
  // Round to clean numbers
  const round = (n: number) => {
    if (n >= 1000) return Math.round(n / 100) * 100;
    if (n >= 100)  return Math.round(n / 10) * 10;
    if (n >= 10)   return Math.round(n);
    return Math.round(n * 100) / 100;
  };
  return [
    round(min),
    round(min * 5),
    round(min * 20),
    round(max * 0.1),
  ].filter((v, i, arr) => arr.indexOf(v) === i); // deduplicate
}

// Legacy helpers (default to Nigeria for backward compat)
export const CURRENCY_SYMBOL  = DEFAULT_CURRENCY.symbol;
export const MIN_STAKE        = DEFAULT_CURRENCY.minStake;
export const STARTING_BALANCE = DEFAULT_CURRENCY.startBalance;

export function formatNaira(amount: number, compact = false): string {
  return formatCurrency(amount, DEFAULT_CURRENCY, compact);
}

export function formatVolume(v: number): string {
  return formatVolumeCurrency(v, DEFAULT_CURRENCY);
}
