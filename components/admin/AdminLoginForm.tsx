"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useStore } from "@/lib/store";
import { useTheme } from "@/lib/themeStore";
import { TrendingUp, Lock, Eye, EyeOff, ShieldCheck, Wifi, WifiOff } from "lucide-react";

export default function AdminLoginForm() {
  const { adminLogin } = useStore();
  const { theme } = useTheme();
  const router = useRouter();
  const isDark = theme === "dark";
  const [password, setPassword] = useState("");
  const [showPw, setShowPw]     = useState(false);
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState(false);
  const [mode, setMode]         = useState<"" | "online" | "offline">("");

  const handleLogin = async () => {
    setLoading(true);
    setError("");
    const ok = await adminLogin(password);
    if (!ok) {
      setError("Invalid password.");
    } else {
      const state = useStore.getState();
      setMode(state.apiOnline ? "online" : "offline");
      // Redirect to dashboard after short delay so user sees the success state
      setTimeout(() => router.replace("/admin/dashboard"), 600);
    }
    setLoading(false);
  };

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-primary)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ width: "100%", maxWidth: 420, background: "var(--bg-secondary)", border: "1px solid var(--border)", borderRadius: 20, padding: "40px 36px", boxShadow: "0 24px 64px rgba(0,0,0,0.25)" }}>

        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ width: 60, height: 60, background: "linear-gradient(135deg, #10b981, #059669)", borderRadius: 16, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", boxShadow: "0 8px 24px rgba(16,185,129,0.3)" }}>
            <TrendingUp size={30} color="white" />
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: "var(--text-primary)", margin: "0 0 4px", letterSpacing: "-0.5px" }}>OUTCOMX</h1>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
            <ShieldCheck size={13} color="var(--emerald)" />
            <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: 0 }}>Super Admin Dashboard</p>
          </div>
        </div>

        {/* Password field */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 11, color: "var(--text-secondary)", display: "block", marginBottom: 8, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px" }}>
            Admin Password
          </label>
          <div style={{ position: "relative" }}>
            <Lock size={15} style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
            <input
              className="input-dark"
              type={showPw ? "text" : "password"}
              placeholder="Enter admin password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError(""); }}
              onKeyDown={(e) => e.key === "Enter" && handleLogin()}
              style={{ paddingLeft: 40, paddingRight: 44, fontSize: 15 }}
            />
            <button onClick={() => setShowPw(!showPw)} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", display: "flex" }}>
              {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
        </div>

        {error && (
          <div style={{ padding: "9px 12px", borderRadius: 8, marginBottom: 14, background: "var(--red-bg)", border: "1px solid var(--red-border)", color: "var(--red)", fontSize: 13 }}>
            {error}
          </div>
        )}

        {/* Online/offline status after login attempt */}
        {mode === "offline" && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 12px", borderRadius: 8, marginBottom: 14, background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.3)", color: "#f59e0b", fontSize: 12 }}>
            <WifiOff size={14} />
            <span>Offline mode — changes won&apos;t save to the database. Start the backend server for full functionality.</span>
          </div>
        )}
        {mode === "online" && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 12px", borderRadius: 8, marginBottom: 14, background: "var(--emerald-bg)", border: "1px solid var(--emerald-border)", color: "var(--emerald)", fontSize: 12 }}>
            <Wifi size={14} />
            <span>Connected to backend — all changes save to the database.</span>
          </div>
        )}

        <button className="btn-emerald" onClick={handleLogin} disabled={loading || !password} style={{ width: "100%", fontSize: 15, padding: "13px", borderRadius: 10 }}>
          {loading ? "Authenticating…" : "Login to Admin"}
        </button>

        <p style={{ fontSize: 11, color: "var(--text-muted)", textAlign: "center", marginTop: 18 }}>
          Backend connected: use backend admin password<br />
          Backend offline: use <strong>admin123</strong>
        </p>
      </div>
    </div>
  );
}
