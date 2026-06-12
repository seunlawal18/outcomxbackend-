"use client";
import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useStore } from "@/lib/store";
import { useTheme } from "@/lib/themeStore";
import { useCurrency } from "@/lib/useCurrency";
import { REGION_CURRENCIES, Region } from "@/lib/currency";
import LoginRequiredModal from "./LoginRequiredModal";
import NotificationBell from "./NotificationBell";
import {
  Search, Wallet, TrendingUp, Sun, Moon,
  Menu, X, BarChart2, ChevronRight, UserCircle,
  Plus, CheckCircle2, AlertCircle, LogOut, LogIn, UserPlus,
} from "lucide-react";

// ── Deposit Modal ─────────────────────────────────────────────────
function DepositModal({ onClose, isDark }: { onClose: () => void; isDark: boolean }) {
  const { balance, depositFunds } = useStore();
  const { fmt, minStake, symbol, cfg } = useCurrency();
  const [amount, setAmount] = useState("");
  const [done, setDone]     = useState(false);
  const [err, setErr]       = useState("");
  const presets = [cfg.minStake * 2, cfg.minStake * 10, cfg.minStake * 20, cfg.startBalance];

  const handleDeposit = async () => {
    const amt = parseFloat(amount);
    if (!amt || amt < minStake) { setErr(`Minimum deposit is ${symbol}${minStake.toLocaleString()}`); return; }
    if (amt > cfg.startBalance * 200) { setErr(`Max single deposit is ${symbol}${(cfg.startBalance * 200).toLocaleString()}`); return; }
    const ok = await depositFunds(amt);
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
            <div><h2 style={{ fontSize: 16, fontWeight: 700, color: text, margin: 0 }}>Deposit Funds</h2><p style={{ fontSize: 12, color: sub, margin: 0 }}>Simulation only</p></div>
          </div>
          <button onClick={onClose} style={{ width: 30, height: 30, borderRadius: 8, background: isDark ? "#1f2333" : "#f1f5f9", border: `1px solid ${border}`, color: sub, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><X size={15} /></button>
        </div>
        <div style={{ padding: "10px 14px", borderRadius: 10, marginBottom: 18, background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)", display: "flex", justifyContent: "space-between" }}>
          <span style={{ fontSize: 13, color: sub }}>Balance</span>
          <span style={{ fontSize: 15, fontWeight: 700, color: "#10b981" }}>{fmt(balance)}</span>
        </div>
        {done ? (
          <div className="fade-in" style={{ textAlign: "center", padding: "20px 0" }}>
            <CheckCircle2 size={40} color="#10b981" style={{ margin: "0 auto 10px" }} />
            <p style={{ fontSize: 15, fontWeight: 700, color: "#10b981", margin: 0 }}>{fmt(parseFloat(amount))} deposited!</p>
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
      </div>
    </div>
  );
}

// ── Navbar ────────────────────────────────────────────────────────
export default function Navbar() {
  const { balance, searchQuery, setSearchQuery, userProfile, isLoggedIn, userLogout } = useStore();
  const { theme, toggleTheme } = useTheme();
  const { fmt } = useCurrency();
  const [showProfile, setShowProfile] = useState(false);
  const [mobileOpen,  setMobileOpen]  = useState(false);
  const [searchOpen,  setSearchOpen]  = useState(false);
  const [showDeposit, setShowDeposit] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
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
  const regionFlag = REGION_CURRENCIES[(userProfile.region || "nigeria") as Region]?.flag ?? "🌍";
  const isDemo     = userProfile.bio?.includes("Demo Account");

  return (
    <>
      {showDeposit    && <DepositModal onClose={() => setShowDeposit(false)} isDark={isDark} />}
      {showLoginModal && <LoginRequiredModal onClose={() => setShowLoginModal(false)} />}

      <nav style={{ background: navBg, borderBottom: `1px solid ${navBorder}`, position: "sticky", top: 0, zIndex: 100, transition: "background 0.25s, border-color 0.25s" }}>
        <div style={{ maxWidth: 1400, margin: "0 auto", padding: "0 16px", height: 60, display: "flex", alignItems: "center", gap: 12 }}>

          {/* Hamburger */}
          <button className="show-mobile" onClick={() => setMobileOpen(true)} style={{ display: "none", width: 36, height: 36, borderRadius: 8, background: iconBg, border: `1px solid ${iconBorder}`, alignItems: "center", justifyContent: "center", cursor: "pointer", color: textSecondary, flexShrink: 0 }}>
            <Menu size={18} />
          </button>

          {/* Logo */}
          <Link href="/" style={{ textDecoration: "none", flexShrink: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 32, height: 32, background: "linear-gradient(135deg, #10b981, #059669)", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <TrendingUp size={18} color="white" />
              </div>
              <span style={{ fontSize: 17, fontWeight: 800, color: textPrimary, letterSpacing: "-0.5px" }}>OUTCOMX</span>
            </div>
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
                {/* Balance + deposit */}
                <div style={{ display: "flex", alignItems: "center" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.3)", borderRadius: "8px 0 0 8px", padding: "6px 12px", borderRight: "none" }}>
                    <Wallet size={14} color="#10b981" />
                    <span style={{ color: "#10b981", fontWeight: 700, fontSize: 13 }}>{fmt(balance)}</span>
                  </div>
                  <button onClick={() => setShowDeposit(true)} title="Deposit" style={{ height: 34, width: 30, background: "#10b981", border: "1px solid #10b981", borderRadius: "0 8px 8px 0", color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "background 0.15s", flexShrink: 0 }}
                    onMouseEnter={e => (e.currentTarget.style.background = "#059669")}
                    onMouseLeave={e => (e.currentTarget.style.background = "#10b981")}>
                    <Plus size={15} strokeWidth={2.5} />
                  </button>
                </div>

                {/* Theme */}
                <button onClick={toggleTheme} aria-label="Toggle theme" style={{ width: 36, height: 36, borderRadius: 8, background: iconBg, border: `1px solid ${iconBorder}`, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: textSecondary }}>
                  {isDark ? <Sun size={16} /> : <Moon size={16} />}
                </button>

                {/* Avatar dropdown */}
                <NotificationBell />
                <div ref={profileRef} style={{ position: "relative" }}>
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
                      <button onClick={() => { userLogout(); setShowProfile(false); }}                        style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "9px 12px", color: "var(--red)", background: "none", border: "none", borderRadius: 8, fontSize: 14, cursor: "pointer", transition: "background 0.15s" }}
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
                <Link href="/login" className="hide-mobile" style={{ padding: "7px 16px", borderRadius: 8, fontSize: 14, fontWeight: 600, background: iconBg, border: `1px solid ${iconBorder}`, color: textPrimary, textDecoration: "none", display: "flex", alignItems: "center", gap: 6 }}>
                  <LogIn size={14} /> Log In
                </Link>
                <Link href="/register" className="hide-mobile" style={{ padding: "7px 16px", borderRadius: 8, fontSize: 14, fontWeight: 700, background: "var(--emerald)", color: "#fff", textDecoration: "none", display: "flex", alignItems: "center", gap: 6 }}>
                  <UserPlus size={14} /> Sign Up
                </Link>
                {/* Mobile: just avatar icon */}
                <button className="show-mobile" onClick={() => setShowLoginModal(true)} style={{ display: "none", width: 36, height: 36, borderRadius: "50%", background: iconBg, border: `1px solid ${iconBorder}`, alignItems: "center", justifyContent: "center", cursor: "pointer", color: textSecondary }}>
                  <UserCircle size={18} />
                </button>
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
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 28, height: 28, borderRadius: 7, background: "linear-gradient(135deg, #10b981, #059669)", display: "flex", alignItems: "center", justifyContent: "center" }}><TrendingUp size={15} color="white" /></div>
                <span style={{ fontSize: 16, fontWeight: 800, color: textPrimary }}>OUTCOMX</span>
              </div>
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
                  <p style={{ fontSize: 12, color: "#10b981", margin: 0, fontWeight: 600 }}>{fmt(balance)}</p>
                </div>
                <button onClick={() => { setMobileOpen(false); setShowDeposit(true); }} style={{ display: "flex", alignItems: "center", gap: 5, padding: "7px 12px", borderRadius: 8, background: "#10b981", border: "none", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer", flexShrink: 0 }}>
                  <Plus size={13} /> Deposit
                </button>
              </div>
            ) : (
              /* Logged-out drawer header */
              <div style={{ marginBottom: 20 }}>
                <p style={{ fontSize: 14, color: textSecondary, marginBottom: 12 }}>Join OUTCOMX to start trading</p>
                <div style={{ display: "flex", gap: 8 }}>
                  <Link href="/login" onClick={() => setMobileOpen(false)} style={{ flex: 1, textAlign: "center", padding: "11px", borderRadius: 10, fontSize: 14, fontWeight: 600, background: iconBg, border: `1px solid ${navBorder}`, color: textPrimary, textDecoration: "none" }}>Log In</Link>
                  <Link href="/register" onClick={() => setMobileOpen(false)} style={{ flex: 1, textAlign: "center", padding: "11px", borderRadius: 10, fontSize: 14, fontWeight: 700, background: "var(--emerald)", color: "#fff", textDecoration: "none" }}>Sign Up</Link>
                </div>
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
                <button onClick={() => { userLogout(); setMobileOpen(false); }} style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", borderRadius: 10, color: "var(--red)", background: "var(--red-bg)", border: "1px solid var(--red-border)", fontSize: 15, fontWeight: 500, cursor: "pointer", width: "100%", textAlign: "left" }}>
                  <LogOut size={16} /> Log Out
                </button>
              )}
            </nav>

            <div style={{ marginTop: 20, padding: "14px", background: isDark ? "#1f2333" : "#f1f5f9", borderRadius: 10, border: `1px solid ${navBorder}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
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
