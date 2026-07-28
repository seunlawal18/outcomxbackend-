"use client";
import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { QRCodeSVG } from "qrcode.react";
import { useStore } from "@/lib/store";
import { useTheme } from "@/lib/themeStore";
import { useCurrency } from "@/lib/useCurrency";
import { apiGetDepositAddress, apiRequestWithdrawal, apiGetMyWithdrawals, ApiWithdrawalRequest } from "@/lib/api";
import { REGION_OPTIONS, DISPLAY_CURRENCIES, DisplayCurrencyCode } from "@/lib/credits";
import { getSocket } from "@/lib/socket";
import WalletConnectModal from "./WalletConnectModal";
import NotificationBell from "./NotificationBell";
import Logo from "./Logo";
import {
  Search, Wallet, TrendingUp, Sun, Moon,
  Menu, X, BarChart2, ChevronRight, UserCircle,
  Plus, CheckCircle2, AlertCircle, LogOut, LogIn, UserPlus, Copy, Coins, ExternalLink,
} from "lucide-react";

// Testnet by default (matches where deposit/withdrawal testing currently
// happens) — switch NEXT_PUBLIC_EXPLORER_BASE_URL to https://polygonscan.com
// when moving to mainnet.
const EXPLORER_BASE = process.env.NEXT_PUBLIC_EXPLORER_BASE_URL ?? "https://amoy.polygonscan.com";

