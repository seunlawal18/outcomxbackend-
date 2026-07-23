// ═══════════════════════════════════════════════════════════════════
// OUTCOMX — Credit System
// ═══════════════════════════════════════════════════════════════════
//
// ARCHITECTURE
// ─────────────────────────────────────────────────────────────────
//  • The backend ledger stores all monetary values as "credits"
//    (neutral internal units). Today 1 credit = 1 USD, but the
//    base currency can be changed in one place (BASE_CREDIT_CURRENCY)
//    without touching any trade logic or database.
//
//  • THE ONE RULE:
//      Math always happens in credits.
//      Conversion to/from a display currency happens ONLY at:
//        1. The display boundary  → creditsToDisplay()
//        2. The input boundary    → inputToCredits()
//      Nowhere else. Never do arithmetic on display values.
//
//  • Adding a new currency:   add one entry to DISPLAY_CURRENCIES.
//  • Changing the base unit:  change BASE_CREDIT_CURRENCY + update
//                             rateToBase for every existing entry.
//  • Adding deposit methods:  handled separately in payment layer —
//                             this file is display-only.
//
// ═══════════════════════════════════════════════════════════════════

// ── Base currency ─────────────────────────────────────────────────
// The currency that 1 credit equals today.
// Change this string + update rateToBase values when switching.
export const BASE_CREDIT_CURRENCY = "USD" as const;

// ── Minimum credits per trade (≈ $0.99 USD) ──────────────────────
// Stored and validated in credits on the backend.
// The frontend converts this to display currency for the UI label.
export const MIN_STAKE_CREDITS = 0.99;

// ── Starting balance in credits ───────────────────────────────────
// New accounts start at $0 — funds must be deposited before trading.
export const STARTING_BALANCE_CREDITS = 0;

// ── Minimum withdrawal in credits ─────────────────────────────────
// Matches MIN_WITHDRAWAL_USD in the backend's withdrawalService.ts —
// keep these two in sync if either changes.
export const MIN_WITHDRAWAL_CREDITS = 10;

// ─────────────────────────────────────────────────────────────────
// Display currency registry
// ─────────────────────────────────────────────────────────────────
// rateToBase: how many credits (base units) equal 1 unit of this
//             display currency.
// Example: EUR rateToBase = 0.92 means 1 EUR = 1/0.92 credits,
//          so 1 credit = 0.92 EUR when displaying.
//
// To update rates: change rateToBase only. Nothing else changes.
// The ledger itself is always USD — this registry only affects display.
// ─────────────────────────────────────────────────────────────────

export type DisplayCurrencyCode = "USD" | "EUR" | "GBP";

export interface DisplayCurrency {
  code:       DisplayCurrencyCode;
  name:       string;
  symbol:     string;
  locale:     string;
  decimals:   number;
  flag:       string;
  /** How many display-currency units equal 1 credit (base unit) */
  rateToBase: number;
}

// Exchange rates vs USD (approximate 2026).
// Update these values periodically — nothing else in the app changes.
export const DISPLAY_CURRENCIES: Record<DisplayCurrencyCode, DisplayCurrency> = {
  USD: { code: "USD", name: "US Dollar",     symbol: "$", locale: "en-US", decimals: 2, flag: "🇺🇸", rateToBase: 1    },
  EUR: { code: "EUR", name: "Euro",          symbol: "€", locale: "de-DE", decimals: 2, flag: "🇪🇺", rateToBase: 0.92 },
  GBP: { code: "GBP", name: "British Pound", symbol: "£", locale: "en-GB", decimals: 2, flag: "🇬🇧", rateToBase: 0.79 },
};

export const DEFAULT_DISPLAY_CURRENCY = DISPLAY_CURRENCIES.USD;

// ── Region ─────────────────────────────────────────────────────────
// Locale/profile metadata only — does NOT drive currency or any money
// calculation. The ledger is a single global USD balance for everyone;
// display currency is a separate, independent user preference (see
// DisplayCurrencyCode above).
export type Region =
  | "nigeria" | "ghana" | "kenya" | "southafrica"
  | "uk" | "usa" | "europe" | "other";

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

export const DEFAULT_REGION: Region = "nigeria";

