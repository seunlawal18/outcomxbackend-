"use client";
import { useState, useRef } from "react";
import Link from "next/link";
import { useStore } from "@/lib/store";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useCurrency } from "@/lib/useCurrency";
import { parseApiDate } from "@/lib/types";
import AuthGuard from "@/components/AuthGuard";
import {
  ArrowLeft, Camera, Edit3, Save, X, TrendingUp,
  TrendingDown, Clock, Wallet, BarChart2, Award,
  Calendar, User, AtSign, FileText, CheckCircle2,
} from "lucide-react";

export default function ProfilePage() {
  return (
    <AuthGuard>
      <ProfileContent />
    </AuthGuard>
  );
}

function ProfileContent() {
  const { userProfile, updateProfile, balance, trades, markets } = useStore();
  const { fmt, fmtUSD, cfg, toLocal } = useCurrency();
  const [editing, setEditing]   = useState(false);
  const [name, setName]         = useState(userProfile.name);
  const [username, setUsername] = useState(userProfile.username);
  const [bio, setBio]           = useState(userProfile.bio);
  const [saved, setSaved]       = useState(false);
  const fileInputRef            = useRef<HTMLInputElement>(null);

  const wonTrades     = trades.filter((t) => t.status === "won");
  const lostTrades    = trades.filter((t) => t.status === "lost");
  const activeTrades  = trades.filter((t) => t.status === "active");
  const totalInvested = trades.reduce((s, t) => s + t.amount, 0);
  const settled       = trades.filter((t) => t.status !== "active");
  const winRate       = settled.length > 0 ? Math.round((wonTrades.length / settled.length) * 100) : 0;
  const recentTrades  = trades.slice(0, 5);

  const catCounts: Record<string, number> = {};
  trades.forEach((t) => {
    const m = markets.find((mk) => mk.id === t.marketId);
    if (m) catCounts[m.category] = (catCounts[m.category] || 0) + 1;
  });
  const topCats = Object.entries(catCounts).sort((a, b) => b[1] - a[1]).slice(0, 3);
  const initials = userProfile.name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);

  const handleSave = () => {
    updateProfile({ name: name.trim() || userProfile.name, username: username.trim() || userProfile.username, bio });
    setEditing(false); setSaved(true); setTimeout(() => setSaved(false), 2500);
  };
  const handleCancel = () => { setName(userProfile.name); setUsername(userProfile.username); setBio(userProfile.bio); setEditing(false); };
  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || file.size > 2 * 1024 * 1024) return;
    const reader = new FileReader();
    reader.onload = (ev) => updateProfile({ avatar: ev.target?.result as string });
    reader.readAsDataURL(file);
  };

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-primary)", display: "flex", flexDirection: "column" }}>
      <Navbar />
      <main style={{ flex: 1, maxWidth: 900, margin: "0 auto", width: "100%", padding: "24px 16px 48px" }}>

        <Link href="/" style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "var(--text-secondary)", textDecoration: "none", fontSize: 14, marginBottom: 24 }}>
          <ArrowLeft size={15} /> Back to Markets
        </Link>

        {/* Profile header */}
        <div className="card" style={{ padding: 0, overflow: "hidden", marginBottom: 20 }}>
          <div style={{ height: 100, background: "linear-gradient(135deg, #059669 0%, #0d9488 40%, #0891b2 100%)" }} />
          <div style={{ padding: "0 24px 24px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 16 }}>
              {/* Avatar */}
              <div style={{ position: "relative", marginTop: -36 }}>
                <div onClick={() => !editing && fileInputRef.current?.click()} style={{
                  width: 72, height: 72, borderRadius: "50%", border: "3px solid var(--bg-card)",
                  background: userProfile.avatar ? "transparent" : "linear-gradient(135deg, #10b981, #059669)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  cursor: "pointer", overflow: "hidden", position: "relative", flexShrink: 0,
                }}>
                  {userProfile.avatar
                    ? <img src={userProfile.avatar} alt="avatar" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    : <span style={{ fontSize: 24, fontWeight: 800, color: "#fff" }}>{initials}</span>}
                  <div style={{ position: "absolute", inset: 0, borderRadius: "50%", background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", opacity: 0, transition: "opacity 0.2s" }}
                    onMouseEnter={e => (e.currentTarget.style.opacity = "1")}
                    onMouseLeave={e => (e.currentTarget.style.opacity = "0")}>
                    <Camera size={18} color="#fff" />
                  </div>
                </div>
                <input ref={fileInputRef} type="file" accept="image/*" onChange={handleAvatarChange} style={{ display: "none" }} />
              </div>

              {/* Edit buttons */}
              <div style={{ display: "flex", gap: 8 }}>
                {editing ? (
                  <>
                    <button onClick={handleCancel} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 8, fontSize: 13, fontWeight: 600, background: "var(--bg-card-hover)", border: "1px solid var(--border)", color: "var(--text-secondary)", cursor: "pointer" }}>
                      <X size={14} /> Cancel
                    </button>
                    <button onClick={handleSave} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 8, fontSize: 13, fontWeight: 600, background: "var(--emerald)", border: "none", color: "#fff", cursor: "pointer" }}>
                      <Save size={14} /> Save
                    </button>
                  </>
                ) : (
                  <button onClick={() => setEditing(true)} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 8, fontSize: 13, fontWeight: 600, background: "var(--bg-card-hover)", border: "1px solid var(--border)", color: "var(--text-primary)", cursor: "pointer" }}>
                    <Edit3 size={14} /> Edit Profile
                  </button>
                )}
              </div>
            </div>

            {saved && (
              <div className="fade-in" style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 14px", borderRadius: 8, marginBottom: 14, background: "var(--emerald-bg)", border: "1px solid var(--emerald-border)", color: "var(--emerald)", fontSize: 13, fontWeight: 600 }}>
                <CheckCircle2 size={15} /> Profile updated!
              </div>
            )}

            {editing ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                  <div style={{ flex: 1, minWidth: 180 }}>
                    <label style={{ fontSize: 11, color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: 5, marginBottom: 6, fontWeight: 600, textTransform: "uppercase" }}>
                      <User size={11} /> Display Name
                    </label>
                    <input className="input-dark" value={name} onChange={e => setName(e.target.value)} placeholder="Your name" />
                  </div>
                  <div style={{ flex: 1, minWidth: 180 }}>
                    <label style={{ fontSize: 11, color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: 5, marginBottom: 6, fontWeight: 600, textTransform: "uppercase" }}>
                      <AtSign size={11} /> Username
                    </label>
                    <input className="input-dark" value={username} onChange={e => setUsername(e.target.value.replace(/\s/g, "_"))} placeholder="username" />
                  </div>
                </div>
                <div>
                  <label style={{ fontSize: 11, color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: 5, marginBottom: 6, fontWeight: 600, textTransform: "uppercase" }}>
                    <FileText size={11} /> Bio
                  </label>
                  <textarea className="input-dark" value={bio} onChange={e => setBio(e.target.value)} placeholder="Tell us about yourself..." rows={3} maxLength={160} style={{ resize: "vertical", fontFamily: "inherit" }} />
                  <p style={{ fontSize: 11, color: "var(--text-muted)", textAlign: "right", marginTop: 4 }}>{bio.length}/160</p>
                </div>
              </div>
            ) : (
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 4 }}>
                  <h1 style={{ fontSize: 20, fontWeight: 800, color: "var(--text-primary)", margin: 0 }}>{userProfile.name}</h1>
                  <span style={{ fontSize: 14, color: "var(--text-secondary)" }}>@{userProfile.username}</span>
                </div>
                {userProfile.bio && <p style={{ fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.6, margin: "0 0 10px" }}>{userProfile.bio}</p>}
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <Calendar size={13} color="var(--text-muted)" />
                  <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                    Joined {parseApiDate(userProfile.joinedAt).toLocaleDateString("en-US", { month: "long", year: "numeric" })}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 12, marginBottom: 20 }}>
          {[
            { label: "Balance",      value: fmtUSD(balance),     color: "var(--emerald)", icon: <Wallet size={16} /> },            { label: "Total Trades", value: trades.length,       color: "#6366f1",        icon: <BarChart2 size={16} /> },
            { label: "Active",       value: activeTrades.length, color: "#f59e0b",        icon: <Clock size={16} /> },
            { label: "Won",          value: wonTrades.length,    color: "var(--emerald)", icon: <TrendingUp size={16} /> },
            { label: "Lost",         value: lostTrades.length,   color: "var(--red)",     icon: <TrendingDown size={16} /> },
            { label: "Win Rate",     value: `${winRate}%`,       color: "#6366f1",        icon: <Award size={16} /> },
          ].map((s) => (
            <div key={s.label} className="card" style={{ padding: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 8, color: s.color }}>
                {s.icon}
                <span style={{ fontSize: 11, color: "var(--text-secondary)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.4px" }}>{s.label}</span>
              </div>
              <p style={{ fontSize: 20, fontWeight: 800, color: s.color, margin: 0 }}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* Bottom columns */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>

          {/* Recent trades */}
          <div className="card" style={{ padding: 0, overflow: "hidden" }}>
            <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h2 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>Recent Trades</h2>
              <Link href="/portfolio" style={{ fontSize: 12, color: "var(--emerald)", textDecoration: "none" }}>View all →</Link>
            </div>
            {recentTrades.length === 0 ? (
              <div style={{ padding: "32px 18px", textAlign: "center", color: "var(--text-secondary)" }}>
                <BarChart2 size={28} style={{ margin: "0 auto 10px", opacity: 0.25 }} />
                <p style={{ fontSize: 13 }}>No trades yet</p>
                <Link href="/" style={{ fontSize: 13, color: "var(--emerald)" }}>Browse markets →</Link>
              </div>
            ) : recentTrades.map((t) => (
              <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 18px", borderBottom: "1px solid var(--border)" }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, flexShrink: 0, background: t.status === "won" ? "var(--emerald-bg)" : t.status === "lost" ? "var(--red-bg)" : "rgba(99,102,241,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {t.status === "won" ? <TrendingUp size={14} color="var(--emerald)" /> : t.status === "lost" ? <TrendingDown size={14} color="var(--red)" /> : <Clock size={14} color="#6366f1" />}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.marketTitle}</p>
                  <p style={{ fontSize: 11, color: "var(--text-secondary)", margin: "2px 0 0" }}>{t.option} · {parseApiDate(t.timestamp).toLocaleDateString()}</p>
                </div>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <p style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>{fmtUSD(t.amount)}</p>                  <span style={{ fontSize: 10, fontWeight: 700, padding: "1px 6px", borderRadius: 20, textTransform: "uppercase", background: t.status === "won" ? "var(--emerald-bg)" : t.status === "lost" ? "var(--red-bg)" : "rgba(99,102,241,0.1)", color: t.status === "won" ? "var(--emerald)" : t.status === "lost" ? "var(--red)" : "#6366f1" }}>
                    {t.status}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Right: categories + investment summary */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div className="card" style={{ padding: 18 }}>
              <h2 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", marginBottom: 14 }}>Top Categories</h2>
              {topCats.length === 0
                ? <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>Trade markets to see your top categories.</p>
                : topCats.map(([cat, count]) => (
                  <div key={cat} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                    <span style={{ fontSize: 13, color: "var(--text-primary)", textTransform: "capitalize", flex: 1 }}>{cat}</span>
                    <div style={{ width: 80, height: 5, background: "var(--bg-card-hover)", borderRadius: 3, overflow: "hidden" }}>
                      <div style={{ width: `${(count / trades.length) * 100}%`, height: "100%", background: "linear-gradient(90deg, var(--emerald), var(--emerald-dark))", borderRadius: 3 }} />
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 700, color: "var(--emerald)", minWidth: 20, textAlign: "right" }}>{count}</span>
                  </div>
                ))}
            </div>

            <div className="card" style={{ padding: 18 }}>
              <h2 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", marginBottom: 14 }}>Investment Summary</h2>
              {[
                { label: "Starting Balance", value: `${cfg.symbol}${cfg.startBalance.toLocaleString(cfg.locale, { minimumFractionDigits: cfg.decimals })}`,  color: "var(--text-primary)" },
                { label: "Total Invested",   value: fmtUSD(totalInvested),                                                                                   color: "#f59e0b"             },
                { label: "Current Balance",  value: fmtUSD(balance),                                                                                         color: "var(--emerald)"      },
                {
                  label: "Net P&L",
                  value: (() => {
                    const localBal = toLocal(balance);
                    const diff = localBal - cfg.startBalance;
                    return `${diff >= 0 ? "+" : "-"}${cfg.symbol}${Math.abs(diff).toLocaleString(cfg.locale, { minimumFractionDigits: cfg.decimals })}`;
                  })(),
                  color: toLocal(balance) >= cfg.startBalance ? "var(--emerald)" : "var(--red)",
                },
              ].map(({ label, value, color }) => (
                <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid var(--border)" }}>
                  <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>{label}</span>
                  <span style={{ fontSize: 14, fontWeight: 700, color }}>{value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
