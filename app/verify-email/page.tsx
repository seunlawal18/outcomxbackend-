"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useStore } from "@/lib/store";
import { apiVerifyEmail, apiResendVerification } from "@/lib/api";
import { Mail, CheckCircle2, AlertCircle, ArrowRight, RefreshCw } from "lucide-react";
import Logo from "@/components/Logo";

export default function VerifyEmailPage() {
  const router = useRouter();
  const { isLoggedIn, userProfile, userLogout } = useStore();

  const [codes, setCodes]         = useState(["", "", "", "", "", ""]);
  const [loading, setLoading]     = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError]         = useState("");
  const [success, setSuccess]     = useState(false);
  const [resent, setResent]       = useState(false);
  const [countdown, setCountdown] = useState(0);

  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Redirect if already verified or not logged in
  useEffect(() => {
    if (!isLoggedIn) {
      router.replace("/login");
      return;
    }
    if (userProfile.isVerified) {
      router.replace("/dashboard");
    }
  }, [isLoggedIn, userProfile.isVerified, router]);

  // Countdown for resend button
  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  const handleInput = (idx: number, val: string) => {
    // Only allow digits
    const digit = val.replace(/\D/g, "").slice(-1);
    const next  = [...codes];
    next[idx]   = digit;
    setCodes(next);
    setError("");

    // Auto-advance to next input
    if (digit && idx < 5) {
      inputRefs.current[idx + 1]?.focus();
    }

    // Auto-submit when all 6 filled
    if (digit && idx === 5) {
      const full = [...next].join("");
      if (full.length === 6) handleVerify(full);
    }
  };

  const handleKeyDown = (idx: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !codes[idx] && idx > 0) {
      inputRefs.current[idx - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (pasted.length === 6) {
      setCodes(pasted.split(""));
      handleVerify(pasted);
    }
  };

  const handleVerify = async (code?: string) => {
    const fullCode = code ?? codes.join("");
    if (fullCode.length !== 6) {
      setError("Enter all 6 digits.");
      return;
    }
    setLoading(true);
    setError("");

    const res = await apiVerifyEmail(fullCode);
    if (res.ok && res.data) {
      // Update store with verified user
      useStore.setState(state => ({
        userProfile: { ...state.userProfile, isVerified: true },
      }));
      setSuccess(true);
      setTimeout(() => router.push("/dashboard"), 1800);
    } else {
      setError(res.error ?? "Invalid or expired code. Try again.");
      setCodes(["", "", "", "", "", ""]);
      inputRefs.current[0]?.focus();
    }
    setLoading(false);
  };

  const handleResend = async () => {
    setResending(true);
    setError("");
    const res = await apiResendVerification();
    if (res.ok) {
      setResent(true);
      setCountdown(60);
      setTimeout(() => setResent(false), 4000);
    } else {
      setError(res.error ?? "Failed to resend. Try again.");
    }
    setResending(false);
  };

  if (!isLoggedIn) return null;

  return (
    <div style={{
      minHeight: "100vh", background: "var(--bg-primary)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
    }}>
      <div style={{ width: "100%", maxWidth: 440 }}>

        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <Link href="/" style={{ textDecoration: "none", display: "inline-flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
            <Logo size={44} />
          </Link>
        </div>

        <div style={{
          background: "var(--bg-secondary)", border: "1px solid var(--border)",
          borderRadius: 20, padding: "36px 28px",
          boxShadow: "0 24px 64px rgba(0,0,0,0.3)",
        }}>

          {success ? (
            /* ── Success state ── */
            <div className="fade-in" style={{ textAlign: "center", padding: "12px 0" }}>
              <div style={{ width: 64, height: 64, borderRadius: "50%", background: "var(--emerald-bg)", border: "2px solid var(--emerald)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
                <CheckCircle2 size={32} color="var(--emerald)" />
              </div>
              <h2 style={{ fontSize: 20, fontWeight: 800, color: "var(--text-primary)", margin: "0 0 8px" }}>
                Email Verified!
              </h2>
              <p style={{ fontSize: 14, color: "var(--text-secondary)", margin: 0 }}>
                Welcome to OUTCOMX, {userProfile.name.split(" ")[0]}! Redirecting…
              </p>
            </div>
          ) : (
            <>
              {/* Email icon */}
              <div style={{ textAlign: "center", marginBottom: 24 }}>
                <div style={{ width: 56, height: 56, borderRadius: 14, background: "var(--emerald-bg)", border: "1px solid var(--emerald-border)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px" }}>
                  <Mail size={26} color="var(--emerald)" />
                </div>
                <h2 style={{ fontSize: 20, fontWeight: 800, color: "var(--text-primary)", margin: "0 0 8px" }}>
                  Verify your email
                </h2>
                <p style={{ fontSize: 14, color: "var(--text-secondary)", margin: 0, lineHeight: 1.5 }}>
                  We sent a 6-digit code to<br />
                  <strong style={{ color: "var(--text-primary)" }}>{userProfile.name}</strong>
                </p>
              </div>

              {/* 6-digit code input */}
              <div style={{ display: "flex", gap: 10, justifyContent: "center", marginBottom: 20 }}>
                {codes.map((digit, idx) => (
                  <input
                    key={idx}
                    ref={el => { inputRefs.current[idx] = el; }}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={e => handleInput(idx, e.target.value)}
                    onKeyDown={e => handleKeyDown(idx, e)}
                    onPaste={idx === 0 ? handlePaste : undefined}
                    autoFocus={idx === 0}
                    style={{
                      width: 52, height: 60,
                      textAlign: "center",
                      fontSize: 24, fontWeight: 800,
                      borderRadius: 12,
                      border: `2px solid ${digit ? "var(--emerald)" : "var(--border)"}`,
                      background: digit ? "var(--emerald-bg)" : "var(--bg-input)",
                      color: "var(--text-primary)",
                      outline: "none",
                      transition: "all 0.15s",
                    }}
                    onFocus={e => (e.currentTarget.style.borderColor = "var(--emerald)")}
                    onBlur={e => { if (!digit) e.currentTarget.style.borderColor = "var(--border)"; }}
                  />
                ))}
              </div>

              {/* Error */}
              {error && (
                <div className="fade-in" style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", borderRadius: 8, marginBottom: 14, background: "var(--red-bg)", border: "1px solid var(--red-border)" }}>
                  <AlertCircle size={14} color="var(--red)" />
                  <span style={{ fontSize: 13, color: "var(--red)" }}>{error}</span>
                </div>
              )}

              {/* Resent success */}
              {resent && (
                <div className="fade-in" style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", borderRadius: 8, marginBottom: 14, background: "var(--emerald-bg)", border: "1px solid var(--emerald-border)" }}>
                  <CheckCircle2 size={14} color="var(--emerald)" />
                  <span style={{ fontSize: 13, color: "var(--emerald)" }}>New code sent to your email</span>
                </div>
              )}

              {/* Verify button */}
              <button
                onClick={() => handleVerify()}
                disabled={loading || codes.join("").length !== 6}
                className="btn-emerald"
                style={{ width: "100%", fontSize: 15, padding: "13px", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 14 }}
              >
                {loading ? (
                  <><span style={{ width: 16, height: 16, border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", borderRadius: "50%", display: "inline-block", animation: "spin 0.8s linear infinite" }} /> Verifying…</>
                ) : (
                  <><ArrowRight size={16} /> Verify Email</>
                )}
              </button>

              {/* Resend */}
              <div style={{ textAlign: "center" }}>
                <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 8 }}>
                  Didn&apos;t receive the code?
                </p>
                <button
                  onClick={handleResend}
                  disabled={resending || countdown > 0}
                  style={{
                    background: "none", border: "none",
                    color: countdown > 0 ? "var(--text-muted)" : "var(--emerald)",
                    fontSize: 13, fontWeight: 600, cursor: countdown > 0 ? "not-allowed" : "pointer",
                    display: "inline-flex", alignItems: "center", gap: 5,
                  }}
                >
                  <RefreshCw size={13} style={{ animation: resending ? "spin 0.8s linear infinite" : "none" }} />
                  {countdown > 0 ? `Resend in ${countdown}s` : "Resend code"}
                </button>
              </div>

              {/* Wrong account */}
              <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid var(--border)", textAlign: "center" }}>
                <button
                  onClick={async () => { await userLogout(); router.push("/register"); }}
                  style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: 12, cursor: "pointer" }}
                >
                  Wrong account? Sign up with a different email
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
