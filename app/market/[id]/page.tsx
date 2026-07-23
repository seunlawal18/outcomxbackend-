"use client";
import { use, useState, useEffect, useCallback, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useStore } from "@/lib/store";
import { Market } from "@/lib/types";
import { apiGetMarket } from "@/lib/api";
import { useCurrency } from "@/lib/useCurrency";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import MarketHeader from "@/components/market/MarketHeader";
import ProbabilityChart from "@/components/market/ProbabilityChart";
import LivePriceChart from "@/components/market/LivePriceChart";
import TradePanel from "@/components/market/TradePanel";
import RecentTrades from "@/components/market/RecentTrades";
import PositionSummary from "@/components/market/PositionSummary";
import CommentSection from "@/components/market/CommentSection";
import TopHolders from "@/components/market/TopHolders";
import Countdown from "@/components/Countdown";
import Link from "next/link";
import { Loader2, CheckCircle2, AlertCircle, ExternalLink } from "lucide-react";

// ── Multi Yes/No Outcomes ─────────────────────────────────────────
function MultiYesNoOutcomes({
  market, onSelect, selectedOption, selectedSide,
}: {
  market: Market;
  onSelect: (opt: string, side: "yes" | "no") => void;
  selectedOption: string;
  selectedSide: "yes" | "no";
}) {
  const { fmtVolUSD } = useCurrency();
  const COLORS = ["#10b981", "#ef4444", "#f59e0b", "#6366f1", "#3b82f6", "#8b5cf6"];

  return (
    <div className="card" style={{ padding: 0, overflow: "hidden" }}>
      <div style={{ padding: "13px 18px", borderBottom: "1px solid var(--border)" }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>Outcomes</h3>
      </div>
      {market.options.map((opt, i) => {
        const prob = market.probabilities[opt] ?? 0;
        const noProb = 100 - prob;
        const color = COLORS[i % COLORS.length];
        const isSelOpt = selectedOption === opt;
        return (
          <div key={opt} style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 18px", borderBottom: "1px solid var(--border)", flexWrap: "wrap", transition: "background 0.15s" }}
            onMouseEnter={e => (e.currentTarget.style.background = "var(--bg-card-hover)")}
            onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
          >
            <span style={{ width: 9, height: 9, borderRadius: "50%", background: color, flexShrink: 0 }} />
            <span style={{ flex: 1, fontSize: 14, fontWeight: 600, color: "var(--text-primary)", minWidth: 60 }}>{opt}</span>
            <span style={{ fontSize: 14, fontWeight: 800, color, fontVariantNumeric: "tabular-nums" }}>{prob}%</span>
            {market.status === "open" && (
              <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                <button onClick={() => onSelect(opt, "yes")} style={{ padding: "5px 10px", borderRadius: 7, fontSize: 12, fontWeight: 700, background: isSelOpt && selectedSide === "yes" ? "#10b981" : "rgba(16,185,129,0.15)", color: isSelOpt && selectedSide === "yes" ? "#fff" : "#10b981", border: `1px solid ${isSelOpt && selectedSide === "yes" ? "#10b981" : "rgba(16,185,129,0.4)"}`, cursor: "pointer", transition: "all 0.15s", whiteSpace: "nowrap" }}>
                  Yes {(prob / 100).toFixed(2)}¢
                </button>
                <button onClick={() => onSelect(opt, "no")} style={{ padding: "5px 10px", borderRadius: 7, fontSize: 12, fontWeight: 700, background: isSelOpt && selectedSide === "no" ? "#ef4444" : "rgba(239,68,68,0.15)", color: isSelOpt && selectedSide === "no" ? "#fff" : "#ef4444", border: `1px solid ${isSelOpt && selectedSide === "no" ? "#ef4444" : "rgba(239,68,68,0.4)"}`, cursor: "pointer", transition: "all 0.15s", whiteSpace: "nowrap" }}>
                  No {(noProb / 100).toFixed(2)}¢
                </button>
              </div>
            )}
          </div>
        );
      })}
      <div style={{ padding: "10px 18px", display: "flex", alignItems: "center", gap: 6 }}>
        <span className="live-dot" style={{ width: 6, height: 6 }} />
        <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>{fmtVolUSD(market.volume)} Vol.</span>
      </div>
    </div>
  );
}

// ── Outcomes table ────────────────────────────────────────────────
function OutcomesTable({ market, onSelect, selected }: { market: Market; onSelect: (opt: string) => void; selected: string }) {
  const COLORS = ["#10b981", "#ef4444", "#f59e0b", "#6366f1"];
  return (
    <div className="card" style={{ padding: 0, overflow: "hidden" }}>
      <div style={{ padding: "13px 18px", borderBottom: "1px solid var(--border)" }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>Outcomes</h3>
      </div>
      {market.options.map((opt, i) => {
        const prob = market.probabilities[opt] ?? 0;
        const color = COLORS[i % COLORS.length];
        const isSel = selected === opt;
        return (
          <div key={opt} style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 18px", borderBottom: "1px solid var(--border)", background: isSel ? `${color}0d` : "transparent", transition: "background 0.15s", cursor: "pointer", flexWrap: "wrap" }} onClick={() => onSelect(opt)}>
            <span style={{ width: 10, height: 10, borderRadius: "50%", background: color, flexShrink: 0 }} />
            <span style={{ flex: 1, fontSize: 14, fontWeight: isSel ? 700 : 500, color: isSel ? "var(--text-primary)" : "var(--text-secondary)", minWidth: 60 }}>{opt}</span>
            <div style={{ width: 60, height: 4, background: "var(--bg-card-hover)", borderRadius: 2, overflow: "hidden" }}>
              <div style={{ width: `${prob}%`, height: "100%", background: color, borderRadius: 2, transition: "width 0.5s ease" }} />
            </div>
            <span style={{ fontSize: 14, fontWeight: 800, color, minWidth: 36, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{prob}%</span>
            {market.status === "open" && (
              <button onClick={e => { e.stopPropagation(); onSelect(opt); }} style={{ padding: "4px 10px", borderRadius: 7, fontSize: 12, fontWeight: 700, background: isSel ? color : `${color}18`, color: isSel ? "#fff" : color, border: `1px solid ${color}50`, cursor: "pointer", transition: "all 0.15s" }}>
                {(prob / 100).toFixed(2)}¢
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Settlement Summary Card ───────────────────────────────────────
function SettlementSummaryCard({ market }: { market: Market }) {
  const { fmtUSD, fmtVolUSD } = useCurrency();
  if (market.status !== "settled" || market.platformFee == null) return null;
  return (
    <div className="card" style={{ padding: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
        <div style={{ width: 32, height: 32, borderRadius: 8, background: "var(--emerald-bg)", border: "1px solid var(--emerald-border)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <CheckCircle2 size={16} color="var(--emerald)" />
        </div>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>Settlement Summary</h3>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
        {[
          { label: "Winning Outcome", value: market.result ?? "—",                    color: "var(--emerald)", bold: true },
          { label: "Total Pool",      value: fmtUSD(market.volume),                   color: "var(--text-primary)" },
          { label: "Platform Fee",    value: `− ${fmtUSD(market.platformFee ?? 0)}`,  color: "#f59e0b" },
        ].map((row, i) => (
          <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid var(--border)" }}>
            <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>{row.label}</span>
            <span style={{ fontSize: 13, fontWeight: row.bold ? 800 : 600, color: row.color }}>{row.value}</span>
          </div>
        ))}
        <div style={{ display: "flex", justifyContent: "space-between", padding: "12px 14px", marginTop: 8, borderRadius: 10, background: "var(--emerald-bg)", border: "1px solid var(--emerald-border)" }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>Prize Pool</span>
          <span style={{ fontSize: 15, fontWeight: 800, color: "var(--emerald)" }}>{fmtUSD(market.prizePool ?? market.volume)}</span>
        </div>
      </div>
    </div>
  );
}

// ── Rules card ────────────────────────────────────────────────────
function RulesCard({ market }: { market: Market }) {
  return (
    <div className="card" style={{ padding: 18 }}>
      <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", margin: "0 0 10px" }}>Market Rules</h3>
      <p style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.7, margin: "0 0 12px" }}>
        This platform will resolve the market when the real-world outcome is confirmed. All trades are final once placed.
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {["All trades are final once placed", "Winners receive their locked payout at trade-time odds", "Market closes automatically when the timer expires", "Resolution is based on real-world events"].map((rule, i) => (
          <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
            <CheckCircle2 size={13} color="var(--emerald)" style={{ flexShrink: 0, marginTop: 1 }} />
            <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>{rule}</span>
          </div>
        ))}
      </div>
      {market.resolutionSource && (
        <div style={{ marginTop: 14, padding: "10px 14px", borderRadius: 10, background: "var(--bg-card-hover)", border: "1px solid var(--border)" }}>
          <p style={{ fontSize: 11, color: "var(--text-muted)", margin: "0 0 4px", textTransform: "uppercase", letterSpacing: "0.5px", fontWeight: 700 }}>Resolution Source</p>
          <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: 0 }}>{market.resolutionSource}</p>
        </div>
      )}
    </div>
  );
}

// ── Market Tabs ───────────────────────────────────────────────────
function MarketTabs({ market }: { market: Market }) {
  const [tab, setTab] = useState<"comments" | "holders" | "rules">("comments");
  const tabs = [
    { id: "comments" as const, label: "Comments" },
    { id: "holders"  as const, label: "Top Holders" },
    { id: "rules"    as const, label: "Rules" },
  ];
  return (
    <div>
      <div style={{ display: "flex", borderBottom: "1px solid var(--border)" }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{ flex: 1, padding: "10px 0", fontSize: 13, fontWeight: 600, background: "none", border: "none", cursor: "pointer", color: tab === t.id ? "var(--text-primary)" : "var(--text-secondary)", borderBottom: `2px solid ${tab === t.id ? "var(--emerald)" : "transparent"}`, transition: "all 0.15s" }}>
            {t.label}
          </button>
        ))}
      </div>
      <div style={{ marginTop: 16 }}>
        {tab === "comments" && <CommentSection marketId={market.id} />}
        {tab === "holders"  && <TopHolders marketId={market.id} />}
        {tab === "rules"    && <RulesCard market={market} />}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────
function MarketPageContent({ id: marketId }: { id: string }) {
  const searchParams = useSearchParams();
  const rawPick = searchParams.get("pick") || "";
  const { markets, fetchMarkets } = useStore();

  const marketFromStore = markets.find(m => m.id === parseInt(marketId));
  const [market, setMarket]       = useState<Market | null>(marketFromStore ?? null);
  const [notFound, setNotFound]   = useState(false);
  const [selectedOption, setSelectedOption] = useState(() => rawPick ? rawPick.split(":")[0] : "");
  const [selectedSide, setSelectedSide]     = useState<"yes" | "no">("yes");
  const [tradeCount, setTradeCount]         = useState(0);
  // Ref to imperatively open the mobile trade sheet from outcome table clicks
  const mobileSheetRef = useRef<{ open: (opt?: string) => void }>(null);

  const handleMultiYesNoSelect = useCallback((opt: string, side: "yes" | "no") => {
    setSelectedOption(opt);
    setSelectedSide(side);
    // On mobile, open the trade sheet
    mobileSheetRef.current?.open(opt);
  }, []);

  // Initial load
  useEffect(() => {
    if (marketFromStore) {
      setMarket(marketFromStore);
      if (!selectedOption) setSelectedOption(marketFromStore.options[0]);
      return;
    }
    apiGetMarket(parseInt(marketId)).then(res => {
      if (res.ok && res.data) {
        const m: Market = {
          id: res.data.id, title: res.data.title,
          category: res.data.category as Market["category"],
          type: res.data.type as Market["type"],
          options: res.data.options,
          status: res.data.status as Market["status"],
          result: res.data.result,
          volume: res.data.volume,
          createdAt: res.data.createdAt,
          probabilities: res.data.probabilities,
          trending: res.data.trending,
          duration: res.data.duration as Market["duration"],
          expiresAt: res.data.expiresAt,
          image: res.data.image ?? undefined,
          banner: res.data.banner ?? undefined,
          resolutionSource: res.data.resolutionSource ?? undefined,
          platformFee: res.data.platformFee ?? null,
          prizePool: res.data.prizePool ?? null,
          priceAssetId: res.data.priceAssetId ?? null,
          priceAssetSymbol: res.data.priceAssetSymbol ?? null,
          openingPrice: res.data.openingPrice ?? null,
        };
        setMarket(m);
        setSelectedOption(m.options[0]);
      } else {
        fetchMarkets().then(() => {
          const found = useStore.getState().markets.find(m => m.id === parseInt(marketId));
          if (found) { setMarket(found); setSelectedOption(found.options[0]); }
          else setNotFound(true);
        });
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [marketId]);

  // Sync with store
  useEffect(() => {
    const updated = markets.find(m => m.id === parseInt(marketId));
    if (updated) setMarket(updated);
  }, [markets, marketId]);

  const handleTradeSuccess = useCallback(() => setTradeCount(c => c + 1), []);

  // Real-time updates (probabilities, volume, status, result) now arrive via
  // RealtimeSync patching the shared store — see the "Sync with store"
  // effect above — instead of this page polling apiGetMarket every 3s.

  if (!market && !notFound) {
    return (
      <div style={{ minHeight: "100vh", background: "var(--bg-primary)" }}>
        <Navbar />
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "100px 20px", gap: 16 }}>
          <Loader2 size={36} color="var(--emerald)" style={{ animation: "spin 1s linear infinite" }} />
          <p style={{ fontSize: 15, color: "var(--text-secondary)", margin: 0 }}>Loading market…</p>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      </div>
    );
  }

  if (notFound || !market) {
    return (
      <div style={{ minHeight: "100vh", background: "var(--bg-primary)" }}>
        <Navbar />
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "100px 20px", gap: 16 }}>
          <AlertCircle size={40} color="var(--red)" />
          <h2 style={{ fontSize: 20, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>Market not found</h2>
          <Link href="/" style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "10px 20px", borderRadius: 10, background: "var(--emerald)", color: "#fff", textDecoration: "none", fontSize: 14, fontWeight: 700 }}>
            <ExternalLink size={14} /> Browse Markets
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-primary)", display: "flex", flexDirection: "column" }}>
      <Navbar />

      <main style={{ flex: 1, maxWidth: 1240, margin: "0 auto", width: "100%", padding: "20px 16px 48px" }}>
        <MarketHeader market={market} />

        {/*
          Desktop layout (two columns):
          Left: chart, outcomes, countdown, settlement, trades, tabs
          Right: trade panel (sticky), position summary

          Mobile layout (single column):
          1. MarketHeader (already above)
          2. Chart / Outcomes
          3. Outcomes table
          4. Countdown / Settlement
          5. Recent trades + Tabs
          6. Sticky bottom trade bar
        */}
        <div className="market-detail-grid">

          {/* ── LEFT COLUMN (desktop) / MAIN (mobile) ── */}
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>

            {/* MULTI_YESNO: outcomes list instead of chart */}
            {market.type === "MULTI_YESNO" ? (
              <MultiYesNoOutcomes
                market={market}
                selectedOption={selectedOption}
                selectedSide={selectedSide}
                onSelect={handleMultiYesNoSelect}
              />
            ) : (
              <>
                {/* No key prop — chart stays alive and pushes new points on prob changes */}
                {market.priceAssetId && market.openingPrice != null ? (
                  <LivePriceChart
                    marketId={market.id}
                    openingPrice={market.openingPrice}
                    assetSymbol={market.priceAssetSymbol ?? market.priceAssetId.toUpperCase()}
                    expiresAt={market.expiresAt}
                    duration={market.duration}
                  />
                ) : (
                  <ProbabilityChart
                    marketId={market.id}
                    options={market.options}
                    probabilities={market.probabilities}
                  />
                )}
                <OutcomesTable
                  market={market}
                  selected={selectedOption}
                  onSelect={(opt) => {
                    setSelectedOption(opt);
                    // On mobile, selecting an outcome opens the trade sheet
                    mobileSheetRef.current?.open(opt);
                  }}
                />
              </>
            )}

            {market.status === "open" && (
              <Countdown expiresAt={market.expiresAt} duration={market.duration} />
            )}

            <SettlementSummaryCard market={market} />
            <RecentTrades marketId={market.id} key={`trades-${tradeCount}`} />
            <MarketTabs market={market} />

            {/* Extra bottom padding on mobile so sticky bar doesn't cover content */}
            <div className="mobile-bottom-spacer" />
          </div>

          {/* ── RIGHT COLUMN (desktop only) ── */}
          <div className="trade-panel-col">
            <div className="trade-panel-sticky" style={{ position: "sticky", top: 80 }}>
              <TradePanel
                market={market}
                preSelected={selectedOption}
                preSelectedSide={market.type === "MULTI_YESNO" ? selectedSide : undefined}
                onTradeSuccess={handleTradeSuccess}
              />
              <div style={{ marginTop: 16 }}>
                <PositionSummary market={market} />
              </div>
            </div>
          </div>
        </div>

        {/* ── MOBILE STICKY BOTTOM TRADE BAR ── */}
        {market.status === "open" && (
          <div className="mobile-trade-bar">
            <TradePanel
              market={market}
              preSelected={selectedOption}
              preSelectedSide={market.type === "MULTI_YESNO" ? selectedSide : undefined}
              onTradeSuccess={handleTradeSuccess}
              isMobile
              sheetRef={mobileSheetRef}
            />
          </div>
        )}
      </main>

      <Footer />

      <style>{`
        /* Mobile: single column, chart first, sticky trade bar at bottom */
        @media (max-width: 900px) {
          .market-detail-grid {
            display: flex !important;
            flex-direction: column !important;
            /* globals.css sets align-items:start for the desktop grid's
               vertical alignment — in a column flex layout that property
               instead controls horizontal stretch, which was shrinking the
               column to its narrowest child's width instead of filling the
               screen. Reset it back to full-width stretch here. */
            align-items: stretch !important;
          }
          /* Hide the desktop right-column trade panel on mobile */
          .trade-panel-col {
            display: none !important;
          }
          /* Sticky bottom trade bar */
          .mobile-trade-bar {
            position: fixed;
            bottom: 0; left: 0; right: 0;
            z-index: 50;
            background: var(--bg-card);
            border-top: 1px solid var(--border);
            box-shadow: 0 -4px 24px rgba(0,0,0,0.4);
          }
          /* Space so the sticky bar doesn't overlap last content */
          .mobile-bottom-spacer {
            height: 80px;
          }
        }
        /* Desktop: hide mobile-only bar */
        @media (min-width: 901px) {
          .mobile-trade-bar { display: none !important; }
          .mobile-bottom-spacer { display: none !important; }
          .trade-panel-sticky { position: sticky !important; top: 80px; }
        }
      `}</style>
    </div>
  );
}

export default function MarketPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <Suspense fallback={
      <div style={{ minHeight: "100vh", background: "var(--bg-primary)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Loader2 size={32} color="var(--emerald)" style={{ animation: "spin 1s linear infinite" }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    }>
      <MarketPageContent id={id} />
    </Suspense>
  );
}
