"use client";
import { useState, useEffect } from "react";
import { useStore } from "@/lib/store";
import { useCurrency } from "@/lib/useCurrency";
import { apiFetch } from "@/lib/api";
import { MessageCircle, Send, Heart } from "lucide-react";

// Extend apiFetch for comments (not exported, so we call fetch directly)
async function apiGetComments(marketId: number) {
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000"}/api/markets/${marketId}/comments`);
    const json = await res.json();
    return json.success ? (json.data as Comment[]) : [];
  } catch { return []; }
}

async function apiPostComment(marketId: number, content: string, token: string) {
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000"}/api/markets/${marketId}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ content }),
    });
    const json = await res.json();
    return json.success ? json.data : null;
  } catch { return null; }
}

interface Comment {
  id: number;
  content: string;
  username: string;
  avatar: string;
  userPosition: string | null;
  userStake: number | null;
  createdAt: string;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

interface Props { marketId: number; }

export default function CommentSection({ marketId }: Props) {
  const { isLoggedIn, userProfile } = useStore();
  const { fmt } = useCurrency();
  const [comments, setComments]   = useState<Comment[]>([]);
  const [loading, setLoading]     = useState(true);
  const [content, setContent]     = useState("");
  const [posting, setPosting]     = useState(false);

  useEffect(() => {
    setLoading(true);
    apiGetComments(marketId).then(data => {
      setComments(data);
      setLoading(false);
    });
  }, [marketId]);

  const handlePost = async () => {
    if (!content.trim() || !isLoggedIn) return;
    const token = localStorage.getItem("outcomx_token") ?? "";
    setPosting(true);
    const comment = await apiPostComment(marketId, content.trim(), token);
    if (comment) {
      setComments(prev => [comment, ...prev]);
      setContent("");
    }
    setPosting(false);
  };

  const initials = (name: string) => name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);

  return (
    <div className="card" style={{ padding: 0, overflow: "hidden" }}>
      {/* Header */}
      <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 8 }}>
        <MessageCircle size={15} color="var(--emerald)" />
        <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>
          Comments
        </h3>
        <span style={{ fontSize: 11, fontWeight: 700, background: "var(--bg-card-hover)", border: "1px solid var(--border)", padding: "1px 7px", borderRadius: 10, color: "var(--text-secondary)" }}>
          {comments.length}
        </span>
      </div>

      {/* Input — only when logged in */}
      {isLoggedIn && (
        <div style={{ padding: "12px 18px", borderBottom: "1px solid var(--border)", display: "flex", gap: 10, alignItems: "flex-start" }}>
          {/* Avatar */}
          <div style={{ width: 32, height: 32, borderRadius: "50%", flexShrink: 0, background: userProfile.avatar ? "transparent" : "linear-gradient(135deg, #10b981, #059669)", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
            {userProfile.avatar
              ? <img src={userProfile.avatar} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              : <span style={{ fontSize: 11, fontWeight: 800, color: "#fff" }}>{initials(userProfile.name)}</span>}
          </div>
          <div style={{ flex: 1, display: "flex", gap: 8 }}>
            <input
              className="input-dark"
              placeholder="Add a comment…"
              value={content}
              onChange={e => setContent(e.target.value)}
              onKeyDown={e => e.key === "Enter" && !e.shiftKey && handlePost()}
              maxLength={500}
              style={{ flex: 1, fontSize: 13 }}
            />
            <button
              onClick={handlePost}
              disabled={posting || !content.trim()}
              style={{
                width: 36, height: 36, borderRadius: 8, flexShrink: 0,
                background: content.trim() ? "var(--emerald)" : "var(--bg-card-hover)",
                border: "none", color: "#fff", cursor: content.trim() ? "pointer" : "not-allowed",
                display: "flex", alignItems: "center", justifyContent: "center",
                transition: "all 0.15s",
              }}
            >
              <Send size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Comment list */}
      {loading ? (
        <div style={{ padding: "24px 18px", textAlign: "center" }}>
          <span style={{ width: 18, height: 18, border: "2px solid var(--border)", borderTopColor: "var(--emerald)", borderRadius: "50%", display: "inline-block", animation: "spin 0.8s linear infinite" }} />
        </div>
      ) : comments.length === 0 ? (
        <div style={{ padding: "32px 18px", textAlign: "center" }}>
          <MessageCircle size={28} style={{ margin: "0 auto 10px", opacity: 0.2, display: "block" }} />
          <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: 0 }}>
            No comments yet — be the first
          </p>
        </div>
      ) : (
        <div>
          {comments.map((c, i) => (
            <div key={c.id} style={{
              display: "flex", gap: 12, padding: "14px 18px",
              borderBottom: i < comments.length - 1 ? "1px solid var(--border)" : "none",
            }}>
              {/* Avatar */}
              <div style={{ width: 34, height: 34, borderRadius: "50%", flexShrink: 0, background: c.avatar ? "transparent" : "linear-gradient(135deg, #6366f1, #4f46e5)", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
                {c.avatar
                  ? <img src={c.avatar} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  : <span style={{ fontSize: 11, fontWeight: 800, color: "#fff" }}>{initials(c.username)}</span>}
              </div>

              {/* Content */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>
                    {c.username}
                  </span>
                  {/* User's position badge */}
                  {c.userPosition && (
                    <span style={{
                      fontSize: 10, fontWeight: 700, padding: "1px 7px", borderRadius: 20,
                      background: c.userPosition === "Yes" || c.userPosition === "Up" ? "var(--emerald-bg)" : "var(--red-bg)",
                      color: c.userPosition === "Yes" || c.userPosition === "Up" ? "var(--emerald)" : "var(--red)",
                      border: `1px solid ${c.userPosition === "Yes" || c.userPosition === "Up" ? "var(--emerald-border)" : "var(--red-border)"}`,
                    }}>
                      {c.userPosition} {c.userStake ? `· ${fmt(c.userStake)}` : ""}
                    </span>
                  )}
                  <span style={{ fontSize: 11, color: "var(--text-muted)", marginLeft: "auto" }}>
                    {timeAgo(c.createdAt)}
                  </span>
                </div>
                <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: 0, lineHeight: 1.5 }}>
                  {c.content}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {!isLoggedIn && (
        <div style={{ padding: "12px 18px", borderTop: "1px solid var(--border)", textAlign: "center" }}>
          <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: 0 }}>
            <a href="/login" style={{ color: "var(--emerald)", textDecoration: "none", fontWeight: 600 }}>Log in</a> to join the discussion
          </p>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
