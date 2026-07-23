"use client";
import { useState } from "react";
import { useConnect, useAccount, useSignMessage, useDisconnect } from "wagmi";
import { X, Wallet, Loader2, AlertCircle } from "lucide-react";
import { useStore } from "@/lib/store";
import { useTheme } from "@/lib/themeStore";
import { apiWalletNonce } from "@/lib/api";
import { WALLETCONNECT_PROJECT_ID } from "@/lib/wagmiConfig";
import Logo from "./Logo";

type Step = "choose" | "signing" | "error";

// ── Brand marks ────────────────────────────────────────────────────
// Simplified, recognizable glyphs rather than emoji placeholders.
// Each renders on top of its brand-colored square (set per option below).

function MetaMaskIcon() {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 3L4.5 8.2 6 13.6 12 11.4l6 2.2 1.5-5.4L12 3Z" fill="white" />
      <circle cx="9" cy="9.6" r="1.15" fill="#f6851b" />
      <circle cx="15" cy="9.6" r="1.15" fill="#f6851b" />
    </svg>
  );
}

function CoinbaseIcon() {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <rect x="7.5" y="7.5" width="9" height="9" rx="2.6" fill="white" />
    </svg>
  );
}

function WalletConnectIcon() {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M5 10.6c4.6-6 9.4-6 14 0" stroke="white" strokeWidth="2" strokeLinecap="round" opacity="0.5" />
      <path d="M7 13.2c3-4.6 7-4.6 10 0" stroke="white" strokeWidth="2.3" strokeLinecap="round" />
      <circle cx="7" cy="13.2" r="1.3" fill="white" />
      <circle cx="17" cy="13.2" r="1.3" fill="white" />
    </svg>
  );
}

function PhantomIcon() {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path d="M6.5 19V11a5.5 5.5 0 0 1 11 0v8l-2-1.4-1.8 1.4-1.7-1.4L10 19l-1.8-1.4Z" fill="white" />
      <circle cx="10" cy="11.2" r="1.05" fill="#6d4fc9" />
      <circle cx="14" cy="11.2" r="1.05" fill="#6d4fc9" />
    </svg>
  );
}

const WALLET_OPTIONS: { id: string; name: string; color: string; Icon: () => React.JSX.Element }[] = [
  { id: "metaMask",       name: "MetaMask",        color: "#f6851b", Icon: MetaMaskIcon },
  { id: "coinbaseWallet", name: "Coinbase Wallet", color: "#0052ff", Icon: CoinbaseIcon },
  { id: "phantom",        name: "Phantom",         color: "#ab9ff2", Icon: PhantomIcon },
  { id: "walletConnect",  name: "WalletConnect",   color: "#3b99fc", Icon: WalletConnectIcon },
];

const INSTALL_LINKS: Record<string, string> = {
  metaMask: "https://metamask.io/download",
  coinbaseWallet: "https://www.coinbase.com/wallet/downloads",
  phantom: "https://phantom.app/download",
};

function friendlyWalletError(walletId: string, e: unknown): string {
  const raw = e instanceof Error ? e.message : "";
  const name = WALLET_OPTIONS.find(w => w.id === walletId)?.name ?? "Wallet";

  if (/provider not found/i.test(raw)) {
    const link = INSTALL_LINKS[walletId];
    return link
      ? `${name} isn't installed in this browser. Install it from ${link.replace("https://", "")} and try again.`
      : `${name} isn't available in this browser.`;
  }
  if (/user rejected|denied/i.test(raw)) {
    return "Request was cancelled in the wallet.";
  }
  return raw || "Connection was cancelled or failed.";
}

