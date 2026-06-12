"use client";
import { useStore } from "./store";
import {
  REGION_CURRENCIES, DEFAULT_REGION, CurrencyConfig, Region,
  formatCurrency, formatVolumeCurrency, getQuickAmounts,
} from "./currency";

export function useCurrency(): {
  cfg:          CurrencyConfig;
  fmt:          (amount: number, compact?: boolean) => string;
  fmtVol:       (v: number) => string;
  minStake:     number;
  symbol:       string;
  quickAmounts: number[];
} {
  const region = useStore((s) => s.userProfile.region) as Region;
  const cfg    = REGION_CURRENCIES[region] ?? REGION_CURRENCIES[DEFAULT_REGION];

  return {
    cfg,
    fmt:          (amount, compact) => formatCurrency(amount, cfg, compact),
    fmtVol:       (v)               => formatVolumeCurrency(v, cfg),
    minStake:     cfg.minStake,
    symbol:       cfg.symbol,
    quickAmounts: getQuickAmounts(cfg),
  };
}
