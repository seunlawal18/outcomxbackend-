"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Market } from "@/lib/types";
import { Bookmark, Activity } from "lucide-react";
import Countdown from "./Countdown";
import { useCurrency } from "@/lib/useCurrency";
import { useStore } from "@/lib/store";
import { getCategoryIcon } from "@/lib/categoryIcons";
import LoginRequiredModal from "./LoginRequiredModal";

interface Props { market: Market; }

// ── Circular probability gauge (for binary markets) ───────────────
function ChanceGauge({ percent, color = "var(--emerald)" }: { percent: number; color?: string }) {
  const r = 24, circ = 2 * Math.PI * r, dash = (percent / 100) * circ;
  return (
    <div style={{ position: "relative", width: 60, height: 60, flexShrink: 0 }}>
      <svg width="60" height="60" style={{ transform: "rotate(-90deg)" }}>
        <circle cx="30" cy="30" r={r} fill="none" stroke="var(--bg-card-hover)" strokeWidth="5" />
        <circle cx="30" cy="30" r={r} fill="none" stroke={color} strokeWidth="5"
          strokeDasharray={`${dash} ${circ}`} strokeLinecap="round" />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        <span style={{ fontSize: 12, fontWeight: 800, color: "var(--text-primary)", lineHeight: 1 }}>{percent}%</span>
        <span style={{ fontSize: 8, color: "var(--text-secondary)", marginTop: 1 }}>chance</span>
      </div>
    </div>
  );
}

// Colors for multi-outcome options
const OPTION_COLORS = ["#10b981", "#ef4444", "#f59e0b", "#6366f1", "#3b82f6", "#8b5cf6", "#ec4899", "#14b8a6"];

function getOptionColor(opt: string, idx: number): string {
  // Semantic colors for common options
  if (opt === "Yes" || opt === "Up")   return "#10b981";
  if (opt === "No"  || opt === "Down") return "#ef4444";
  if (opt === "Draw")                  return "#f59e0b";
  return OPTION_COLORS[idx % OPTION_COLORS.length];
}