// ─────────────────────────────────────────────────────────────────
// Conversion — ONLY call these at display/input boundaries
// ─────────────────────────────────────────────────────────────────

/**
 * credits → display-currency number (for rendering)
 * Example: 5 credits, NGN → 7600
 */
export function creditsToDisplay(credits: number, dc: DisplayCurrency): number {
  return credits * dc.rateToBase;
}

/**
 * display-currency number → credits (for sending to API)
 * Example: 7600 NGN → 5 credits
 */
export function displayToCredits(displayAmount: number, dc: DisplayCurrency): number {
  return displayAmount / dc.rateToBase;
}

// ─────────────────────────────────────────────────────────────────
// Formatting helpers (display boundary only)
// ─────────────────────────────────────────────────────────────────

/**
 * Format a display-currency amount as a human-readable string.
 * Pass the already-converted display amount, not raw credits.
 */
export function formatDisplay(amount: number, dc: DisplayCurrency, compact = false): string {
  const sym = dc.symbol;
  if (compact) {
    if (amount >= 1_000_000_000) return `${sym}${(amount / 1_000_000_000).toFixed(1)}B`;
    if (amount >= 1_000_000)     return `${sym}${(amount / 1_000_000).toFixed(1)}M`;
    if (amount >= 1_000)         return `${sym}${(amount / 1_000).toFixed(1)}K`;
    return `${sym}${amount.toLocaleString(dc.locale, { maximumFractionDigits: dc.decimals })}`;
  }
  return `${sym}${amount.toLocaleString(dc.locale, {
    minimumFractionDigits: dc.decimals,
    maximumFractionDigits: dc.decimals,
  })}`;
}

/**
 * Format a volume in display currency with Vol. suffix.
 */
export function formatVolumeDisplay(amount: number, dc: DisplayCurrency): string {
  const sym = dc.symbol;
  if (amount >= 1_000_000_000) return `${sym}${(amount / 1_000_000_000).toFixed(1)}B`;
  if (amount >= 1_000_000)     return `${sym}${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000)         return `${sym}${(amount / 1_000).toFixed(1)}K`;
  return `${sym}${amount.toLocaleString(dc.locale, { maximumFractionDigits: dc.decimals })}`;
}

/**
 * Convert credits → display currency → formatted string.
 * This is the main utility used by useCurrency hook.
 */
export function fmtCredits(credits: number, dc: DisplayCurrency, compact = false): string {
  return formatDisplay(creditsToDisplay(credits, dc), dc, compact);
}

export function fmtVolumeCredits(credits: number, dc: DisplayCurrency): string {
  return formatVolumeDisplay(creditsToDisplay(credits, dc), dc);
}

// Fixed USD quick-stake presets — independent of starting balance (which is
// $0 for every account), so these always yield sensible non-zero options.
const QUICK_STAKE_USD_PRESETS = [5, 20, 50, 100];

/**
 * Generate quick-stake amounts in display currency, rounded to clean numbers.
 */
export function getQuickStakes(dc: DisplayCurrency): number[] {
  const round = (n: number): number => {
    if (n >= 10_000) return Math.round(n / 1_000) * 1_000;
    if (n >= 1_000)  return Math.round(n / 100) * 100;
    if (n >= 100)    return Math.round(n / 10) * 10;
    if (n >= 10)     return Math.round(n);
    return Math.round(n * 100) / 100;
  };

  return QUICK_STAKE_USD_PRESETS
    .map((usd) => round(creditsToDisplay(usd, dc)))
    .filter((v, i, arr) => arr.indexOf(v) === i && v > 0);
}

// ── Resolved currency config ───────────────────────────────────────
// DisplayCurrency plus the app's money constants expressed in that
// currency — used by the profile/register screens that need starting
// balance / min stake alongside the symbol/locale/flag.
export type CurrencyConfig = DisplayCurrency & {
  startBalance: number;
  minStake:     number;
};

export function resolveCurrencyConfig(dc: DisplayCurrency): CurrencyConfig {
  return {
    ...dc,
    startBalance: Math.round(creditsToDisplay(STARTING_BALANCE_CREDITS, dc)),
    minStake:     Math.round(creditsToDisplay(MIN_STAKE_CREDITS, dc) * 100) / 100,
  };
}
