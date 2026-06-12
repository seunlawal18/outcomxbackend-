"use client";
import { useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useStore } from "@/lib/store";
import { useTheme } from "@/lib/themeStore";
import { TrendingUp, Mail, Lock, Eye, EyeOff, AlertCircle, CheckCircle2, ArrowRight } from "lucide-react";

function LoginForm() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const redirect     = searchParams.get("redirect") || "/";
  const { userLogin } = useStore();
  const { theme }    = useTheme();
  const isDark       = theme === "dark";

  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw]     = useState(false);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState("");
  const [success, setSuccess]   = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!email.trim())  { setError("Enter your email address."); return; }
    if (!password)      { setError("Enter your password."); return; }
    setLoading(true);
    await new Promise(r => setTimeout(r, 600));
    const result = await userLogin(email.trim(), password);
    if (!result.ok) { setError(result.error || "Login failed."); setLoading(false); return; }
    setSuccess(true);
    // Redirect to dashboard after login, or the requested redirect param
    const dest = redirect === "/" ? "/dashboard" : redirect;
    setTimeout(() => router.push(dest), 1000);
    setLoading(false);
  };

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-primary)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ width: "100%", maxWidth: 440 }}>

        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <Link href="/" style={{ textDecoration: "none", display: "inline-flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
            <div style={{ width: 56, height: 56, borderRadius: 16, background: "linear-gradient(135deg, #10b981, #059669)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 8px 24px rgba(16,185,129,0.3)" }}>
              <TrendingUp size={28} color="white" />
            </div>
            <span style={{ fontSize: 22, fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.5px" }}>OUTCOMX</span>
          </Link>
          <p style={{ fontSize: 14, color: "var(--text-secondary)", marginTop: 8 }}>Sign in to your account</p>
        </div>

        {/* Card */}
        <div style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)", borderRadius: 20, padding: "32px 28px", boxShadow: isDark ? "0 24px 64px rgba(0,0,0,0.3)" : "0 8px 32px rgba(0,0,0,0.08)" }}>

          {success ? (
            <div className="fade-in" style={{ textAlign: "center", padding: "20px 0" }}>
              <CheckCircle2 size={48} color="var(--emerald)" style={{ margin: "0 auto 16px" }} />
              <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)", margin: "0 0 8px" }}>Welcome back!</h2>
              <p style={{ fontSize: 14, color: "var(--text-secondary)" }}>Redirecting…</p>
            </div>
          ) : (
            <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: 18 }}>

              {/* Divider */}
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
                <span style={{ fontSize: 12, color: "var(--text-muted)" }}>sign in with your email</span>
                <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
              </div>

              {/* Email */}
              <div>
                <p style={{ fontSize: 12, color: "var(--text-secondary)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", margin: "0 0 8px" }}>Email Address</p>
                <div style={{ position: "relative" }}>
                  <Mail size={15} style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
                  <input className="input-dark" type="email" placeholder="you@example.com" value={email} onChange={e => { setEmail(e.target.value); setError(""); }} style={{ paddingLeft: 40 }} autoComplete="email" />
                </div>
              </div>

              {/* Password */}
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                  <p style={{ fontSize: 12, color: "var(--text-secondary)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", margin: 0 }}>Password</p>
                  <Link href="#" style={{ fontSize: 12, color: "var(--emerald)", textDecoration: "none" }}>Forgot password?</Link>
                </div>
                <div style={{ position: "relative" }}>
                  <Lock size={15} style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
                  <input className="input-dark" type={showPw ? "text" : "password"} placeholder="••••••••" value={password} onChange={e => { setPassword(e.target.value); setError(""); }} style={{ paddingLeft: 40, paddingRight: 44 }} autoComplete="current-password" />
                  <button type="button" onClick={() => setShowPw(!showPw)} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", display: "flex" }}>
                    {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              {/* Error */}
              {error && (
                <div className="fade-in" style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", borderRadius: 8, background: "var(--red-bg)", border: "1px solid var(--red-border)" }}>
                  <AlertCircle size={14} color="var(--red)" />
                  <span style={{ fontSize: 13, color: "var(--red)" }}>{error}</span>
                </div>
              )}

              <button type="submit" className="btn-emerald" disabled={loading} style={{ fontSize: 15, padding: "13px", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                {loading ? "Signing in…" : <><span>Sign In</span><ArrowRight size={16} /></>}
              </button>
            </form>
          )}
        </div>

        <p style={{ textAlign: "center", marginTop: 20, fontSize: 14, color: "var(--text-secondary)" }}>
          Don&apos;t have an account?{" "}
          <Link href="/register" style={{ color: "var(--emerald)", fontWeight: 600, textDecoration: "none" }}>Create one free</Link>
        </p>
        <p style={{ textAlign: "center", marginTop: 6, fontSize: 11, color: "var(--text-muted)" }}>
          Simulation platform — no real money involved
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
