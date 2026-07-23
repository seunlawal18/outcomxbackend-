"use client";
import React, { useState, useEffect, useImperativeHandle } from "react";
import Link from "next/link";
import { Market } from "@/lib/types";
import { useStore } from "@/lib/store";
import { useCurrency } from "@/lib/useCurrency";
import LoginRequiredModal from "@/components/LoginRequiredModal";
import Countdown from "@/components/Countdown";
import {
  Wallet, AlertCircle, CheckCircle2, Lock,
  TrendingUp, TrendingDown, Zap, X,
} from "lucide-react";

interface Props {
  market: Market;
  preSelected?: string;
  preSelectedSide?: "yes" | "no";
  onTradeSuccess?: () => void;
  /** When true, renders as a compact bottom bar that opens a slide-up sheet */
  isMobile?: boolean;
  /** Imperative ref: call openSheet(option) to open the sheet with a pre-selected outcome */
  sheetRef?: React.RefObject<{ open: (opt?: string) => void } | null>;
}

// ─────────────────────────────────────────────────────────────────
// The actual trade form — shared between desktop and mobile sheet
// ─────────────────────────────────────────────────────────────────
function TradeForm({
  market,
  selectedOption, setSelectedOption,
  yesNoSide, setYesNoSide,
  amount, setAmount,
  status, errorMsg,
  onTrade,
  compact = false,
}: {
  market: Market;
  selectedOption: string;
  setSelectedOption: (v: string) => void;
  yesNoSide: "yes" | "no";
  setYesNoSide: (v: "yes" | "no") => void;
  amount: string;
  setAmount: (v: string) => void;
  status: "idle" | "loading" | "success" | "error";
  errorMsg: string;
  onTrade: () => void;
  compact?: boolean;
}) {
  const { balance } = useStore();
  const { fmt, minStake, symbol, quickStakes, toCredits, toDisplay } = useCurrency();
  const isMultiYesNo = market.type === "MULTI_YESNO";
  const prob = market.probabilities[selectedOption] ?? 50;
  const effectiveProb = isMultiYesNo && yesNoSide === "no" ? 100 - prob : prob;
  // amt is in display currency (what user typed)
  const amt = parseFloat(amount || "0");
  const safeProbability = Math.max(effectiveProb / 100, 0.05);
  // Payout stays in display currency for preview
  const lockedPayout = amt > 0 ? amt * (1 / safeProbability) : 0;
  const lockedProfit = lockedPayout - amt;
  // balance is in credits — convert once for display
  const displayBalance = toDisplay(balance);

  return (
    <div style={{ padding: compact ? "12px 14px" : 16 }}>
      {/* Option selector */}
      {isMultiYesNo ? (
        <div style={{ marginBottom: 12 }}>
          <p style={{ fontSize: 10, color: "var(--text-muted)", margin: "0 0 6px", textTransform: "uppercase", letterSpacing: "0.5px" }}>Outcome</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 8 }}>
            {market.options.map((opt, i) => {
              const p = market.probabilities[opt] ?? 50;
              const COLORS = ["#10b981", "#ef4444", "#f59e0b", "#6366f1", "#3b82f6", "#8b5cf6"];
              const color = COLORS[i % COLORS.length];
              const isSel = selectedOption === opt;
              return (
                <button key={opt} onClick={() => setSelectedOption(opt)} style={{
                  display: "flex", alignItems: "center", gap: 8,
                  padding: "7px 10px", borderRadius: 8, cursor: "pointer",
                  border: `1px solid ${isSel ? color : "var(--border)"}`,
                  background: isSel ? `${color}18` : "var(--bg-card-hover)",
                  transition: "all 0.15s",
                }}>
                  <span style={{ width: 7, height: 7, borderRadius: "50%", background: color, flexShrink: 0 }} />
                  <span style={{ flex: 1, fontSize: 13, fontWeight: isSel ? 700 : 500, color: isSel ? "var(--text-primary)" : "var(--text-secondary)", textAlign: "left" }}>{opt}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color }}>{p}%</span>
                </button>
              );
            })}
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            {(["yes", "no"] as const).map(side => {
              const isYes = side === "yes";
              const active = yesNoSide === side;
              const c = isYes ? "var(--emerald)" : "var(--red)";
              return (
                <button key={side} onClick={() => setYesNoSide(side)} style={{
                  flex: 1, padding: "8px", borderRadius: 8, cursor: "pointer",
                  border: `1px solid ${active ? c : "var(--border)"}`,
                  background: active ? c : "var(--bg-card-hover)",
                  color: active ? "#fff" : "var(--text-secondary)",
                  fontSize: 13, fontWeight: 700, transition: "all 0.15s",
                  display: "flex", flexDirection: "column", alignItems: "center", gap: 1,
                }}>
                  <span>{isYes ? "Yes" : "No"}</span>
                  <span style={{ fontSize: 10, opacity: 0.8 }}>{isYes ? prob : 100 - prob}%</span>
                </button>
              );
            })}
          </div>
        </div>
      ) : market.type === "YES_NO" || market.type === "UP_DOWN" ? (
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          {market.options.map((opt, i) => {
            const p = market.probabilities[opt] ?? 50;
            const isFirst = i === 0;
            const sel = selectedOption === opt;
            const activeColor = isFirst ? "var(--emerald)" : "var(--red)";
            return (
              <button key={opt} onClick={() => setSelectedOption(opt)} style={{
                flex: 1, padding: "10px 6px", borderRadius: 10, cursor: "pointer",
                border: `1px solid ${sel ? activeColor : "var(--border)"}`,
                background: sel ? activeColor : "var(--bg-card-hover)",
                color: sel ? "#fff" : "var(--text-secondary)",
                transition: "all 0.15s", textAlign: "center",
              }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 4, marginBottom: 2 }}>
                  {isFirst ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                  <span style={{ fontSize: 12, fontWeight: 700 }}>{opt}</span>
                </div>
                <span style={{ fontSize: 17, fontWeight: 800, display: "block" }}>{p}%</span>
                <span style={{ fontSize: 10, opacity: 0.8 }}>{(p / 100).toFixed(2)}¢</span>
              </button>
            );
          })}
        </div>
      ) : (
        <div style={{ marginBottom: 12 }}>
          <p style={{ fontSize: 10, color: "var(--text-muted)", margin: "0 0 6px", textTransform: "uppercase", letterSpacing: "0.5px" }}>Select Outcome</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            {market.options.map((opt, i) => {
              const p = market.probabilities[opt] ?? 0;
              const sel = selectedOption === opt;
              const COLORS = ["#10b981", "#ef4444", "#f59e0b", "#6366f1"];
              const color = COLORS[i % COLORS.length];
              return (
                <button key={opt} onClick={() => setSelectedOption(opt)} style={{
                  display: "flex", alignItems: "center", gap: 8,
                  padding: "9px 11px", borderRadius: 9, cursor: "pointer",
                  border: `1px solid ${sel ? color : "var(--border)"}`,
                  background: sel ? `${color}18` : "var(--bg-card-hover)",
                  transition: "all 0.15s",
                }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: color, flexShrink: 0 }} />
                  <span style={{ flex: 1, fontSize: 13, fontWeight: sel ? 700 : 500, color: sel ? "var(--text-primary)" : "var(--text-secondary)", textAlign: "left" }}>{opt}</span>
                  <span style={{ fontSize: 14, fontWeight: 800, color }}>{p}%</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Amount input */}
      <div style={{ marginBottom: 8 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
          <label style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px" }}>Amount</label>
          <span style={{ fontSize: 11, color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: 3 }}>
            <Wallet size={10} /> {fmt(balance)}
          </span>
        </div>
        <div style={{ position: "relative" }}>
          <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)", fontSize: 15, fontWeight: 700, pointerEvents: "none" }}>
            {symbol}
          </span>
          <input
            className="input-dark"
            type="number"
            placeholder="0"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            onKeyDown={e => e.key === "Enter" && onTrade()}
            style={{ paddingLeft: 28, fontSize: compact ? 18 : 22, fontWeight: 800, textAlign: "right", height: compact ? 44 : 52 }}
          />
        </div>
      </div>

      {/* Quick amounts */}
      <div style={{ display: "flex", gap: 4, marginBottom: 10 }}>
        {quickStakes.slice(0, 3).map(qa => (
          <button key={qa} onClick={() => setAmount(String(qa))} style={{
            flex: 1, padding: "5px 0", borderRadius: 6,
            background: amount === String(qa) ? "var(--emerald-bg)" : "var(--bg-card-hover)",
            border: `1px solid ${amount === String(qa) ? "var(--emerald-border)" : "var(--border)"}`,
            color: amount === String(qa) ? "var(--emerald)" : "var(--text-secondary)",
            fontSize: 11, fontWeight: 600, cursor: "pointer", transition: "all 0.15s",
          }}>
            {symbol}{qa.toLocaleString()}
          </button>
        ))}
        <button onClick={() => setAmount(String(Math.floor(displayBalance * 0.5)))} style={{ flex: 1, padding: "5px 0", borderRadius: 6, background: "var(--bg-card-hover)", border: "1px solid var(--border)", color: "var(--text-secondary)", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>50%</button>
        <button onClick={() => setAmount(String(Math.floor(displayBalance)))} style={{ flex: 1, padding: "5px 0", borderRadius: 6, background: "var(--bg-card-hover)", border: "1px solid var(--border)", color: "var(--text-secondary)", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>Max</button>
      </div>

      {/* Return preview */}
      {amt >= minStake && (
        <div className="fade-in" style={{
          padding: "9px 12px", borderRadius: 10, marginBottom: 10,
          background: "var(--emerald-bg)", border: "1px solid var(--emerald-border)",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 3 }}>
            <span style={{ fontSize: 12, color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: 5 }}>
              You win
              <span style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--emerald)", display: "inline-block", animation: "livePulse 1s ease-in-out infinite" }} />
            </span>
            <span style={{ fontSize: 15, fontWeight: 800, color: "var(--emerald)", fontVariantNumeric: "tabular-nums" }}>
              {fmt(lockedPayout)}
            </span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>Profit</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: "var(--emerald)", fontVariantNumeric: "tabular-nums" }}>
              +{fmt(lockedProfit)} ({((lockedProfit / amt) * 100).toFixed(0)}%)
            </span>
          </div>
        </div>
      )}

      {/* Status messages */}
      {status === "success" && (
        <div className="fade-in" style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 12px", background: "var(--emerald-bg)", border: "1px solid var(--emerald-border)", borderRadius: 10, marginBottom: 10 }}>
          <CheckCircle2 size={15} color="var(--emerald)" />
          <p style={{ fontSize: 13, fontWeight: 700, color: "var(--emerald)", margin: 0 }}>Trade placed!</p>
        </div>
      )}
      {status === "error" && (
        <div className="fade-in" style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 12px", background: "var(--red-bg)", border: "1px solid var(--red-border)", borderRadius: 10, marginBottom: 10 }}>
          <AlertCircle size={15} color="var(--red)" />
          <span style={{ fontSize: 12, color: "var(--red)" }}>{errorMsg}</span>
        </div>
      )}

      {/* Submit */}
      <button
        className="btn-emerald"
        onClick={onTrade}
        disabled={status === "loading" || !amount || amt < minStake}
        style={{ width: "100%", fontSize: 14, padding: "13px", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", gap: 7 }}
      >
        {status === "loading" ? (
          <>
            <span style={{ width: 14, height: 14, border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", borderRadius: "50%", display: "inline-block", animation: "spin 0.8s linear infinite" }} />
            Placing…
          </>
        ) : (
          <>
            <Zap size={14} />
            Trade {isMultiYesNo ? `${selectedOption} ${yesNoSide === "yes" ? "Yes" : "No"}` : selectedOption}
            {amt >= minStake ? ` · ${fmt(amt)}` : ""}
          </>
        )}
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Main TradePanel export
// ─────────────────────────────────────────────────────────────────
export default function TradePanel({ market, preSelected, preSelectedSide, onTradeSuccess, isMobile, sheetRef }: Props) {
  const { balance, placeTrade, isLoggedIn } = useStore();
  const { fmt, minStake, symbol, toCredits, toDisplay } = useCurrency();
  const displayBalance = toDisplay(balance);

  const [selectedOption, setSelectedOption] = useState(preSelected || market.options[0]);
  const [yesNoSide, setYesNoSide] = useState<"yes" | "no">(preSelectedSide ?? "yes");
  const [amount, setAmount] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [showLoginModal, setShowLoginModal] = useState(false);
  // Mobile: sheet is closed by default; opens when user taps an outcome chip
  const [sheetOpen, setSheetOpen] = useState(false);

  useEffect(() => { if (preSelected) setSelectedOption(preSelected); }, [preSelected]);
  useEffect(() => { if (preSelectedSide) setYesNoSide(preSelectedSide); }, [preSelectedSide]);

  // Expose open() so the parent page can open the sheet when an outcome row is tapped
  useImperativeHandle(sheetRef, () => ({
    open: (opt?: string) => {
      if (opt) setSelectedOption(opt);
      setSheetOpen(true);
    },
  }));

  // Refresh payout every second while sheet is open and amount is set
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!sheetOpen && !(!isMobile)) return;
    const hasAmt = parseFloat(amount) >= minStake;
    if (!hasAmt) return;
    const id = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [amount, sheetOpen, minStake]);
  // consume tick to force re-render for live payout
  void tick;

  const handleTrade = async () => {
    const a = parseFloat(amount); // display currency
    if (!a || a < minStake) {
      setErrorMsg(`Minimum stake is ${symbol}${minStake.toLocaleString()}`);
      setStatus("error");
      setTimeout(() => setStatus("idle"), 3000);
      return;
    }
    if (a > displayBalance) {
      setErrorMsg(`Insufficient balance (${fmt(balance)})`);
      setStatus("error");
      setTimeout(() => setStatus("idle"), 3000);
      return;
    }
    setStatus("loading");
    const tradeOption = market.type === "MULTI_YESNO"
      ? `${selectedOption}:${yesNoSide === "yes" ? "Yes" : "No"}`
      : selectedOption;
    // Convert display currency → credits before sending to API
    const amountCredits = toCredits(a);
    const ok = await placeTrade(market.id, tradeOption, amountCredits);
    if (ok) {
      setStatus("success");
      setAmount("");
      onTradeSuccess?.();
      // Close sheet after brief success flash
      setTimeout(() => {
        setStatus("idle");
        if (isMobile) setSheetOpen(false);
      }, 1800);
    } else {
      setErrorMsg("Trade failed. Market may be closed.");
      setStatus("error");
      setTimeout(() => setStatus("idle"), 3000);
    }
  };

  // ── Market closed ─────────────────────────────────────────────
  if (market.status !== "open") {
    if (isMobile) return null; // mobile bar hides when market closed
    return (
      <div className="card" style={{ padding: 20 }}>
        <div style={{ textAlign: "center", padding: "16px 0" }}>
          <div style={{
            width: 48, height: 48, borderRadius: 12, margin: "0 auto 12px",
            background: market.status === "settled" ? "var(--emerald-bg)" : "var(--red-bg)",
            border: `1px solid ${market.status === "settled" ? "var(--emerald-border)" : "var(--red-border)"}`,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            {market.status === "settled"
              ? <CheckCircle2 size={22} color="var(--emerald)" />
              : <AlertCircle size={22} color="var(--red)" />}
          </div>
          <p style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)", margin: "0 0 4px" }}>
            Market {market.status === "settled" ? "Resolved" : "Closed"}
          </p>
          {market.result ? (
            <div style={{ marginTop: 12, padding: "10px 16px", background: "var(--emerald-bg)", border: "1px solid var(--emerald-border)", borderRadius: 10 }}>
              <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: "0 0 2px" }}>WINNING OUTCOME</p>
              <p style={{ fontSize: 18, fontWeight: 800, color: "var(--emerald)", margin: 0 }}>{market.result}</p>
            </div>
          ) : (
            <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: 0 }}>This market is no longer accepting trades.</p>
          )}
        </div>
      </div>
    );
  }

  // ── Logged out ────────────────────────────────────────────────
  if (!isLoggedIn) {
    if (isMobile) {
      return (
        <>
          {showLoginModal && <LoginRequiredModal onClose={() => setShowLoginModal(false)} message="Create a free account to start trading on prediction markets." />}
          <div style={{ padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {market.options.slice(0, 2).map((opt, i) => {
                const p = market.probabilities[opt] ?? 50;
                const color = i === 0 ? "var(--emerald)" : "var(--red)";
                const bg = i === 0 ? "var(--emerald-bg)" : "var(--red-bg)";
                const border = i === 0 ? "var(--emerald-border)" : "var(--red-border)";
                return (
                  <div key={opt} style={{ padding: "4px 10px", borderRadius: 8, background: bg, border: `1px solid ${border}`, display: "flex", alignItems: "center", gap: 4 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color }}>{opt}</span>
                    <span style={{ fontSize: 13, fontWeight: 800, color }}>{p}%</span>
                  </div>
                );
              })}
            </div>
            <button onClick={() => setShowLoginModal(true)} className="btn-emerald" style={{ padding: "10px 18px", borderRadius: 9, fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap" }}>
              <Lock size={13} /> Login to Trade
            </button>
          </div>
        </>
      );
    }

    return (
      <>
        {showLoginModal && <LoginRequiredModal onClose={() => setShowLoginModal(false)} message="Create a free account to start trading on prediction markets." />}
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--border)", background: "linear-gradient(135deg, rgba(16,185,129,0.06), rgba(16,185,129,0.02))" }}>
            <p style={{ fontSize: 11, color: "var(--text-muted)", margin: "0 0 6px", textTransform: "uppercase", letterSpacing: "0.5px" }}>Current Odds</p>
            <div style={{ display: "flex", gap: 8 }}>
              {market.options.slice(0, 2).map((opt, i) => {
                const p = market.probabilities[opt] ?? 50;
                const isFirst = i === 0;
                return (
                  <div key={opt} style={{ flex: 1, padding: "10px 12px", borderRadius: 10, background: isFirst ? "var(--emerald-bg)" : "var(--red-bg)", border: `1px solid ${isFirst ? "var(--emerald-border)" : "var(--red-border)"}`, textAlign: "center" }}>
                    <p style={{ fontSize: 11, color: isFirst ? "var(--emerald)" : "var(--red)", margin: "0 0 2px", fontWeight: 600 }}>{opt}</p>
                    <p style={{ fontSize: 20, fontWeight: 800, color: isFirst ? "var(--emerald)" : "var(--red)", margin: 0 }}>{p}%</p>
                    <p style={{ fontSize: 10, color: "var(--text-muted)", margin: "2px 0 0" }}>{(p / 100).toFixed(2)}¢</p>
                  </div>
                );
              })}
            </div>
          </div>
          <div style={{ padding: 16, filter: "blur(2px)", pointerEvents: "none", opacity: 0.5 }}>
            <div style={{ height: 44, borderRadius: 8, background: "var(--bg-card-hover)", border: "1px solid var(--border)", marginBottom: 10 }} />
            <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
              {[1,2,3,4].map(i => <div key={i} style={{ flex: 1, height: 32, borderRadius: 6, background: "var(--bg-card-hover)" }} />)}
            </div>
            <div style={{ height: 46, borderRadius: 10, background: "var(--emerald)", opacity: 0.4 }} />
          </div>
          <div style={{ padding: "0 16px 16px" }}>
            <button onClick={() => setShowLoginModal(true)} className="btn-emerald" style={{ width: "100%", fontSize: 15, padding: "13px", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
              <Lock size={15} /> Login to Trade
            </button>
            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <Link href="/login" style={{ flex: 1, textAlign: "center", padding: "9px", borderRadius: 8, fontSize: 13, fontWeight: 600, background: "var(--bg-card-hover)", border: "1px solid var(--border)", color: "var(--text-primary)", textDecoration: "none" }}>Log In</Link>
              <Link href="/register" style={{ flex: 1, textAlign: "center", padding: "9px", borderRadius: 8, fontSize: 13, fontWeight: 700, background: "var(--emerald-bg)", border: "1px solid var(--emerald-border)", color: "var(--emerald)", textDecoration: "none" }}>Sign Up Free</Link>
            </div>
          </div>
        </div>
      </>
    );
  }

  // ── Logged in — MOBILE bottom bar + slide-up sheet ────────────
  if (isMobile) {
    const isMultiYesNo = market.type === "MULTI_YESNO";
    const COLORS = ["#10b981", "#ef4444", "#f59e0b", "#6366f1", "#3b82f6", "#8b5cf6"];

    return (
      <>
        {/* Compact bottom bar — shows odds chips, tap to open sheet */}
        <div style={{ padding: "10px 14px", display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ display: "flex", gap: 5, flex: 1, flexWrap: "wrap" }}>
            {market.options.slice(0, isMultiYesNo ? 3 : 2).map((opt, i) => {
              const p = market.probabilities[opt] ?? 50;
              const color = COLORS[i % COLORS.length];
              const isSel = selectedOption === opt;
              return (
                <button
                  key={opt}
                  onClick={() => {
                    setSelectedOption(opt);
                    setSheetOpen(true);
                  }}
                  style={{
                    padding: "7px 12px", borderRadius: 9, cursor: "pointer",
                    border: `1px solid ${isSel && sheetOpen ? color : "var(--border)"}`,
                    background: isSel && sheetOpen ? `${color}22` : "var(--bg-card-hover)",
                    display: "flex", alignItems: "center", gap: 5,
                    transition: "all 0.15s",
                  }}
                >
                  <span style={{ width: 7, height: 7, borderRadius: "50%", background: color, flexShrink: 0 }} />
                  <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)" }}>{opt}</span>
                  <span style={{ fontSize: 13, fontWeight: 800, color }}>{p}%</span>
                </button>
              );
            })}
          </div>
          <button
            onClick={() => setSheetOpen(true)}
            className="btn-emerald"
            style={{ padding: "10px 18px", borderRadius: 10, fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap", flexShrink: 0 }}
          >
            <Zap size={13} /> Trade
          </button>
        </div>

        {/* Backdrop */}
        {sheetOpen && (
          <div
            onClick={() => setSheetOpen(false)}
            style={{
              position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)",
              zIndex: 49, backdropFilter: "blur(2px)",
              animation: "fadeIn 0.2s ease",
            }}
          />
        )}

        {/* Slide-up sheet */}
        <div style={{
          position: "fixed", left: 0, right: 0, bottom: 0,
          zIndex: 50,
          background: "var(--bg-card)",
          borderTop: "1px solid var(--border)",
          borderRadius: "18px 18px 0 0",
          boxShadow: "0 -8px 40px rgba(0,0,0,0.5)",
          transform: sheetOpen ? "translateY(0)" : "translateY(100%)",
          transition: "transform 0.3s cubic-bezier(0.32, 0.72, 0, 1)",
          maxHeight: "85vh",
          overflowY: "auto",
          WebkitOverflowScrolling: "touch",
        }}>
          {/* Sheet handle + header */}
          <div style={{ padding: "12px 16px 0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {/* drag handle */}
              <div style={{ width: 36, height: 4, borderRadius: 2, background: "var(--border)", margin: "0 auto" }} />
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <p style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>Place Trade</p>
              <Countdown expiresAt={market.expiresAt} duration={market.duration} compact />
            </div>
            <button onClick={() => setSheetOpen(false)} style={{ background: "none", border: "none", cursor: "pointer", padding: 4, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 6, color: "var(--text-muted)" }}>
              <X size={18} />
            </button>
          </div>

          <TradeForm
            market={market}
            selectedOption={selectedOption}
            setSelectedOption={setSelectedOption}
            yesNoSide={yesNoSide}
            setYesNoSide={setYesNoSide}
            amount={amount}
            setAmount={setAmount}
            status={status}
            errorMsg={errorMsg}
            onTrade={handleTrade}
            compact
          />

          {/* Safe area spacer for devices with home bar */}
          <div style={{ height: "env(safe-area-inset-bottom, 16px)", minHeight: 16 }} />
        </div>

        <style>{`
          @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
          @keyframes spin { to { transform: rotate(360deg); } }
          @keyframes livePulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.4;transform:scale(0.7)} }
        `}</style>
      </>
    );
  }

  // ── Logged in — DESKTOP full panel ────────────────────────────
  return (
    <div className="card" style={{ padding: 0, overflow: "hidden" }}>
      <div style={{
        padding: "14px 16px", borderBottom: "1px solid var(--border)",
        background: "linear-gradient(135deg, rgba(16,185,129,0.06), rgba(16,185,129,0.02))",
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <div>
          <p style={{ fontSize: 11, color: "var(--text-muted)", margin: "0 0 2px", textTransform: "uppercase", letterSpacing: "0.5px" }}>Place Trade</p>
          <p style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>
            {market.type === "MULTI_YESNO"
              ? <>{selectedOption} · <span style={{ color: yesNoSide === "yes" ? "var(--emerald)" : "var(--red)" }}>{yesNoSide === "yes" ? "Yes" : "No"} {(market.probabilities[selectedOption] ?? 50)}%</span></>
              : <>{selectedOption} · <span style={{ color: "var(--emerald)" }}>{market.probabilities[selectedOption] ?? 50}%</span></>
            }
          </p>
        </div>
        <Countdown expiresAt={market.expiresAt} duration={market.duration} compact />
      </div>

      <TradeForm
        market={market}
        selectedOption={selectedOption}
        setSelectedOption={setSelectedOption}
        yesNoSide={yesNoSide}
        setYesNoSide={setYesNoSide}
        amount={amount}
        setAmount={setAmount}
        status={status}
        errorMsg={errorMsg}
        onTrade={handleTrade}
      />

      <p style={{ fontSize: 11, color: "var(--text-muted)", textAlign: "center", padding: "0 16px 14px", lineHeight: 1.5 }}>
        Simulation only — no real money involved
      </p>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes livePulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.4;transform:scale(0.7)} }
      `}</style>
    </div>
  );
}
