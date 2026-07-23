"use client";
// ─────────────────────────────────────────────────────────────────
// useCurrency — the single hook for all monetary display
// ─────────────────────────────────────────────────────────────────
//
// USAGE GUIDE
//
//   const { fmt, fmtUSD, toCredits, minStake, symbol, quickStakes } = useCurrency();
//
//   Displaying API values (credits from backend) in the user's chosen
//   display currency (USD/EUR/GBP):
//     fmt(trade.amount)          → "€5.00" or "$5.00" etc.
//     fmtVol(market.volume)      → "€381.5M" etc.
//
//   Displaying values that must always read as USD regardless of the
//   user's display-currency preference (e.g. platform fee, pool totals):
//     fmtUSD(settlement.platformFee)   → "$5.00"
//     fmtVolUSD(market.volume)         → "$381.5M"
//
//   Sending user input to API (convert display → credits):
//     toCredits(inputValue)      → 5.00  (send this to the API)
//
//   Checking minimums against user input (display currency):
//     if (inputValue < minStake) → show error
//
// RULE: Do NOT do arithmetic on display values.
//       Always convert to credits first, or work in credits.
// ─────────────────────────────────────────────────────────────────

import { useStore } from "./store";
import {
  DISPLAY_CURRENCIES,
  DisplayCurrency,
  DisplayCurrencyCode,
  MIN_STAKE_CREDITS,
  STARTING_BALANCE_CREDITS,
  MIN_WITHDRAWAL_CREDITS,
  fmtCredits,
  fmtVolumeCredits,
  formatDisplay,
  formatVolumeDisplay,
  creditsToDisplay,
  displayToCredits,
  getQuickStakes,
  resolveCurrencyConfig,
  CurrencyConfig,
} from "./credits";

export interface UseCurrencyResult {
  /** The active display currency config */
  dc: DisplayCurrency;
  /** dc plus startBalance/minStake resolved in the active display currency */
  cfg: CurrencyConfig;
  /**
   * Format a credit amount (from API/store) → display string, converted
   * into the user's chosen display currency (USD/EUR/GBP).
   * @param credits  Raw credit value from backend
   * @param compact  Use abbreviated format (1.5M, 7.6K, etc.)
   */
  fmt:        (credits: number, compact?: boolean) => string;
  /**
   * Format a credit amount → string, always in USD regardless of the
   * user's display-currency preference. Credits are already 1:1 USD,
   * so this never converts — use for ledger-truth figures (balance,
   * pool totals, platform fee) where showing a converted number would
   * be misleading.
   */
  fmtUSD:     (credits: number, compact?: boolean) => string;
  /**
   * Format a credit volume → compact display string, converted into
   * the user's chosen display currency.
   */
  fmtVol:     (credits: number) => string;
  /** Same as fmtVol, but always in USD. */
  fmtVolUSD:  (credits: number) => string;
  /**
   * Convert a display-currency number (user input) → credits for the API.
   * Call this ONCE at form submit — not on every render.
   */
  toCredits:  (displayAmount: number) => number;
  /**
   * Convert credits → display-currency number (for calculations).
   * Use only when you need a number, not a string.
   */
  toDisplay:  (credits: number) => number;
  /** Alias of toDisplay — kept for callers that need a "local" number. */
  toLocal:    (credits: number) => number;
  /** Minimum stake in DISPLAY currency (show this in the UI) */
  minStake:   number;
  /** Minimum withdrawal in DISPLAY currency (show this in the UI) */
  minWithdraw: number;
  /** Starting balance in DISPLAY currency (show this in the UI) */
  startBalance: number;
  /** Currency symbol e.g. "£", "$", "€" */
  symbol:     string;
  /** Quick-stake presets in DISPLAY currency */
  quickStakes: number[];
  /** Full display currency code e.g. "EUR" */
  currencyCode: DisplayCurrencyCode;
}

export function useCurrency(): UseCurrencyResult {
  const displayCurrency = useStore((s) => s.userProfile.displayCurrency) as DisplayCurrencyCode | undefined;

  // Display currency is a pure user preference, independent of region —
  // defaults to USD for everyone.
  const code: DisplayCurrencyCode = displayCurrency ?? "USD";
  const dc = DISPLAY_CURRENCIES[code] ?? DISPLAY_CURRENCIES.USD;
  const usd = DISPLAY_CURRENCIES.USD;

  return {
    dc,
    cfg:          resolveCurrencyConfig(dc),
    fmt:          (credits, compact) => fmtCredits(credits, dc, compact),
    fmtUSD:       (credits, compact) => formatDisplay(credits, usd, compact),
    fmtVol:       (credits)          => fmtVolumeCredits(credits, dc),
    fmtVolUSD:    (credits)          => formatVolumeDisplay(credits, usd),
    toCredits:    (display)          => displayToCredits(display, dc),
    toDisplay:    (credits)          => creditsToDisplay(credits, dc),
    toLocal:      (credits)          => creditsToDisplay(credits, dc),
    minStake:     creditsToDisplay(MIN_STAKE_CREDITS, dc),
    minWithdraw:  creditsToDisplay(MIN_WITHDRAWAL_CREDITS, dc),
    startBalance: creditsToDisplay(STARTING_BALANCE_CREDITS, dc),
    symbol:       dc.symbol,
    quickStakes:  getQuickStakes(dc),
    currencyCode: code,
  };
}
