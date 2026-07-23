"use client";
import { useRouter, usePathname } from "next/navigation";
import { TrendingUp, X, LogIn, UserPlus } from "lucide-react";
import { useTheme } from "@/lib/themeStore";

interface Props {
  onClose: () => void;
  message?: string;
}

export default function LoginRequiredModal({ onClose, message }: Props) {
  const router   = useRouter();
  const pathname = usePathname();
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const bg     = isDark ? "#1a1d27" : "#ffffff";
  const border = isDark ? "#2a2d3a" : "#e2e8f0";
  const text   = isDark ? "#f0f2f5" : "#0f172a";
  const sub    = isDark ? "#8b8fa8" : "#64748b";

  const goTo = (path: string) => {
    onClose();
    router.push(`${path}?redirect=${encodeURIComponent(pathname)}`);
  };

  return (
    <div
      style={{ position: "fixed", inset: 0, zIndex: 600, background: "rgba(0,0,0,0.65)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        className="fade-in"
        style={{ background: bg, border: `1px solid ${border}`, borderRadius: 20, padding: 32, width: "100%", maxWidth: 380, boxShadow: "0 32px 80px rgba(0,0,0,0.5)", textAlign: "center" }}
      >
        {/* Close */}
        <button onClick={onClose} style={{ position: "absolute", top: 16, right: 16, width: 28, height: 28, borderRadius: 8, background: isDark ? "#1f2333" : "#f1f5f9", border: `1px solid ${border}`, color: sub, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <X size={14} />
        </button>

        {/* Icon */}
        <div style={{ width: 60, height: 60, borderRadius: 16, background: "linear-gradient(135deg, #10b981, #059669)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px", boxShadow: "0 8px 24px rgba(16,185,129,0.3)" }}>
          <TrendingUp size={28} color="white" />
        </div>

        <h2 style={{ fontSize: 20, fontWeight: 800, color: text, margin: "0 0 8px", letterSpacing: "-0.3px" }}>
          Login Required
        </h2>
        <p style={{ fontSize: 14, color: sub, margin: "0 0 24px", lineHeight: 1.6 }}>
          {message || "You need to be logged in to place trades. Create a free account and start with a demo balance."}
        </p>

        {/* Buttons */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <button
            onClick={() => goTo("/login")}
            style={{ width: "100%", padding: "13px", borderRadius: 10, fontSize: 15, fontWeight: 700, background: "var(--emerald)", border: "none", color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, transition: "opacity 0.2s" }}
            onMouseEnter={e => (e.currentTarget.style.opacity = "0.9")}
            onMouseLeave={e => (e.currentTarget.style.opacity = "1")}
          >
            <LogIn size={16} /> Log In
          </button>
          <button
            onClick={() => goTo("/register")}
            style={{ width: "100%", padding: "13px", borderRadius: 10, fontSize: 15, fontWeight: 600, background: isDark ? "#1f2333" : "#f1f5f9", border: `1px solid ${border}`, color: text, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, transition: "all 0.2s" }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "var(--emerald)"; (e.currentTarget as HTMLElement).style.color = "var(--emerald)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = border; (e.currentTarget as HTMLElement).style.color = text; }}
          >
            <UserPlus size={16} /> Create Free Account
          </button>
        </div>

        {/* Demo hint */}
        <p style={{ fontSize: 12, color: sub, marginTop: 16 }}>
          Try the demo: <strong style={{ color: "var(--emerald)" }}>demo@outcomx.com</strong> / <strong style={{ color: "var(--emerald)" }}>demo123</strong>
        </p>
      </div>
    </div>
  );
}
