"use client";
import { useEffect } from "react";
import { useStore } from "@/lib/store";
import { getSocket } from "@/lib/socket";

interface TradePlacedPayload {
  marketId: number;
  updatedProbabilities: Record<string, number>;
  newVolume: number; // fresh absolute volume — safe to set directly, never double-counts
}
interface MarketSettledPayload {
  marketId: number;
  result: string;
}
interface MarketClosedPayload {
  marketId: number;
}

/**
 * Mounted once at the app root (see app/layout.tsx). Keeps the shared
 * markets store fresh from live server push — replaces the home page's old
 * 30s fetchMarkets() poll and the market detail page's old 3s apiGetMarket()
 * poll. Both pages already re-render from this same store, so patching it
 * here is all either page needs; no per-page socket code required.
 */
export default function RealtimeSync() {
  useEffect(() => {
    const socket = getSocket();

    const onTradePlaced = (payload: TradePlacedPayload) => {
      useStore.getState().patchMarket(payload.marketId, {
        probabilities: payload.updatedProbabilities,
        volume: payload.newVolume,
      });
    };

    const onMarketSettled = (payload: MarketSettledPayload) => {
      useStore.getState().patchMarket(payload.marketId, {
        status: "settled",
        result: payload.result,
      });
    };

    const onMarketClosed = (payload: MarketClosedPayload) => {
      useStore.getState().patchMarket(payload.marketId, { status: "closed" });
    };

    socket.on("trade:placed", onTradePlaced);
    socket.on("market:settled", onMarketSettled);
    socket.on("market:closed", onMarketClosed);

    return () => {
      socket.off("trade:placed", onTradePlaced);
      socket.off("market:settled", onMarketSettled);
      socket.off("market:closed", onMarketClosed);
    };
  }, []);

  return null;
}
