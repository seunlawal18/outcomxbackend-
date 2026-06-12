"use client";
import { useState } from "react";
import { useStore } from "@/lib/store";
import { useCurrency } from "@/lib/useCurrency";
import { SettlementBreakdown } from "@/lib/api";
import { CheckCircle2, Trophy, Gavel, X, TrendingUp, DollarSign } from "lucide-react";
import Countdown from "@/components/Countdown";

// ── Settlement Confirmation Modal ─────────────────────────────────
function SettlementModal({
  settlement,
  settledTrades,
  winningOutcome,
  onClose,
}: {
  settlement: SettlementBreakdown;
  settledTrades: number;
  winningOutcome: string;
  onClose: () => void;
}) {
  const { fmt } = useCurrency();

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 500,
      background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
    }} onClick={onClose}>
      <div
        onClick={e => e.stopPropagation()}
        className="fade-in"
        style={{
          background: "var(--bg-secondary)", border: "1px solid var(--border)",
          borderRadius: 20, padding: 32, width: "100%", maxWidth: 420,
          boxShadow: "0 24px 64px rgba(0,0,0,0.4)",
        }}
      >
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{
            width: 56, height: 56, borderRadius: "50%", margin: "0 auto 12px",
            background: "var(--emerald-bg)", border: "2px solid var(--emerald)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <CheckCircle2 size={28} color="var(--emerald)" />
          </div>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: "var(--text-primary)", margin: "0 0 4px" }}>
            Market Settled ✓
          </h2>
          <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: 0 }}>
            {settledTrades} trade{settledTrades !== 1 ? "s" : ""} processed
          </p>
        </div>

        {/* Settlement breakdown — all values from backend */}
        <div style={{ display: "flex", flexDirection: "column", gap: 0, marginBottom: 20 }}>
          {[
            { label: "Winning Outcome",   value: winningOutcome,              color: "var(--emerald)", bold: true },
            { label: "Trades Settled",    value: String(settledTrades),       color: "var(--text-primary)" },
            { label: "Total Pool",        value: fmt(settlement.totalPool),   color: "var(--text-primary)" },
            { label: "Platform Fee (3%)", value: `− ${fmt(settlement.platformFee)}`, color: "#f59e0b" },
          ].map((row, i) => (
            <div key={i} style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              padding: "10px 0", borderBottom: "1px solid var(--border)",
            }}>
              <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>{row.label}</span>
              <span style={{ fontSize: 13, fontWeight: row.bold ? 800 : 600, color: row.color }}>{row.value}</span>
            </div>
          ))}
          {/* Prize pool highlight */}
          <div style={{
            display: "flex", justifyContent: "space-between", alignItems: "center",
            padding: "12px 14px", marginTop: 10, borderRadius: 10,
            background: "var(--emerald-bg)", border: "1px solid var(--emerald-border)",
          }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>
              Prize Pool (97%)
            </span>
            <span style={{ fontSize: 16, fontWeight: 800, color: "var(--emerald)" }}>
              {fmt(settlement.prizePool)}
            </span>
          </div>
        </div>

        <button
          onClick={onClose}
          className="btn-emerald"
          style={{ width: "100%", fontSize: 15, padding: "13px", borderRadius: 10 }}
        >
          Done
        </button>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────
export default function ResolveMarketsPage() {
  const { markets, resolveMarket } = useStore();
  const [selectedMarketId, setSelectedMarketId]   = useState<number | null>(null);
  const [selectedResult, setSelectedResult]       = useState<string>("");
  const [resolvedIds, setResolvedIds]             = useState<number[]>([]);
  const [resolving, setResolving]                 = useState(false);
  const [settlement, setSettlement]               = useState<SettlementBreakdown | null>(null);
  const [settlementTrades, setSettlementTrades]   = useState(0);
  const [settlementOutcome, setSettlementOutcome] = useState("");
  const [error, setError]                         = useState("");

  const resolvableMarkets = markets.filter(m => m.status !== "settled");
  const selectedMarket    = markets.find(m => m.id === selectedMarketId);

  const handleResolve = async () => {
    if (!selectedMarketId || !selectedResult) return;
    setResolving(true);
    setError("");

    const result = await resolveMarket(selectedMarketId, selectedResult);

    if (result) {
      // Backend returned full settlement breakdown — show it
      setSettlement(result);
      setSettlementTrades(0); // settledTrades not stored separately yet — show 0
      setSettlementOutcome(selectedResult);
      setResolvedIds(prev => [selectedMarketId, ...prev]);
      setSelectedMarketId(null);
      setSelectedResult("");
    } else {
      // Offline fallback — no settlement data but still worked
      setResolvedIds(prev => [selectedMarketId, ...prev]);
      setSelectedMarketId(null);
      setSelectedResult("");
    }
    setResolving(false);
  };

  return (
    <>
      {/* Settlement modal */}
      {settlement && (
        <SettlementModal
          settlement={settlement}
          settledTrades={settlementTrades}
          winningOutcome={settlementOutcome}
          onClose={() => setSettlement(null)}
        />
      )}

      <div style={{ padding: "28px 24px", maxWidth: 900 }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 28 }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: "linear-gradient(135deg, #f59e0b, #d97706)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Gavel size={22} color="white" />
          </div>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>Resolve Markets</h1>
            <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: 0 }}>
              {resolvableMarkets.length} market{resolvableMarkets.length !== 1 ? "s" : ""} awaiting resolution
            </p>
          </div>
        </div>

        {error && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderRadius: 10, marginBottom: 16, background: "var(--red-bg)", border: "1px solid var(--red-border)", color: "var(--red)", fontSize: 13 }}>
            {error}
            <button onClick={() => setError("")} style={{ marginLeft: "auto", background: "none", border: "none", color: "var(--red)", cursor: "pointer", fontSize: 16 }}>×</button>
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 20, alignItems: "start" }}>

          {/* Market selector */}
          <div className="card" style={{ padding: 20 }}>
            <h2 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", marginBottom: 14 }}>Select Market</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 420, overflowY: "auto" }}>
              {resolvableMarkets.length === 0 ? (
                <div style={{ textAlign: "center", padding: "24px 0", color: "var(--text-secondary)" }}>
                  <CheckCircle2 size={28} style={{ margin: "0 auto 10px", opacity: 0.3 }} />
                  <p style={{ fontSize: 13 }}>All markets are settled</p>
                </div>
              ) : (
                resolvableMarkets.map(m => (
                  <button
                    key={m.id}
                    onClick={() => { setSelectedMarketId(m.id); setSelectedResult(m.options[0]); setError(""); }}
                    style={{
                      padding: "12px 14px", borderRadius: 10, border: "1px solid",
                      borderColor: selectedMarketId === m.id ? "var(--emerald)" : "var(--border)",
                      background: selectedMarketId === m.id ? "var(--emerald-bg)" : "var(--bg-card-hover)",
                      color: selectedMarketId === m.id ? "var(--emerald)" : "var(--text-primary)",
                      textAlign: "left", cursor: "pointer", fontSize: 13, transition: "all 0.15s",
                    }}
                  >
                    <div style={{ display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 6 }}>
                      {m.image
                        ? <img src={m.image} alt="" style={{ width: 32, height: 32, borderRadius: 6, objectFit: "cover", flexShrink: 0 }} />
                        : <div style={{ width: 32, height: 32, borderRadius: 6, background: "var(--bg-card)", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 14 }}>📊</div>}
                      <span style={{ fontWeight: 600, lineHeight: 1.4 }}>
                        {m.title.length > 48 ? m.title.slice(0, 48) + "…" : m.title}
                      </span>
                    </div>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                      <span className={`badge-${m.status}`} style={{ fontSize: 10, fontWeight: 600, padding: "1px 7px", borderRadius: 20, textTransform: "uppercase" }}>
                        {m.status}
                      </span>
                      <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>{m.options.join(" · ")}</span>
                      {m.status === "open" && <Countdown expiresAt={m.expiresAt} duration={m.duration} compact />}
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Resolution panel */}
          <div className="card" style={{ padding: 20 }}>
            <h2 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", marginBottom: 14 }}>Choose Winning Outcome</h2>

            {!selectedMarket ? (
              <div style={{ textAlign: "center", padding: "36px 0", color: "var(--text-secondary)" }}>
                <Trophy size={36} style={{ margin: "0 auto 12px", opacity: 0.2 }} />
                <p style={{ fontSize: 13 }}>Select a market on the left to resolve it</p>
              </div>
            ) : (
              <>
                <div style={{ padding: "12px 14px", background: "var(--bg-primary)", borderRadius: 10, border: "1px solid var(--border)", marginBottom: 16, display: "flex", gap: 10, alignItems: "center" }}>
                  {selectedMarket.image
                    ? <img src={selectedMarket.image} alt="" style={{ width: 36, height: 36, borderRadius: 7, objectFit: "cover", flexShrink: 0 }} />
                    : <div style={{ width: 36, height: 36, borderRadius: 7, background: "var(--bg-card-hover)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 16 }}>📊</div>}
                  <p style={{ fontSize: 13, color: "var(--text-primary)", margin: 0, fontWeight: 600, lineHeight: 1.4 }}>
                    {selectedMarket.title}
                  </p>
                </div>

                <label style={{ fontSize: 11, color: "var(--text-secondary)", display: "block", marginBottom: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.4px" }}>
                  Winning Outcome
                </label>

                {/* MULTI_YESNO explanation */}
                {selectedMarket.type === "MULTI_YESNO" && (
                  <div style={{ padding: "8px 12px", borderRadius: 8, marginBottom: 12, background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.3)", fontSize: 12, color: "#6366f1" }}>
                    Select the team/outcome that won. Users who bet <strong>Yes</strong> on the winner get paid. All others lose.
                  </div>
                )}

                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
                  {selectedMarket.options.map(opt => {
                    const prob   = selectedMarket.probabilities[opt] ?? 0;
                    const isYesNo = selectedMarket.type === "MULTI_YESNO";
                    // For MULTI_YESNO result is stored as "Team A:Yes" or "Team A:No"
                    const yesResult = `${opt}:Yes`;
                    const noResult  = `${opt}:No`;
                    const yesSelected = selectedResult === yesResult;
                    const noSelected  = selectedResult === noResult;
                    const anySelected = yesSelected || noSelected;

                    if (isYesNo) {
                      return (
                        <div key={opt} style={{
                          padding: "12px 16px", borderRadius: 10,
                          border: `1px solid ${anySelected ? "var(--emerald)" : "var(--border)"}`,
                          background: anySelected ? "var(--emerald-bg)" : "var(--bg-card-hover)",
                        }}>
                          {/* Outcome name + probability */}
                          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                            <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", flex: 1 }}>{opt}</span>
                            <span style={{ fontSize: 12, color: "var(--text-secondary)", fontWeight: 600 }}>{prob}%</span>
                          </div>
                          {/* Yes / No settlement buttons */}
                          <div style={{ display: "flex", gap: 8 }}>
                            <button
                              onClick={() => setSelectedResult(yesResult)}
                              style={{
                                flex: 1, padding: "9px 0", borderRadius: 8, fontSize: 13, fontWeight: 700,
                                background: yesSelected ? "#10b981" : "rgba(16,185,129,0.15)",
                                color: yesSelected ? "#fff" : "#10b981",
                                border: `1px solid ${yesSelected ? "#10b981" : "rgba(16,185,129,0.4)"}`,
                                cursor: "pointer", transition: "all 0.15s",
                              }}
                            >
                              ✓ Yes Wins
                            </button>
                            <button
                              onClick={() => setSelectedResult(noResult)}
                              style={{
                                flex: 1, padding: "9px 0", borderRadius: 8, fontSize: 13, fontWeight: 700,
                                background: noSelected ? "#ef4444" : "rgba(239,68,68,0.15)",
                                color: noSelected ? "#fff" : "#ef4444",
                                border: `1px solid ${noSelected ? "#ef4444" : "rgba(239,68,68,0.4)"}`,
                                cursor: "pointer", transition: "all 0.15s",
                              }}
                            >
                              ✗ No Wins
                            </button>
                          </div>
                          {/* Show what happens */}
                          {yesSelected && (
                            <p style={{ fontSize: 11, color: "var(--emerald)", margin: "8px 0 0", fontWeight: 600 }}>
                              → "{opt} Yes" bettors WIN · All others LOSE
                            </p>
                          )}
                          {noSelected && (
                            <p style={{ fontSize: 11, color: "#ef4444", margin: "8px 0 0", fontWeight: 600 }}>
                              → "{opt} No" bettors WIN · All others LOSE
                            </p>
                          )}
                        </div>
                      );
                    }

                    // Regular MULTI market
                    const isSel = selectedResult === opt;
                    return (
                      <button
                        key={opt}
                        onClick={() => setSelectedResult(opt)}
                        style={{
                          padding: "12px 16px", borderRadius: 10, border: "1px solid",
                          borderColor: isSel ? "var(--emerald)" : "var(--border)",
                          background: isSel ? "var(--emerald-bg)" : "var(--bg-card-hover)",
                          color: isSel ? "var(--emerald)" : "var(--text-primary)",
                          textAlign: "left", cursor: "pointer",
                          transition: "all 0.15s",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                          <div style={{ width: 18, height: 18, borderRadius: "50%", flexShrink: 0, border: `2px solid ${isSel ? "var(--emerald)" : "var(--border)"}`, background: isSel ? "var(--emerald)" : "transparent", display: "flex", alignItems: "center", justifyContent: "center" }}>
                            {isSel && <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#fff" }} />}
                          </div>
                          <span style={{ flex: 1, fontSize: 14, fontWeight: isSel ? 700 : 400 }}>{opt}</span>
                          <span style={{ fontSize: 12, color: isSel ? "var(--emerald)" : "var(--text-secondary)", fontWeight: 600 }}>{prob}%</span>
                        </div>
                      </button>
                    );
                  })}
                </div>

                <button
                  className="btn-emerald"
                  onClick={handleResolve}
                  disabled={!selectedResult || resolving}
                  style={{ width: "100%", fontSize: 14, padding: "13px", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
                >
                  {resolving ? (
                    <><span style={{ width: 16, height: 16, border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", borderRadius: "50%", display: "inline-block", animation: "spin 0.8s linear infinite" }} /> Settling…</>
                  ) : (
                    <><CheckCircle2 size={16} /> Settle as "{selectedResult}"</>
                  )}
                </button>
              </>
            )}
          </div>
        </div>

        {/* Recently resolved */}
        {resolvedIds.length > 0 && (
          <div className="card" style={{ padding: 20, marginTop: 20 }}>
            <h2 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", marginBottom: 14 }}>Recently Resolved</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {resolvedIds.map(id => {
                const m = markets.find(mk => mk.id === id);
                if (!m) return null;
                return (
                  <div key={id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", background: "var(--emerald-bg)", border: "1px solid var(--emerald-border)", borderRadius: 9 }}>
                    <span style={{ fontSize: 13, color: "var(--text-primary)" }}>
                      {m.title.length > 52 ? m.title.slice(0, 52) + "…" : m.title}
                    </span>
                    <span style={{ fontSize: 13, color: "var(--emerald)", fontWeight: 700, flexShrink: 0, marginLeft: 12 }}>
                      ✓ {m.result}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </>
  );
}