// ── Crypto Deposit Tab ──────────────────────────────────────────────
// Real Polygon deposit address (USDT/USDC) — distinct from the demo
// self-credit tab below. Fetched lazily on first render of this tab.
function CryptoDepositTab({ isDark }: { isDark: boolean }) {
  const [address, setAddress] = useState<string | null>(null);
  const [error, setError]     = useState("");
  const [copied, setCopied]   = useState(false);

  useEffect(() => {
    apiGetDepositAddress().then(res => {
      if (res.ok && res.data) setAddress(res.data.address);
      else setError(res.error ?? "Crypto deposits aren't available yet.");
    });
  }, []);

  const sub = isDark ? "#8b8fa8" : "#64748b";
  const border = isDark ? "#2a2d3a" : "#e2e8f0";

  const handleCopy = () => {
    if (!address) return;
    // navigator.clipboard can be undefined (non-HTTPS context, older
    // browsers, some embedded/automated environments) — accessing
    // .writeText on it then throws synchronously and would otherwise skip
    // the state update below, leaving the click looking like it did nothing.
    navigator.clipboard?.writeText(address).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  if (error) {
    return (
      <div style={{ textAlign: "center", padding: "24px 0" }}>
        <AlertCircle size={28} color="#ef4444" style={{ margin: "0 auto 10px" }} />
        <p style={{ fontSize: 13, color: sub, margin: 0 }}>{error}</p>
      </div>
    );
  }

  if (!address) {
    return (
      <div style={{ textAlign: "center", padding: "32px 0" }}>
        <span style={{ width: 22, height: 22, border: "2px solid var(--border)", borderTopColor: "#10b981", borderRadius: "50%", display: "inline-block", animation: "spin 0.8s linear infinite" }} />
      </div>
    );
  }

  return (
    <div>
      <div style={{ padding: "10px 14px", borderRadius: 10, marginBottom: 16, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)" }}>
        <p style={{ fontSize: 12, color: "#ef4444", margin: 0, lineHeight: 1.5 }}>
          Only send <strong>USDT</strong> or <strong>USDC</strong> on the <strong>Polygon</strong> network to this address. Sending any other asset, or using a different network, may permanently lose the funds.
        </p>
      </div>

      <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
        <div style={{ padding: 12, background: "#fff", borderRadius: 12, border: `1px solid ${border}` }}>
          <QRCodeSVG value={address} size={160} />
        </div>
      </div>

      <p style={{ fontSize: 11, color: sub, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.4px", marginBottom: 7 }}>
        Your Polygon Deposit Address
      </p>
      <div
        onClick={handleCopy}
        style={{
          display: "flex", alignItems: "center", gap: 8, padding: "12px 14px",
          borderRadius: 10, border: `1px solid ${border}`,
          background: isDark ? "#1f2333" : "#f8fafc", cursor: "pointer",
        }}
      >
        <span style={{ flex: 1, fontSize: 12, fontFamily: "monospace", color: isDark ? "#f0f2f5" : "#0f172a", wordBreak: "break-all" }}>
          {address}
        </span>
        {copied ? <CheckCircle2 size={16} color="#10b981" /> : <Copy size={15} color={sub} />}
      </div>
      {copied && <p style={{ fontSize: 11, color: "#10b981", margin: "6px 0 0", textAlign: "center" }}>Copied</p>}

      <p style={{ fontSize: 11, color: sub, margin: "16px 0 0", textAlign: "center", lineHeight: 1.5 }}>
        Deposits are credited automatically once confirmed on-chain — usually within a few minutes.
      </p>
    </div>
  );
}

// ── Withdraw Tab ──────────────────────────────────────────────────
// Requests a real payout — distinct from the demo/crypto deposit tabs.
// Funds are locked (debited) the moment the request is submitted; an admin
// reviews it from there. This only submits the request — it does not move
// any crypto itself.
const EVM_ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;

function WithdrawTab({ isDark }: { isDark: boolean }) {
  const { balance, isLoggedIn } = useStore();
  const { fmt, symbol, toCredits, toDisplay, minWithdraw } = useCurrency();
  const [amount, setAmount]           = useState("");
  const [address, setAddress]         = useState("");
  const [submitting, setSubmitting]   = useState(false);
  const [err, setErr]                 = useState("");
  const [done, setDone]               = useState(false);
  const [history, setHistory]         = useState<ApiWithdrawalRequest[]>([]);

  const sub = isDark ? "#8b8fa8" : "#64748b";
  const border = isDark ? "#2a2d3a" : "#e2e8f0";
  const availableDisplay = toDisplay(balance);
  const addressValid = EVM_ADDRESS_RE.test(address.trim());

  const loadHistory = () => {
    apiGetMyWithdrawals().then(res => { if (res.ok && res.data) setHistory(res.data); });
  };

  useEffect(() => { loadHistory(); }, [done]);

  // Live-refresh the list if an admin approves/rejects/sends while this
  // tab happens to be open — otherwise the status would look stale until
  // the modal is closed and reopened.
  useEffect(() => {
    if (!isLoggedIn) return;
    const socket = getSocket();
    socket.on("withdrawal:updated", loadHistory);
    return () => { socket.off("withdrawal:updated", loadHistory); };
  }, [isLoggedIn]);

  const handleMax = () => {
    setAmount(availableDisplay > 0 ? String(Math.floor(availableDisplay * 100) / 100) : "");
    setErr("");
  };

  const handleSubmit = async () => {
    setErr("");
    const amt = parseFloat(amount); // display currency
    if (!amt || amt < minWithdraw) { setErr(`Minimum withdrawal is ${symbol}${minWithdraw.toLocaleString()}`); return; }
    if (availableDisplay < amt) { setErr("Amount exceeds your balance"); return; }
    if (!addressValid) { setErr("Enter a valid Polygon/EVM address (0x + 40 hex characters)"); return; }

    setSubmitting(true);
    const res = await apiRequestWithdrawal(toCredits(amt), address.trim());
    setSubmitting(false);
    if (res.ok) {
      setDone(true);
      setAmount("");
      setAddress("");
      setTimeout(() => setDone(false), 2500);
    } else {
      setErr(res.error ?? "Withdrawal request failed. Please try again.");
    }
  };

  const STATUS_COLORS: Record<string, string> = {
    pending: "#f59e0b", approved: "#10b981", rejected: "#ef4444", completed: "#6366f1",
  };

  return (
    <div>
      <div style={{ padding: "10px 14px", borderRadius: 10, marginBottom: 16, background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.25)" }}>
        <p style={{ fontSize: 12, color: "#6366f1", margin: 0, lineHeight: 1.5 }}>
          Withdrawals are reviewed by an admin before funds are sent — this only submits your request. Your balance is deducted immediately once submitted.
        </p>
      </div>

      {done ? (
        <div className="fade-in" style={{ textAlign: "center", padding: "20px 0" }}>
          <CheckCircle2 size={40} color="#10b981" style={{ margin: "0 auto 10px" }} />
          <p style={{ fontSize: 15, fontWeight: 700, color: "#10b981", margin: 0 }}>Withdrawal requested</p>
          <p style={{ fontSize: 12, color: sub, margin: "4px 0 0" }}>Awaiting admin review</p>
        </div>
      ) : (
        <>
          <div style={{ marginBottom: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 7 }}>
              <p style={{ fontSize: 11, color: sub, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.4px", margin: 0 }}>Amount</p>
              <button
                onClick={handleMax}
                disabled={availableDisplay <= 0}
                style={{
                  fontSize: 11, fontWeight: 700, color: "#10b981", background: "none",
                  border: "none", cursor: availableDisplay > 0 ? "pointer" : "not-allowed",
                  opacity: availableDisplay > 0 ? 1 : 0.4, padding: "2px 4px",
                }}
              >
                Use Max
              </button>
            </div>
            <div style={{ position: "relative" }}>
              <span style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", fontSize: 16, fontWeight: 700, color: sub }}>{symbol}</span>
              <input className="input-dark" type="number" placeholder="0.00" value={amount} onChange={e => { setAmount(e.target.value); setErr(""); }} style={{ paddingLeft: 28, fontSize: 18, fontWeight: 700 }} />
            </div>
            <p style={{ fontSize: 11, color: sub, margin: "5px 0 0" }}>
              Balance: {fmt(balance)} · Minimum {symbol}{minWithdraw.toLocaleString()}
            </p>
          </div>

          <div style={{ marginBottom: 14 }}>
            <p style={{ fontSize: 11, color: sub, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.4px", marginBottom: 7 }}>Destination Address (Polygon)</p>
            <div style={{ position: "relative" }}>
              <input
                className="input-dark"
                type="text"
                placeholder="0x..."
                value={address}
                onChange={e => { setAddress(e.target.value); setErr(""); }}
                style={{ fontSize: 13, fontFamily: "monospace", paddingRight: 30 }}
              />
              {address.trim() && (
                <span style={{ position: "absolute", right: 11, top: "50%", transform: "translateY(-50%)" }}>
                  {addressValid
                    ? <CheckCircle2 size={15} color="#10b981" />
                    : <AlertCircle size={15} color="#8b8fa8" />}
                </span>
              )}
            </div>
            <p style={{ fontSize: 11, color: sub, margin: "5px 0 0" }}>
              Double-check this address — withdrawals to a wrong address can&apos;t be recovered.
            </p>
            {err && <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6 }}><AlertCircle size={13} color="#ef4444" /><span style={{ fontSize: 12, color: "#ef4444" }}>{err}</span></div>}
          </div>

          <button className="btn-emerald" onClick={handleSubmit} disabled={submitting || !amount || !address} style={{ width: "100%", fontSize: 15, padding: "13px", borderRadius: 10 }}>
            {submitting ? "Submitting…" : "Request Withdrawal"}
          </button>
        </>
      )}

      {history.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <p style={{ fontSize: 11, color: sub, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.4px", marginBottom: 8 }}>Recent Requests</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 160, overflowY: "auto" }}>
            {history.slice(0, 5).map(r => (
              <div key={r.id} style={{ display: "flex", flexDirection: "column", gap: 4, padding: "8px 10px", borderRadius: 8, border: `1px solid ${border}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 12, color: isDark ? "#f0f2f5" : "#0f172a", fontWeight: 600 }}>{fmt(r.amount)}</span>
                  <span style={{
                    fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 20, textTransform: "uppercase",
                    background: `${STATUS_COLORS[r.status]}18`, color: STATUS_COLORS[r.status],
                  }}>
                    {r.status}
                  </span>
                </div>
                {r.status === "completed" && r.txHash && (
                  <a
                    href={`${EXPLORER_BASE}/tx/${r.txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, color: "#10b981", textDecoration: "none" }}
                  >
                    View transaction <ExternalLink size={10} />
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Deposit Modal ─────────────────────────────────────────────────
function DepositModal({ onClose, isDark }: { onClose: () => void; isDark: boolean }) {
  const { balance, depositFunds } = useStore();
  const { fmt, minStake, symbol, quickStakes, toCredits } = useCurrency();
  const [tab, setTab]       = useState<"demo" | "crypto" | "withdraw">("demo");
  const [amount, setAmount] = useState("");
  const [done, setDone]     = useState(false);
  const [err, setErr]       = useState("");
  const presets = quickStakes;

  const handleDeposit = async () => {
    const amt = parseFloat(amount); // display currency
    if (!amt || amt < minStake) { setErr(`Minimum deposit is ${symbol}${minStake.toLocaleString()}`); return; }
    const ok = await depositFunds(toCredits(amt)); // convert to credits for API
    if (ok) { setDone(true); setTimeout(onClose, 1800); }
    else setErr("Deposit failed. Please try again.");
  };

  const bg = isDark ? "#1a1d27" : "#ffffff";
  const border = isDark ? "#2a2d3a" : "#e2e8f0";
  const text = isDark ? "#f0f2f5" : "#0f172a";
  const sub = isDark ? "#8b8fa8" : "#64748b";

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 500, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} className="fade-in" style={{ background: bg, border: `1px solid ${border}`, borderRadius: 16, padding: 28, width: "100%", maxWidth: 380, boxShadow: "0 24px 64px rgba(0,0,0,0.4)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 38, height: 38, borderRadius: 10, background: "linear-gradient(135deg, #10b981, #059669)", display: "flex", alignItems: "center", justifyContent: "center" }}><Wallet size={18} color="white" /></div>
            <div>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: text, margin: 0 }}>{tab === "withdraw" ? "Withdraw Funds" : "Deposit Funds"}</h2>
              <p style={{ fontSize: 12, color: sub, margin: 0 }}>
                {tab === "demo" ? "Simulation only" : tab === "crypto" ? "Real Polygon USDT/USDC" : "Reviewed by admin before sending"}
              </p>
            </div>
          </div>
          <button onClick={onClose} style={{ width: 30, height: 30, borderRadius: 8, background: isDark ? "#1f2333" : "#f1f5f9", border: `1px solid ${border}`, color: sub, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><X size={15} /></button>
        </div>

        <div style={{ display: "flex", gap: 4, padding: 4, borderRadius: 10, background: isDark ? "#12141c" : "#f1f5f9", marginBottom: 18 }}>
          {([["demo", "Demo"], ["crypto", "Crypto"], ["withdraw", "Withdraw"]] as const).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              style={{
                flex: 1, padding: "8px", borderRadius: 7, fontSize: 13, fontWeight: 700, cursor: "pointer",
                border: "none", transition: "all 0.15s",
                background: tab === key ? (isDark ? "#1a1d27" : "#ffffff") : "transparent",
                color: tab === key ? "#10b981" : sub,
                boxShadow: tab === key ? "0 1px 3px rgba(0,0,0,0.15)" : "none",
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === "crypto" ? (
          <CryptoDepositTab isDark={isDark} />
        ) : tab === "withdraw" ? (
          <WithdrawTab isDark={isDark} />
        ) : (
        <>
        <div style={{ padding: "10px 14px", borderRadius: 10, marginBottom: 18, background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)", display: "flex", justifyContent: "space-between" }}>
          <span style={{ fontSize: 13, color: sub }}>Balance</span>
          <span style={{ fontSize: 15, fontWeight: 700, color: "#10b981" }}>{fmt(balance)}</span>
        </div>
        {done ? (
          <div className="fade-in" style={{ textAlign: "center", padding: "20px 0" }}>
            <CheckCircle2 size={40} color="#10b981" style={{ margin: "0 auto 10px" }} />
            <p style={{ fontSize: 15, fontWeight: 700, color: "#10b981", margin: 0 }}>{symbol}{parseFloat(amount).toLocaleString()} deposited!</p>
          </div>
        ) : (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 14 }}>
              {presets.map(p => (
                <button key={p} onClick={() => { setAmount(String(p)); setErr(""); }} style={{ padding: "10px", borderRadius: 9, fontSize: 14, fontWeight: 600, cursor: "pointer", border: "1px solid", borderColor: amount === String(p) ? "#10b981" : border, background: amount === String(p) ? "rgba(16,185,129,0.12)" : isDark ? "#1f2333" : "#f8fafc", color: amount === String(p) ? "#10b981" : sub, transition: "all 0.15s" }}>
                  +{symbol}{p.toLocaleString()}
                </button>
              ))}
            </div>
            <div style={{ marginBottom: 14 }}>
              <p style={{ fontSize: 11, color: sub, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.4px", marginBottom: 7 }}>Custom Amount</p>
              <div style={{ position: "relative" }}>
                <span style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", fontSize: 16, fontWeight: 700, color: sub }}>{symbol}</span>
                <input className="input-dark" type="number" placeholder="0.00" value={amount} onChange={e => { setAmount(e.target.value); setErr(""); }} onKeyDown={e => e.key === "Enter" && handleDeposit()} style={{ paddingLeft: 28, fontSize: 18, fontWeight: 700 }} />
              </div>
              {err && <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6 }}><AlertCircle size={13} color="#ef4444" /><span style={{ fontSize: 12, color: "#ef4444" }}>{err}</span></div>}
            </div>
            <button className="btn-emerald" onClick={handleDeposit} disabled={!amount || parseFloat(amount) <= 0} style={{ width: "100%", fontSize: 15, padding: "13px", borderRadius: 10 }}>
              Deposit {amount && parseFloat(amount) > 0 ? `${symbol}${parseFloat(amount).toLocaleString()}` : ""}
            </button>
          </>
        )}
        </>
        )}
      </div>
    </div>
  );
}

// ── Navbar ────────────────────────────────────────────────────────
export default function Navbar() {
  const { balance, searchQuery, setSearchQuery, userProfile, isLoggedIn, userLogout, setDisplayCurrency } = useStore();
  const { theme, toggleTheme } = useTheme();
  const { fmt, fmtUSD, currencyCode } = useCurrency();
  const [showProfile, setShowProfile] = useState(false);
  const [mobileOpen,  setMobileOpen]  = useState(false);
  const [searchOpen,  setSearchOpen]  = useState(false);
  const [showDeposit, setShowDeposit] = useState(false);
  const [showWalletModal, setShowWalletModal] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);
  const isDark = theme === "dark";

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setShowProfile(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [mobileOpen]);

  const navBg         = isDark ? "#13161e" : "#ffffff";
  const navBorder     = isDark ? "#2a2d3a" : "#e2e8f0";
  const textPrimary   = isDark ? "#f0f2f5" : "#0f172a";
  const textSecondary = isDark ? "#8b8fa8" : "#64748b";
  const inputBg       = isDark ? "#0d0f14" : "#f4f6fb";
  const inputBorder   = isDark ? "#2a2d3a" : "#e2e8f0";
  const dropdownBg    = isDark ? "#1a1d27" : "#ffffff";
  const dropdownBorder= isDark ? "#2a2d3a" : "#e2e8f0";
  const iconBg        = isDark ? "#1f2333" : "#f1f5f9";
  const iconBorder    = isDark ? "#2a2d3a" : "#e2e8f0";

  const initials   = userProfile.name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
  const regionFlag = REGION_OPTIONS.find(r => r.value === userProfile.region)?.flag ?? "🌍";
  const isDemo     = userProfile.bio?.includes("Demo Account");

  return (
    <>
      {showDeposit     && <DepositModal onClose={() => setShowDeposit(false)} isDark={isDark} />}
      {showWalletModal && <WalletConnectModal onClose={() => setShowWalletModal(false)} />}

      <nav style={{ background: navBg, borderBottom: `1px solid ${navBorder}`, position: "sticky", top: 0, zIndex: 100, transition: "background 0.25s, border-color 0.25s" }}>
        <div style={{ maxWidth: 1400, margin: "0 auto", padding: "0 16px", height: 60, display: "flex", alignItems: "center", gap: 12 }}>

          {/* Hamburger */}
          <button className="show-mobile" onClick={() => setMobileOpen(true)} style={{ display: "none", width: 36, height: 36, borderRadius: 8, background: iconBg, border: `1px solid ${iconBorder}`, alignItems: "center", justifyContent: "center", cursor: "pointer", color: textSecondary, flexShrink: 0 }}>
            <Menu size={18} />
          </button>

          {/* Logo */}
          <Link href="/" style={{ textDecoration: "none", flexShrink: 0, display: "flex" }}>
            <Logo size={30} textColor={textPrimary} />
          </Link>

          {/* Search */}
          <div className="hide-mobile" style={{ flex: 1, maxWidth: 440, position: "relative" }}>
            <Search size={15} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: textSecondary }} />
            <input className="input-dark" style={{ paddingLeft: 36, fontSize: 14, background: inputBg, borderColor: inputBorder, color: textPrimary }} placeholder="Search markets..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
          </div>

          {/* Mobile search */}
          <button className="show-mobile" onClick={() => setSearchOpen(!searchOpen)} style={{ display: "none", width: 36, height: 36, borderRadius: 8, background: iconBg, border: `1px solid ${iconBorder}`, alignItems: "center", justifyContent: "center", cursor: "pointer", color: textSecondary, marginLeft: "auto" }}>
            <Search size={16} />
          </button>

          {/* Right side */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginLeft: "auto" }}>

            {isLoggedIn ? (
              /* ── LOGGED IN ── */
              <>
                {/* Balance + deposit — hidden on mobile; the drawer's header
                    already shows balance + a Deposit button, so this would
                    just be a duplicate fighting for the same cramped row. */}
                <div className="hide-mobile" style={{ display: "flex", alignItems: "center" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.3)", borderRadius: "8px 0 0 8px", padding: "6px 12px", borderRight: "none" }}>
                    <Wallet size={14} color="#10b981" />
                    <span style={{ color: "#10b981", fontWeight: 700, fontSize: 13 }}>{fmtUSD(balance)}</span>
                  </div>
                  <button onClick={() => setShowDeposit(true)} title="Deposit" style={{ height: 34, width: 30, background: "#10b981", border: "1px solid #10b981", borderRadius: "0 8px 8px 0", color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "background 0.15s", flexShrink: 0 }}
                    onMouseEnter={e => (e.currentTarget.style.background = "#059669")}
                    onMouseLeave={e => (e.currentTarget.style.background = "#10b981")}>
                    <Plus size={15} strokeWidth={2.5} />
                  </button>
                </div>

                {/* Mobile: compact deposit-only shortcut, since the balance+deposit
                    pill above is hidden and the drawer takes an extra tap. */}
                <button className="show-mobile" onClick={() => setShowDeposit(true)} title="Deposit" aria-label="Deposit" style={{ display: "none", width: 36, height: 36, borderRadius: 8, background: "#10b981", border: "1px solid #10b981", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#fff", flexShrink: 0 }}>
                  <Plus size={17} strokeWidth={2.5} />
                </button>

                {/* Theme — hidden on mobile, duplicated in the drawer's
                    Dark/Light Mode toggle. */}
                <button onClick={toggleTheme} aria-label="Toggle theme" className="hide-mobile" style={{ width: 36, height: 36, borderRadius: 8, background: iconBg, border: `1px solid ${iconBorder}`, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: textSecondary }}>
                  {isDark ? <Sun size={16} /> : <Moon size={16} />}
                </button>

                {/* Notifications stay visible on mobile — time-sensitive,
                    not duplicated anywhere in the drawer. */}
                <NotificationBell />

                {/* Avatar dropdown — hidden on mobile, duplicated by the
                    drawer's header (avatar/name/balance) + My Profile link. */}
                <div ref={profileRef} className="hide-mobile" style={{ position: "relative" }}>
                  <button onClick={() => setShowProfile(!showProfile)} style={{ width: 36, height: 36, borderRadius: "50%", background: userProfile.avatar ? "transparent" : "linear-gradient(135deg, #10b981, #059669)", border: `2px solid ${iconBorder}`, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", overflow: "hidden", padding: 0 }}>
                    {userProfile.avatar
                      ? <img src={userProfile.avatar} alt="avatar" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      : <span style={{ fontSize: 13, fontWeight: 800, color: "#fff" }}>{initials}</span>}
                  </button>

                  {showProfile && (
                    <div className="fade-in" style={{ position: "absolute", right: 0, top: 44, background: dropdownBg, border: `1px solid ${dropdownBorder}`, borderRadius: 12, padding: 8, minWidth: 200, zIndex: 200, boxShadow: "0 8px 32px rgba(0,0,0,0.2)" }}>
                      {/* User info */}
                      <div style={{ padding: "8px 12px 10px", borderBottom: `1px solid ${dropdownBorder}`, marginBottom: 4 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                          <span style={{ fontSize: 16 }}>{regionFlag}</span>
                          <p style={{ fontSize: 13, fontWeight: 600, color: textPrimary, margin: 0 }}>{userProfile.name}</p>
                        </div>
                        <p style={{ fontSize: 11, color: textSecondary, margin: 0 }}>@{userProfile.username}</p>
                        {isDemo && (
                          <span style={{ display: "inline-block", marginTop: 4, fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 20, background: "rgba(245,158,11,0.15)", color: "#f59e0b", border: "1px solid rgba(245,158,11,0.3)" }}>
                            DEMO ACCOUNT
                          </span>
                        )}
                      </div>

                      {/* Display currency toggle */}
                      <div style={{ display: "flex", gap: 4, padding: "4px 8px 8px" }}>
                        {(Object.keys(DISPLAY_CURRENCIES) as DisplayCurrencyCode[]).map((code) => {
                          const active = currencyCode === code;
                          return (
                            <button key={code} onClick={() => setDisplayCurrency(code)} style={{
                              flex: 1, padding: "5px 0", borderRadius: 6, cursor: "pointer",
                              border: `1px solid ${active ? "var(--emerald)" : dropdownBorder}`,
                              background: active ? "var(--emerald-bg)" : "transparent",
                              color: active ? "var(--emerald)" : textSecondary,
                              fontSize: 11, fontWeight: 700, transition: "all 0.15s",
                            }}>
                              {DISPLAY_CURRENCIES[code].symbol} {code}
                            </button>
                          );
                        })}
                      </div>
                      {[
                        { href: "/profile",   label: "My Profile",   icon: <UserCircle size={14} /> },
                        { href: "/portfolio", label: "My Portfolio", icon: <BarChart2 size={14} /> },
                      ].map(({ href, label, icon }) => (
                        <Link key={href} href={href} onClick={() => setShowProfile(false)}
                          style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 12px", color: textPrimary, textDecoration: "none", borderRadius: 8, fontSize: 14, transition: "background 0.15s" }}
                          onMouseEnter={e => (e.currentTarget.style.background = isDark ? "#1f2333" : "#f1f5f9")}
                          onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                          <span style={{ color: textSecondary }}>{icon}</span>
                          {label}
                          <ChevronRight size={12} style={{ marginLeft: "auto", color: textSecondary }} />
                        </Link>
                      ))}
                      <div style={{ borderTop: `1px solid ${dropdownBorder}`, margin: "6px 4px 4px" }} />
                      <button onClick={() => { void userLogout(); setShowProfile(false); }}                        style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "9px 12px", color: "var(--red)", background: "none", border: "none", borderRadius: 8, fontSize: 14, cursor: "pointer", transition: "background 0.15s" }}
                        onMouseEnter={e => (e.currentTarget.style.background = "var(--red-bg)")}
                        onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                        <LogOut size={14} /> Log Out
                      </button>
                    </div>
                  )}
                </div>
              </>
            ) : (
              /* ── LOGGED OUT ── */
              <>
                {/* Theme */}
                <button onClick={toggleTheme} aria-label="Toggle theme" style={{ width: 36, height: 36, borderRadius: 8, background: iconBg, border: `1px solid ${iconBorder}`, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: textSecondary }}>
                  {isDark ? <Sun size={16} /> : <Moon size={16} />}
                </button>
                {/* Auth buttons */}
                <Link href="/login" className="hide-mobile" style={{ padding: "7px 16px", borderRadius: 8, fontSize: 14, fontWeight: 600, background: iconBg, border: `1px solid ${iconBorder}`, color: textPrimary, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, textDecoration: "none" }}>
                  <LogIn size={14} /> Log In
                </Link>
                <Link href="/register" className="hide-mobile" style={{ padding: "7px 16px", borderRadius: 8, fontSize: 14, fontWeight: 700, background: "var(--emerald)", color: "#fff", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, textDecoration: "none" }}>
                  <UserPlus size={14} /> Sign Up
                </Link>
                {/* Mobile: just avatar icon → goes to login */}
                <Link href="/login" className="show-mobile" style={{ display: "none", width: 36, height: 36, borderRadius: "50%", background: iconBg, border: `1px solid ${iconBorder}`, alignItems: "center", justifyContent: "center", cursor: "pointer", color: textSecondary }}>
                  <UserCircle size={18} />
                </Link>
              </>
            )}
          </div>
        </div>

        {/* Mobile search expand */}
        {searchOpen && (
          <div className="show-mobile fade-in" style={{ display: "none", padding: "0 16px 12px", background: navBg, borderBottom: `1px solid ${navBorder}` }}>
            <div style={{ position: "relative" }}>
              <Search size={15} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: textSecondary }} />
              <input className="input-dark" autoFocus style={{ paddingLeft: 36, fontSize: 14, background: inputBg, borderColor: inputBorder, color: textPrimary }} placeholder="Search markets..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
            </div>
          </div>
        )}
      </nav>

      {/* Mobile drawer */}
      {mobileOpen && (
        <>
          <div className="mobile-menu-overlay" onClick={() => setMobileOpen(false)} />
          <div className="mobile-menu-drawer">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
              <Logo size={26} textColor={textPrimary} />
              <button onClick={() => setMobileOpen(false)} style={{ width: 32, height: 32, borderRadius: 8, background: iconBg, border: `1px solid ${iconBorder}`, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: textSecondary }}><X size={16} /></button>
            </div>

            {isLoggedIn ? (
              /* Logged-in drawer header */
              <div style={{ display: "flex", alignItems: "center", gap: 10, background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.3)", borderRadius: 10, padding: "12px 14px", marginBottom: 20 }}>
                <div style={{ width: 38, height: 38, borderRadius: "50%", flexShrink: 0, background: userProfile.avatar ? "transparent" : "linear-gradient(135deg, #10b981, #059669)", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
                  {userProfile.avatar ? <img src={userProfile.avatar} alt="avatar" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span style={{ fontSize: 14, fontWeight: 800, color: "#fff" }}>{initials}</span>}
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 13, fontWeight: 700, color: textPrimary, margin: 0 }}>{userProfile.name}</p>
                  <p style={{ fontSize: 12, color: "#10b981", margin: 0, fontWeight: 600 }}>{fmtUSD(balance)}</p>
                </div>
                <button onClick={() => { setMobileOpen(false); setShowDeposit(true); }} style={{ display: "flex", alignItems: "center", gap: 5, padding: "7px 12px", borderRadius: 8, background: "#10b981", border: "none", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer", flexShrink: 0 }}>
                  <Plus size={13} /> Deposit
                </button>
              </div>
            ) : (
              /* Logged-out drawer header */
              <div style={{ marginBottom: 20 }}>
                <p style={{ fontSize: 14, color: textSecondary, marginBottom: 12 }}>Sign in to start trading</p>
                <div style={{ display: "flex", gap: 8 }}>
                  <Link href="/login" onClick={() => setMobileOpen(false)} style={{ flex: 1, textAlign: "center", padding: "11px", borderRadius: 10, fontSize: 14, fontWeight: 600, background: iconBg, color: textPrimary, border: `1px solid ${iconBorder}`, cursor: "pointer", textDecoration: "none", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                    <LogIn size={14} /> Log In
                  </Link>
                  <Link href="/register" onClick={() => setMobileOpen(false)} style={{ flex: 1, textAlign: "center", padding: "11px", borderRadius: 10, fontSize: 14, fontWeight: 700, background: "var(--emerald)", color: "#fff", border: "none", cursor: "pointer", textDecoration: "none", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                    <UserPlus size={14} /> Sign Up
                  </Link>
                </div>
                <button onClick={() => { setMobileOpen(false); setShowWalletModal(true); }} style={{ width: "100%", marginTop: 8, textAlign: "center", padding: "9px", borderRadius: 10, fontSize: 13, fontWeight: 600, background: "transparent", color: textSecondary, border: `1px solid ${iconBorder}`, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                  <Wallet size={13} /> Connect Wallet instead
                </button>
              </div>
            )}

            <nav style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {[
                { href: "/", label: "Markets", icon: <TrendingUp size={16} />, authRequired: false },
                ...(isLoggedIn ? [
                  { href: "/profile",   label: "My Profile",   icon: <UserCircle size={16} />, authRequired: true },
                  { href: "/portfolio", label: "My Portfolio", icon: <BarChart2 size={16} />,  authRequired: true },
                ] : []),
              ].map(({ href, label, icon }) => (
                <Link key={href} href={href} onClick={() => setMobileOpen(false)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", borderRadius: 10, color: textPrimary, textDecoration: "none", fontSize: 15, fontWeight: 500, background: isDark ? "#1f2333" : "#f1f5f9", border: `1px solid ${navBorder}` }}>
                  <span style={{ color: "#10b981" }}>{icon}</span>
                  {label}
                  <ChevronRight size={14} style={{ marginLeft: "auto", color: textSecondary }} />
                </Link>
              ))}
              {isLoggedIn && (
                <button onClick={() => { void userLogout(); setMobileOpen(false); }} style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", borderRadius: 10, color: "var(--red)", background: "var(--red-bg)", border: "1px solid var(--red-border)", fontSize: 15, fontWeight: 500, cursor: "pointer", width: "100%", textAlign: "left" }}>
                  <LogOut size={16} /> Log Out
                </button>
              )}
            </nav>

            {/* Display currency — only reachable here on mobile, since the
                desktop profile dropdown that normally holds this is hidden. */}
            {isLoggedIn && (
              <div style={{ marginTop: 14, padding: "12px 14px", background: isDark ? "#1f2333" : "#f1f5f9", borderRadius: 10, border: `1px solid ${navBorder}` }}>
                <p style={{ fontSize: 11, color: textSecondary, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.4px", margin: "0 0 8px" }}>
                  Display Currency
                </p>
                <div style={{ display: "flex", gap: 6 }}>
                  {(Object.keys(DISPLAY_CURRENCIES) as DisplayCurrencyCode[]).map((code) => {
                    const active = currencyCode === code;
                    return (
                      <button key={code} onClick={() => setDisplayCurrency(code)} style={{
                        flex: 1, padding: "8px 0", borderRadius: 8, cursor: "pointer",
                        border: `1px solid ${active ? "var(--emerald)" : navBorder}`,
                        background: active ? "var(--emerald-bg)" : "transparent",
                        color: active ? "var(--emerald)" : textSecondary,
                        fontSize: 12, fontWeight: 700, transition: "all 0.15s",
                      }}>
                        {DISPLAY_CURRENCIES[code].symbol} {code}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div style={{ marginTop: 14, padding: "14px", background: isDark ? "#1f2333" : "#f1f5f9", borderRadius: 10, border: `1px solid ${navBorder}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {isDark ? <Moon size={16} color={textSecondary} /> : <Sun size={16} color={textSecondary} />}
                <span style={{ fontSize: 14, color: textPrimary, fontWeight: 500 }}>{isDark ? "Dark Mode" : "Light Mode"}</span>
              </div>
              <button className="theme-toggle" data-on={String(isDark)} onClick={toggleTheme} aria-label="Toggle theme" />
            </div>
          </div>
        </>
      )}
    </>
  );
}
