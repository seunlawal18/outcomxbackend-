"use client";
import { useToastStore, ToastType } from "@/lib/toastStore";
import { CheckCircle2, XCircle, Info, X } from "lucide-react";

const ICON: Record<ToastType, React.ReactNode> = {
  success: <CheckCircle2 size={17} color="var(--emerald)" />,
  error:   <XCircle size={17} color="var(--red)" />,
  info:    <Info size={17} color="#6366f1" />,
};

const ACCENT: Record<ToastType, string> = {
  success: "var(--emerald)",
  error:   "var(--red)",
  info:    "#6366f1",
};

export default function ToastContainer() {
  const { toasts, removeToast } = useToastStore();

  if (toasts.length === 0) return null;

  return (
    <div
      style={{
        position: "fixed",
        bottom: "max(16px, env(safe-area-inset-bottom))",
        right: 16,
        left: 16,
        zIndex: 1000,
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-end",
        gap: 8,
        pointerEvents: "none",
      }}
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          className="toast-item"
          role="status"
          style={{
            pointerEvents: "auto",
            display: "flex",
            alignItems: "center",
            gap: 10,
            width: "100%",
            maxWidth: 360,
            padding: "12px 14px",
            borderRadius: 12,
            background: "var(--bg-card)",
            border: "1px solid var(--border)",
            borderLeft: `3px solid ${ACCENT[t.type]}`,
            boxShadow: "0 8px 28px rgba(0,0,0,0.28)",
          }}
        >
          <span style={{ flexShrink: 0, display: "flex" }}>{ICON[t.type]}</span>
          <span style={{ flex: 1, fontSize: 13, fontWeight: 500, color: "var(--text-primary)", lineHeight: 1.4 }}>
            {t.message}
          </span>
          <button
            onClick={() => removeToast(t.id)}
            aria-label="Dismiss"
            style={{
              flexShrink: 0, background: "none", border: "none", cursor: "pointer",
              color: "var(--text-muted)", display: "flex", padding: 2, borderRadius: 4,
            }}
          >
            <X size={14} />
          </button>
        </div>
      ))}

      <style>{`
        .toast-item {
          animation: toast-in 0.25s cubic-bezier(0.32, 0.72, 0, 1);
        }
        @keyframes toast-in {
          from { opacity: 0; transform: translateY(8px) scale(0.98); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @media (min-width: 640px) {
          .toast-item { width: auto; }
        }
      `}</style>
    </div>
  );
}