export default function MarketCard({ market }: Props) {
  const router = useRouter();
  const { fmtVol } = useCurrency();
  const { isLoggedIn } = useStore();
  const [showLoginModal, setShowLoginModal] = useState(false);
  const CategoryIcon = getCategoryIcon(market.category);

  const goToMarket = (option?: string) => {
    if (option && !isLoggedIn) { setShowLoginModal(true); return; }
    router.push(option
      ? `/market/${market.id}?pick=${encodeURIComponent(option)}`
      : `/market/${market.id}`
    );
  };

  const isBinary = market.type === "YES_NO" || market.type === "UP_DOWN";
  const isMulti  = market.type === "MULTI" || market.type === "MULTI_YESNO";
  const showYesNo = market.type === "MULTI_YESNO" || market.type === "MULTI";

  // For binary markets show the first option's probability in the gauge
  const primaryProb = isBinary ? (market.probabilities[market.options[0]] ?? 50) : null;
  const primaryColor = isBinary ? getOptionColor(market.options[0], 0) : "var(--emerald)";

  // Settled result badge
  const isSettled = market.status === "settled";
  const isClosed  = market.status === "closed";

  return (
    <>
      {showLoginModal && <LoginRequiredModal onClose={() => setShowLoginModal(false)} />}

      <div
        className="card"
        style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12, cursor: "pointer", position: "relative" }}
        onClick={() => goToMarket()}
      >
        {/* ── Header ── */}
        <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
          {/* Icon / image */}
          {market.image ? (
            <img src={market.image} alt={market.title} style={{ width: 40, height: 40, borderRadius: 9, flexShrink: 0, objectFit: "cover", border: "1px solid var(--border)" }} />
          ) : (
            <div style={{ width: 40, height: 40, borderRadius: 9, flexShrink: 0, background: "var(--bg-card-hover)", display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid var(--border)" }}>
              <CategoryIcon size={18} color="var(--text-secondary)" />
            </div>
          )}

          {/* Title + gauge */}
          <div style={{ flex: 1, display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, minWidth: 0 }}>
            <h3 className="truncate-2" style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", lineHeight: 1.45, margin: 0 }}>
              {market.title}
            </h3>
            {isBinary && primaryProb !== null && (
              <ChanceGauge percent={primaryProb} color={primaryColor} />
            )}
          </div>
        </div>

        {/* ── Outcome buttons — fully dynamic from backend data ── */}
        {isBinary ? (
          // YES/NO or UP/DOWN — two buttons
          <div style={{ display: "flex", gap: 8 }}>
            {market.options.map((opt, idx) => {
              const prob  = market.probabilities[opt] ?? 50;
              const color = getOptionColor(opt, idx);
              const isFirst = idx === 0;
              return (
                <button
                  key={opt}
                  onClick={e => { e.stopPropagation(); goToMarket(opt); }}
                  disabled={!isLoggedIn || market.status !== "open"}
                  style={{
                    flex: 1, padding: "9px 0", borderRadius: 8,
                    fontSize: 13, fontWeight: 700,
                    background: `${color}18`,
                    color,
                    border: `1px solid ${color}50`,
                    cursor: isLoggedIn && market.status === "open" ? "pointer" : "not-allowed",
                    opacity: market.status !== "open" ? 0.5 : 1,
                    transition: "all 0.15s",
                    display: "flex", flexDirection: "column", alignItems: "center", gap: 1,
                  }}
                  onMouseEnter={e => { if (isLoggedIn && market.status === "open") { (e.currentTarget as HTMLElement).style.background = color; (e.currentTarget as HTMLElement).style.color = "#fff"; } }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = `${color}18`; (e.currentTarget as HTMLElement).style.color = color; }}
                >
                  <span>{opt}</span>
                  <span style={{ fontSize: 11, opacity: 0.8 }}>{prob}%</span>
                </button>
              );
            })}
          </div>
        ) : (
          // MULTI — list each outcome with probability + Yes/No buttons (Polymarket style)
          <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
            {market.options.map((opt, idx) => {
              const prob    = market.probabilities[opt] ?? 0;
              const color   = getOptionColor(opt, idx);
              // MULTI_YESNO markets can resolve with zero or multiple
              // outcomes marked Yes (voided match, non-exclusive outcomes),
              // so market.result may be a comma-joined list, not a single
              // exact match — this still works correctly for plain MULTI
              // markets, where result is always a single value.
              const resultWinners = market.result ? market.result.split(", ") : [];
              const isWinner = isSettled && resultWinners.includes(opt);

              return (
                <div key={opt} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {/* Color dot */}
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: color, flexShrink: 0 }} />

                  {/* Option name */}
                  <span style={{ flex: 1, fontSize: 13, color: isWinner ? color : "var(--text-primary)", fontWeight: isWinner ? 700 : 500, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {opt}
                    {isWinner && <span style={{ marginLeft: 5, fontSize: 10, background: `${color}20`, color, padding: "1px 5px", borderRadius: 10, border: `1px solid ${color}40` }}>✓ Won</span>}
                  </span>

                  {/* Probability */}
                  <span style={{ fontSize: 13, fontWeight: 700, color, minWidth: 34, textAlign: "right" }}>{prob}%</span>

                  {/* Trade button — single for MULTI, Yes/No for MULTI_YESNO */}
                  {market.status === "open" && (
                    market.type === "MULTI_YESNO" ? (
                      <div style={{ display: "flex", gap: 5, flexShrink: 0 }}>
                        <button
                          onClick={e => { e.stopPropagation(); goToMarket(opt); }}
                          style={{
                            padding: "3px 10px", borderRadius: 6, fontSize: 12, fontWeight: 700,
                            background: "rgba(16,185,129,0.2)", color: "#10b981",
                            border: "1px solid rgba(16,185,129,0.4)",
                            cursor: isLoggedIn ? "pointer" : "not-allowed",
                            opacity: isLoggedIn ? 1 : 0.6,
                            transition: "all 0.15s", minWidth: 38, textAlign: "center",
                          }}
                          onMouseEnter={e => {
                            if (!isLoggedIn) return;
                            (e.currentTarget as HTMLElement).style.background = "#10b981";
                            (e.currentTarget as HTMLElement).style.color = "#fff";
                            (e.currentTarget as HTMLElement).textContent = `${prob}%`;
                          }}
                          onMouseLeave={e => {
                            (e.currentTarget as HTMLElement).style.background = "rgba(16,185,129,0.2)";
                            (e.currentTarget as HTMLElement).style.color = "#10b981";
                            (e.currentTarget as HTMLElement).textContent = "Yes";
                          }}
                        >
                          Yes
                        </button>
                        <button
                          onClick={e => { e.stopPropagation(); goToMarket(opt); }}
                          style={{
                            padding: "3px 10px", borderRadius: 6, fontSize: 12, fontWeight: 700,
                            background: "rgba(239,68,68,0.2)", color: "#ef4444",
                            border: "1px solid rgba(239,68,68,0.4)",
                            cursor: isLoggedIn ? "pointer" : "not-allowed",
                            opacity: isLoggedIn ? 1 : 0.6,
                            transition: "all 0.15s", minWidth: 38, textAlign: "center",
                          }}
                          onMouseEnter={e => {
                            if (!isLoggedIn) return;
                            (e.currentTarget as HTMLElement).style.background = "#ef4444";
                            (e.currentTarget as HTMLElement).style.color = "#fff";
                            (e.currentTarget as HTMLElement).textContent = `${100 - prob}%`;
                          }}
                          onMouseLeave={e => {
                            (e.currentTarget as HTMLElement).style.background = "rgba(239,68,68,0.2)";
                            (e.currentTarget as HTMLElement).style.color = "#ef4444";
                            (e.currentTarget as HTMLElement).textContent = "No";
                          }}
                        >
                          No
                        </button>
                      </div>
                    ) : (
                      // Regular MULTI — single trade button
                      <button
                        onClick={e => { e.stopPropagation(); goToMarket(opt); }}
                        style={{
                          padding: "3px 12px", borderRadius: 6, fontSize: 12, fontWeight: 700,
                          background: `${color}18`, color,
                          border: `1px solid ${color}50`,
                          cursor: isLoggedIn ? "pointer" : "not-allowed",
                          opacity: isLoggedIn ? 1 : 0.6,
                          transition: "all 0.15s", flexShrink: 0,
                        }}
                        onMouseEnter={e => { if (isLoggedIn) { (e.currentTarget as HTMLElement).style.background = color; (e.currentTarget as HTMLElement).style.color = "#fff"; } }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = `${color}18`; (e.currentTarget as HTMLElement).style.color = color; }}
                      >
                        Trade
                      </button>
                    )
                  )}
                </div>
              );
            })}

            {/* Probability bar */}
            <div style={{ display: "flex", height: 4, borderRadius: 2, overflow: "hidden", gap: 1, marginTop: 2 }}>
              {market.options.map((opt, idx) => {
                const prob  = market.probabilities[opt] ?? 0;
                const color = getOptionColor(opt, idx);
                return (
                  <div key={opt} style={{ width: `${prob}%`, height: "100%", background: color, transition: "width 0.4s ease" }} />
                );
              })}
            </div>
          </div>
        )}

        {/* ── Footer ── */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 8, borderTop: "1px solid var(--border)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            {/* Live dot */}
            {market.status === "open" && <span className="live-dot" />}

            {/* Status badge for closed/settled */}
            {(isClosed || isSettled) && (
              <span style={{
                fontSize: 10, fontWeight: 700, padding: "1px 7px", borderRadius: 20,
                textTransform: "uppercase", letterSpacing: "0.4px",
                background: isSettled ? "rgba(100,116,139,0.12)" : "var(--red-bg)",
                color: isSettled ? "var(--text-secondary)" : "var(--red)",
                border: `1px solid ${isSettled ? "rgba(100,116,139,0.25)" : "var(--red-border)"}`,
              }}>
                {market.status}
              </span>
            )}

            {/* Volume */}
            <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>
              {fmtVol(market.volume)} Vol.
            </span>

            {/* Countdown */}
            {market.status === "open" && (
              <Countdown expiresAt={market.expiresAt} duration={market.duration} compact />
            )}
          </div>

          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {market.trending && (
              <span style={{ fontSize: 10, fontWeight: 700, color: "#f59e0b", background: "rgba(245,158,11,0.1)", padding: "1px 6px", borderRadius: 10, border: "1px solid rgba(245,158,11,0.3)" }}>
                🔥 HOT
              </span>
            )}
            <Bookmark size={13} color="var(--text-muted)" />
          </div>
        </div>
      </div>
    </>
  );
}
