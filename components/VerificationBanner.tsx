"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useStore } from "@/lib/store";
import { apiResendVerification } from "@/lib/api";
import { Mail, X, CheckCircle2 } from "lucide-react";

// Email verification is on hold until a custom domain is verified with Resend —
// until then Resend can only deliver to the account's own address, so this
// banner would send real users into a flow that can never reach them.
// Flip NEXT_PUBLIC_EMAIL_VERIFICATION_ENABLED=true in .env.local once the
// domain is live and FROM_EMAIL is switched over on the backend.
const EMAIL_VERIFICATION_ENABLED = process.env.NEXT_PUBLIC_EMAIL_VERIFICATION_ENABLED === "true";

export default function VerificationBanner() {
  const { isLoggedIn, userProfile } = useStore();
  const router = useRouter();
  const [dismissed, setDismissed] = useState(false);
  const [resending, setResending] = useState(false);
  const [sent, setSent] = useState(false);

  // Only show when enabled, logged in, and NOT verified
  if (!EMAIL_VERIFICATION_ENABLED || !isLoggedIn || userProfile.isVerified || dismissed) return null;

  const handleResend = async () => {
    setResending(true);
    await apiResendVerification();
    setSent(true);
    setResending(false);
    setTimeout(() => router.push("/verify-email"), 1000);
  };

  return (
    <div style={{
      background: "rgba(245,158,11,0.1)",
      borderBottom: "1px solid rgba(245,158,11,0.3)",
      padding: "10px 16px",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      gap: 12,
      flexWrap: "wrap",
    }}>
      <Mail size={15} color="#f59e0b" />
      <span style={{ fontSize: 13, color: "#f59e0b", fontWeight: 500 }}>
        Your email is not verified. Some features may be restricted.
      </span>
      {sent ? (
        <span style={{ fontSize: 12, color: "var(--emerald)", display: "flex", alignItems: "center", gap: 4 }}>
          <CheckCircle2 size={13} /> Code sent — check your email
        </span>
      ) : (
        <button
          onClick={handleResend}
          disabled={resending}
          style={{
            fontSize: 12, fontWeight: 700,
            padding: "4px 12px", borderRadius: 20,
            background: "rgba(245,158,11,0.2)",
            border: "1px solid rgba(245,158,11,0.4)",
            color: "#f59e0b", cursor: "pointer",
            transition: "all 0.15s",
          }}
        >
          {resending ? "Sending…" : "Verify now →"}
        </button>
      )}
      <button
        onClick={() => setDismissed(true)}
        style={{ background: "none", border: "none", color: "#f59e0b", cursor: "pointer", marginLeft: "auto", opacity: 0.7 }}
      >
        <X size={14} />
      </button>
    </div>
  );
}
