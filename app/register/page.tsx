"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useStore } from "@/lib/store";
import { useTheme } from "@/lib/themeStore";
import { REGION_OPTIONS, REGION_CURRENCIES, Region } from "@/lib/currency";import {
  TrendingUp, Mail, Lock, Eye, EyeOff, User,
  AlertCircle, CheckCircle2, ArrowRight, Phone, Globe,
} from "lucide-react";

// ── Field wrapper — defined OUTSIDE component to prevent re-mount on every keystroke ──
function Field({ label, icon, children }: { label: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <p style={{ fontSize: 12, color: "var(--text-secondary)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", margin: "0 0 8px" }}>{label}</p>
      <div style={{ position: "relative" }}>
        <span style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)", display: "flex" }}>{icon}</span>
        {children}
      </div>
    </div>
  );
}

export default function RegisterPage() {
  const router = useRouter();
  const { userRegister } = useStore();
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const [step, setStep]         = useState<1 | 2>(1);
  const [fullName, setFullName] = useState("");
  const [email, setEmail]       = useState("");
  const [phone, setPhone]       = useState("");
  const [region, setRegion]     = useState<Region>("nigeria");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm]   = useState("");
  const [showPw, setShowPw]     = useState(false);
  const [showCf, setShowCf]     = useState(false);
  const [agreed, setAgreed]     = useState(false);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState("");
  const [success, setSuccess]   = useState(false);

  const cfg = REGION_CURRENCIES[region];

  const pwStrength = (() => {
    if (!password.length) return 0;
    let s = 0;
    if (password.length >= 8)          s++;
    if (/[A-Z]/.test(password))        s++;
    if (/[0-9]/.test(password))        s++;
    if (/[^A-Za-z0-9]/.test(password)) s++;
    return s;
  })();
  const pwColors = ["", "#ef4444", "#f59e0b", "#10b981", "#10b981"];
  const pwLabels = ["", "Weak", "Fair", "Good", "Strong"];

  const validateStep1 = () => {
    if (!fullName.trim())                              { setError("Enter your full name."); return false; }
    if (fullName.trim().split(" ").length < 2)         { setError("Enter first and last name."); return false; }
    if (!email.includes("@"))                          { setError("Enter a valid email address."); return false; }
    if (phone && !/^\+?[\d\s\-()]{7,15}$/.test(phone)){ setError("Enter a valid phone number."); return false; }
    return true;
  };

  const validateStep2 = () => {
    if (password.length < 8)  { setError("Password must be at least 8 characters."); return false; }
    if (password !== confirm)  { setError("Passwords do not match."); return false; }
    if (!agreed)               { setError("You must agree to the Terms of Service."); return false; }
    return true;
  };

  const handleNext = (e: React.FormEvent) => {
    e.preventDefault(); setError("");
    if (validateStep1()) setStep(2);
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault(); setError("");
    if (!validateStep2()) return;
    setLoading(true);
    await new Promise(r => setTimeout(r, 900));
    const result = await userRegister(email.trim(), password, fullName.trim(), region);
    if (!result.ok) { setError(result.error || "Registration failed."); setLoading(false); return; }
    setSuccess(true);
    setTimeout(() => router.push("/dashboard"), 1500);
    setLoading(false);
  };

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-primary)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ width: "100%", maxWidth: 460 }}>

        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <Link href="/" style={{ textDecoration: "none", display: "inline-flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
            <div style={{ width: 52, height: 52, borderRadius: 14, background: "linear-gradient(135deg, #10b981, #059669)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 8px 24px rgba(16,185,129,0.3)" }}>
              <TrendingUp size={26} color="white" />
            </div>
            <span style={{ fontSize: 20, fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.5px" }}>OUTCOMX</span>
          </Link>
          <p style={{ fontSize: 14, color: "var(--text-secondary)", marginTop: 6 }}>
            Create your free account · Start with {cfg.symbol}{cfg.startBalance.toLocaleString(cfg.locale)}
          </p>
        </div>

        {/* Step indicator */}
        <div style={{ display: "flex", alignItems: "center", marginBottom: 24 }}>
          {[1, 2].map((s) => (
            <div key={s} style={{ display: "flex", alignItems: "center", flex: 1 }}>
              <div style={{ width: 28, height: 28, borderRadius: "50%", flexShrink: 0, background: step >= s ? "var(--emerald)" : "var(--bg-card-hover)", border: `2px solid ${step >= s ? "var(--emerald)" : "var(--border)"}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: step >= s ? "#fff" : "var(--text-muted)", transition: "all 0.3s" }}>
                {step > s ? <CheckCircle2 size={14} /> : s}
              </div>
              <span style={{ fontSize: 12, color: step >= s ? "var(--emerald)" : "var(--text-muted)", marginLeft: 8, fontWeight: step >= s ? 600 : 400 }}>
                {s === 1 ? "Your Info" : "Security"}
              </span>
              {s < 2 && <div style={{ flex: 1, height: 2, background: step > s ? "var(--emerald)" : "var(--border)", margin: "0 12px", transition: "background 0.3s" }} />}
            </div>
          ))}
        </div>

        {/* Card */}
        <div style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)", borderRadius: 20, padding: "28px 24px", boxShadow: isDark ? "0 24px 64px rgba(0,0,0,0.3)" : "0 8px 32px rgba(0,0,0,0.08)" }}>
          {success ? (
            <div className="fade-in" style={{ textAlign: "center", padding: "24px 0" }}>
              <div style={{ width: 64, height: 64, borderRadius: "50%", background: "var(--emerald-bg)", border: "2px solid var(--emerald)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
                <CheckCircle2 size={32} color="var(--emerald)" />
              </div>
              <h2 style={{ fontSize: 20, fontWeight: 800, color: "var(--text-primary)", margin: "0 0 8px" }}>Account Created!</h2>
              <p style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 4 }}>Welcome to OUTCOMX, {fullName.split(" ")[0]}! {cfg.flag}</p>
              <p style={{ fontSize: 13, color: "var(--emerald)", fontWeight: 600 }}>{cfg.symbol}{cfg.startBalance.toLocaleString(cfg.locale)} added to your balance</p>
            </div>
          ) : step === 1 ? (
            <form onSubmit={handleNext} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <h2 style={{ fontSize: 17, fontWeight: 700, color: "var(--text-primary)", margin: "0 0 4px" }}>Personal Information</h2>

              <Field label="Full Name *" icon={<User size={15} />}>
                <input className="input-dark" type="text" placeholder="John Doe" value={fullName} onChange={e => { setFullName(e.target.value); setError(""); }} style={{ paddingLeft: 40 }} autoComplete="name" />
              </Field>

              <Field label="Email Address *" icon={<Mail size={15} />}>
                <input className="input-dark" type="email" placeholder="you@example.com" value={email} onChange={e => { setEmail(e.target.value); setError(""); }} style={{ paddingLeft: 40 }} autoComplete="email" />
              </Field>

              <Field label="Phone Number (optional)" icon={<Phone size={15} />}>
                <input className="input-dark" type="tel" placeholder="+234 800 000 0000" value={phone} onChange={e => { setPhone(e.target.value); setError(""); }} style={{ paddingLeft: 40 }} autoComplete="tel" />
              </Field>

              {/* Region selector */}
              <div>
                <p style={{ fontSize: 12, color: "var(--text-secondary)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", margin: "0 0 8px", display: "flex", alignItems: "center", gap: 6 }}>
                  <Globe size={13} /> Region & Currency
                </p>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: 8 }}>
                  {REGION_OPTIONS.map(({ value, label, flag }) => {
                    const rcfg = REGION_CURRENCIES[value];
                    const isSelected = region === value;
                    return (
                      <button key={value} type="button" onClick={() => setRegion(value)} style={{
                        padding: "10px 8px", borderRadius: 10, fontSize: 13, fontWeight: 500,
                        cursor: "pointer", border: "1px solid",
                        borderColor: isSelected ? "var(--emerald)" : "var(--border)",
                        background: isSelected ? "var(--emerald-bg)" : "var(--bg-card-hover)",
                        color: isSelected ? "var(--emerald)" : "var(--text-secondary)",
                        display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
                        transition: "all 0.15s",
                      }}>
                        <span style={{ fontSize: 20 }}>{flag}</span>
                        <span style={{ fontSize: 12, fontWeight: 600 }}>{label}</span>
                        <span style={{ fontSize: 11, opacity: 0.75 }}>{rcfg.symbol} {rcfg.code}</span>
                      </button>
                    );
                  })}
                </div>
                {/* Selected currency info */}
                <div style={{ marginTop: 10, padding: "8px 12px", borderRadius: 8, background: "var(--emerald-bg)", border: "1px solid var(--emerald-border)", display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 18 }}>{cfg.flag}</span>
                  <div>
                    <p style={{ fontSize: 12, fontWeight: 700, color: "var(--emerald)", margin: 0 }}>{cfg.name} ({cfg.code})</p>
                    <p style={{ fontSize: 11, color: "var(--text-secondary)", margin: 0 }}>
                      Starting balance: {cfg.symbol}{cfg.startBalance.toLocaleString(cfg.locale)} · Min stake: {cfg.symbol}{cfg.minStake.toLocaleString(cfg.locale)}
                    </p>
                  </div>
                </div>
              </div>

              {error && (
                <div className="fade-in" style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", borderRadius: 8, background: "var(--red-bg)", border: "1px solid var(--red-border)" }}>
                  <AlertCircle size={14} color="var(--red)" />
                  <span style={{ fontSize: 13, color: "var(--red)" }}>{error}</span>
                </div>
              )}

              <button type="submit" className="btn-emerald" style={{ fontSize: 15, padding: "13px", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                Continue <ArrowRight size={16} />
              </button>
            </form>
          ) : (
            <form onSubmit={handleRegister} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                <button type="button" onClick={() => { setStep(1); setError(""); }} style={{ background: "none", border: "none", color: "var(--text-secondary)", cursor: "pointer", fontSize: 13, display: "flex", alignItems: "center", gap: 4, padding: 0 }}>← Back</button>
                <h2 style={{ fontSize: 17, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>Set Your Password</h2>
              </div>

              {/* Password */}
              <div>
                <p style={{ fontSize: 12, color: "var(--text-secondary)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", margin: "0 0 8px" }}>Password *</p>
                <div style={{ position: "relative" }}>
                  <Lock size={15} style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
                  <input className="input-dark" type={showPw ? "text" : "password"} placeholder="Min. 8 characters" value={password} onChange={e => { setPassword(e.target.value); setError(""); }} style={{ paddingLeft: 40, paddingRight: 44 }} autoComplete="new-password" />
                  <button type="button" onClick={() => setShowPw(!showPw)} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", display: "flex" }}>
                    {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
                {password.length > 0 && (
                  <div style={{ marginTop: 8 }}>
                    <div style={{ display: "flex", gap: 4, marginBottom: 4 }}>
                      {[1,2,3,4].map(i => <div key={i} style={{ flex: 1, height: 3, borderRadius: 2, background: i <= pwStrength ? pwColors[pwStrength] : "var(--border)", transition: "background 0.2s" }} />)}
                    </div>
                    <span style={{ fontSize: 11, color: pwColors[pwStrength], fontWeight: 600 }}>{pwLabels[pwStrength]}</span>
                  </div>
                )}
              </div>

              {/* Confirm */}
              <div>
                <p style={{ fontSize: 12, color: "var(--text-secondary)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", margin: "0 0 8px" }}>Confirm Password *</p>
                <div style={{ position: "relative" }}>
                  <Lock size={15} style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
                  <input className="input-dark" type={showCf ? "text" : "password"} placeholder="Repeat password" value={confirm} onChange={e => { setConfirm(e.target.value); setError(""); }} style={{ paddingLeft: 40, paddingRight: 44 }} autoComplete="new-password" />
                  <button type="button" onClick={() => setShowCf(!showCf)} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", display: "flex" }}>
                    {showCf ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
                {confirm.length > 0 && (
                  <p style={{ fontSize: 11, marginTop: 5, color: confirm === password ? "var(--emerald)" : "var(--red)", fontWeight: 600 }}>
                    {confirm === password ? "✓ Passwords match" : "✗ Passwords do not match"}
                  </p>
                )}
              </div>

              {/* Terms */}
              <label style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer" }}>
                <input type="checkbox" checked={agreed} onChange={e => { setAgreed(e.target.checked); setError(""); }} style={{ marginTop: 2, accentColor: "var(--emerald)", width: 16, height: 16, flexShrink: 0 }} />
                <span style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.5 }}>
                  I agree to the <Link href="#" style={{ color: "var(--emerald)", textDecoration: "none", fontWeight: 600 }}>Terms of Service</Link> and <Link href="#" style={{ color: "var(--emerald)", textDecoration: "none", fontWeight: 600 }}>Privacy Policy</Link>. This is a simulation platform — no real money.
                </span>
              </label>

              {error && (
                <div className="fade-in" style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", borderRadius: 8, background: "var(--red-bg)", border: "1px solid var(--red-border)" }}>
                  <AlertCircle size={14} color="var(--red)" />
                  <span style={{ fontSize: 13, color: "var(--red)" }}>{error}</span>
                </div>
              )}

              {/* Bonus badge */}
              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderRadius: 10, background: "var(--emerald-bg)", border: "1px solid var(--emerald-border)" }}>
                <span style={{ fontSize: 22 }}>{cfg.flag}</span>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 700, color: "var(--emerald)", margin: 0 }}>Welcome Bonus — {cfg.name}</p>
                  <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: 0 }}>
                    {cfg.symbol}{cfg.startBalance.toLocaleString(cfg.locale)} added instantly · Min stake {cfg.symbol}{cfg.minStake.toLocaleString(cfg.locale)}
                  </p>
                </div>
              </div>

              <button type="submit" className="btn-emerald" disabled={loading} style={{ fontSize: 15, padding: "13px", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                {loading ? "Creating account…" : <><span>Create Account</span><ArrowRight size={16} /></>}
              </button>
            </form>
          )}
        </div>

        <p style={{ textAlign: "center", marginTop: 20, fontSize: 14, color: "var(--text-secondary)" }}>
          Already have an account?{" "}
          <Link href="/login" style={{ color: "var(--emerald)", fontWeight: 600, textDecoration: "none" }}>Sign in</Link>
        </p>
      </div>
    </div>
  );
}