export default function WalletConnectModal({ onClose }: { onClose: () => void }) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const { connectAsync, connectors } = useConnect();
  const { disconnect } = useDisconnect();
  const { signMessageAsync } = useSignMessage();
  const { userWalletLogin } = useStore();

  const [step, setStep]           = useState<Step>("choose");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError]         = useState("");

  const bg     = isDark ? "#1a1d27" : "#ffffff";
  const border = isDark ? "#2a2d3a" : "#e2e8f0";
  const text   = isDark ? "#f0f2f5" : "#0f172a";
  const sub    = isDark ? "#8b8fa8" : "#64748b";
  const rowBg  = isDark ? "#1f2333" : "#f8fafc";

  const handleConnect = async (walletId: string) => {
    setError("");
    setPendingId(walletId);

    const connector = connectors.find(c => c.id === walletId);
    if (!connector) {
      setError(`${walletId} is not available. Configure NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID to enable WalletConnect.`);
      setStep("error");
      setPendingId(null);
      return;
    }

    try {
      const { accounts } = await connectAsync({ connector });
      const address = accounts[0];
      if (!address) throw new Error("No account returned by wallet.");

      setStep("signing");
      const nonceRes = await apiWalletNonce(address);
      if (!nonceRes.ok || !nonceRes.data) throw new Error(nonceRes.error ?? "Could not reach OutcomX server.");

      const signature = await signMessageAsync({ account: address, message: nonceRes.data.message });

      const loginRes = await userWalletLogin(address, nonceRes.data.message, signature);
      if (!loginRes.ok) throw new Error(loginRes.error ?? "Sign-in failed.");

      onClose();
    } catch (e) {
      disconnect();
      setError(friendlyWalletError(walletId, e));
      setStep("error");
    } finally {
      setPendingId(null);
    }
  };

  return (
    <div
      style={{ position: "fixed", inset: 0, zIndex: 500, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        className="fade-in"
        style={{ background: bg, border: `1px solid ${border}`, borderRadius: 20, padding: 32, width: "100%", maxWidth: 400, boxShadow: "0 24px 64px rgba(0,0,0,0.4)" }}
      >
        <button onClick={onClose} style={{ float: "right", width: 30, height: 30, borderRadius: 8, background: rowBg, border: `1px solid ${border}`, color: sub, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <X size={15} />
        </button>

        <div style={{ display: "flex", justifyContent: "center", marginBottom: 6 }}>
          <Logo size={30} textColor={text} />
        </div>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: text, textAlign: "center", margin: "14px 0 4px" }}>
          Welcome to OutcomX
        </h2>
        <p style={{ fontSize: 13, color: sub, textAlign: "center", margin: "0 0 24px" }}>
          Connect your wallet to sign in or create an account
        </p>

        {step === "signing" ? (
          <div style={{ textAlign: "center", padding: "24px 0" }}>
            <Loader2 size={28} color="var(--emerald)" style={{ margin: "0 auto 12px", animation: "spin 1s linear infinite" }} />
            <p style={{ fontSize: 14, color: text, fontWeight: 600, margin: 0 }}>Confirm the signature in your wallet</p>
            <p style={{ fontSize: 12, color: sub, margin: "6px 0 0" }}>This proves you own the address — it's free and doesn't send a transaction.</p>
          </div>
        ) : (
          <>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {WALLET_OPTIONS.map(w => {
                const available = w.id !== "walletConnect" || !!WALLETCONNECT_PROJECT_ID;
                const busy = pendingId === w.id;
                return (
                  <button
                    key={w.id}
                    disabled={!available || pendingId !== null}
                    onClick={() => handleConnect(w.id)}
                    title={!available ? "WalletConnect project ID not configured yet" : undefined}
                    style={{
                      display: "flex", alignItems: "center", gap: 12,
                      padding: "12px 14px", borderRadius: 12,
                      background: rowBg, border: `1px solid ${border}`,
                      cursor: available && !pendingId ? "pointer" : "not-allowed",
                      opacity: available ? (pendingId && !busy ? 0.5 : 1) : 0.45,
                      transition: "border-color 0.15s, background 0.15s",
                    }}
                    onMouseEnter={e => { if (available && !pendingId) e.currentTarget.style.borderColor = "var(--emerald)"; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = border; }}
                  >
                    <div style={{ width: 34, height: 34, borderRadius: 9, background: w.color, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <w.Icon />
                    </div>
                    <span style={{ fontSize: 14, fontWeight: 600, color: text }}>{w.name}</span>
                    {busy && <Loader2 size={16} color={sub} style={{ marginLeft: "auto", animation: "spin 1s linear infinite" }} />}
                    {!available && <span style={{ marginLeft: "auto", fontSize: 11, color: sub }}>Coming soon</span>}
                  </button>
                );
              })}
            </div>

            {step === "error" && error && (
              <div style={{ display: "flex", alignItems: "flex-start", gap: 6, marginTop: 16, padding: "10px 12px", borderRadius: 10, background: "var(--red-bg)", border: "1px solid var(--red-border)" }}>
                <AlertCircle size={14} color="var(--red)" style={{ marginTop: 1, flexShrink: 0 }} />
                <span style={{ fontSize: 12, color: "var(--red)" }}>{error}</span>
              </div>
            )}

            <div style={{ display: "flex", alignItems: "center", gap: 6, justifyContent: "center", marginTop: 22 }}>
              <Wallet size={12} color={sub} />
              <p style={{ fontSize: 11, color: sub, margin: 0 }}>
                New here? Connecting a wallet creates your OutcomX account automatically.
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
