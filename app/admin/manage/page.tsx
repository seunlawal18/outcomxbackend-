"use client";
import { useState, useRef, useEffect } from "react";
import { useStore } from "@/lib/store";
import { apiAdminGetMarkets } from "@/lib/api";
import { Market, MarketCategory, DURATION_LABELS } from "@/lib/types";
import {
  Pencil, Trash2, Power, PowerOff, Search, X, Save,
  ListFilter, Clock, CheckCircle2, XCircle, ImagePlus,
  RefreshCw, AlertCircle,
} from "lucide-react";
import Countdown from "@/components/Countdown";

export default function ManageMarketsPage() {
  const { markets, updateMarket, deleteMarket, toggleMarketStatus, fetchMarkets } = useStore();
  const [search, setSearch]               = useState("");
  const [editingId, setEditingId]         = useState<number | null>(null);
  const [editTitle, setEditTitle]         = useState("");
  const [editCategory, setEditCategory]   = useState<MarketCategory>("sports");
  const [editImage, setEditImage]         = useState<string>("");
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);
  const [statusFilter, setStatusFilter]   = useState<"all" | "open" | "closed" | "settled">("all");
  const [deleteError, setDeleteError]     = useState<string>("");
  const [refreshing, setRefreshing]       = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch ALL markets on mount so admin sees everything including new ones
  useEffect(() => {
    handleRefresh();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = markets.filter(m => {
    const matchSearch = m.title.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || m.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const startEdit = (m: Market) => {
    setEditingId(m.id);
    setEditTitle(m.title);
    setEditCategory(m.category);
    setEditImage(m.image || "");
  };

  const saveEdit = () => {
    if (editingId) {
      updateMarket(editingId, { title: editTitle, category: editCategory, image: editImage || undefined });
      setEditingId(null);
    }
  };

  const handleDelete = async (id: number) => {
    setDeleteError("");
    await deleteMarket(id);
    setConfirmDelete(null);
    // Re-fetch to confirm backend deletion
    await fetchMarkets();
    const stillExists = useStore.getState().markets.find(m => m.id === id);
    if (stillExists) {
      setDeleteError(`Market #${id} could not be deleted. Please try again or refresh.`);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    const res = await apiAdminGetMarkets();
    if (res.ok && res.data) {
      // Replace entire store with admin view (all statuses)
      useStore.setState({ markets: res.data.map((m: any) => ({
        id:               m.id,
        title:            m.title,
        category:         m.category,
        type:             m.type,
        options:          m.options,
        status:           m.status,
        result:           m.result,
        volume:           m.volume,
        createdAt:        m.createdAt,
        probabilities:    m.probabilities,
        trending:         m.trending,
        duration:         m.duration,
        expiresAt:        m.expiresAt,
        image:            m.image ?? undefined,
        banner:           m.banner ?? undefined,
        resolutionSource: m.resolutionSource ?? undefined,
        platformFee:      m.platformFee ?? null,
        prizePool:        m.prizePool ?? null,
      })) });
    }
    setRefreshing(false);
  };

  const handleImageFile = (file: File) => {
    if (!file.type.startsWith("image/")) return;
    if (file.size > 2 * 1024 * 1024) return;
    const reader = new FileReader();
    reader.onload = e => setEditImage(e.target?.result as string);
    reader.readAsDataURL(file);
  };

  const categories: MarketCategory[] = ["sports","crypto","politics","finance","esports","entertainment","economy"];
  const statusColors: Record<string, string> = { open: "#10b981", closed: "#ef4444", settled: "#8b8fa8" };

  return (
    <div style={{ padding: "28px 24px" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: "linear-gradient(135deg, #6366f1, #4f46e5)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <ListFilter size={22} color="white" />
          </div>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>Manage Markets</h1>
            <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: 0 }}>{markets.length} total markets</p>
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          {/* Refresh button */}
          <button onClick={handleRefresh} disabled={refreshing} style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "7px 14px", borderRadius: 8, fontSize: 13, fontWeight: 600,
            background: "var(--bg-card-hover)", border: "1px solid var(--border)",
            color: "var(--text-secondary)", cursor: refreshing ? "not-allowed" : "pointer",
            opacity: refreshing ? 0.6 : 1, transition: "all 0.15s",
          }}>
            <RefreshCw size={13} style={{ animation: refreshing ? "spin 0.8s linear infinite" : "none" }} />
            {refreshing ? "Refreshing…" : "Refresh"}
          </button>

          {/* Status filter */}
          <div style={{ display: "flex", gap: 6 }}>
            {(["all","open","closed","settled"] as const).map(s => (
              <button key={s} onClick={() => setStatusFilter(s)} style={{
                padding: "7px 12px", borderRadius: 8, fontSize: 12, fontWeight: 600,
                cursor: "pointer", border: "1px solid",
                borderColor: statusFilter === s ? (s === "all" ? "var(--emerald)" : statusColors[s] || "var(--emerald)") : "var(--border)",
                background: statusFilter === s ? (s === "all" ? "var(--emerald-bg)" : `${statusColors[s] || "#10b981"}18`) : "var(--bg-card-hover)",
                color: statusFilter === s ? (s === "all" ? "var(--emerald)" : statusColors[s] || "var(--emerald)") : "var(--text-secondary)",
                textTransform: "capitalize", transition: "all 0.15s",
              }}>
                {s}
              </button>
            ))}
          </div>

          {/* Search */}
          <div style={{ position: "relative" }}>
            <Search size={14} style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
            <input className="input-dark" placeholder="Search markets..." value={search}
              onChange={e => setSearch(e.target.value)} style={{ paddingLeft: 34, fontSize: 13, width: 220 }} />
          </div>
        </div>
      </div>

      {/* Delete error banner */}
      {deleteError && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderRadius: 10, marginBottom: 16, background: "var(--red-bg)", border: "1px solid var(--red-border)" }}>
          <AlertCircle size={15} color="var(--red)" />
          <span style={{ fontSize: 13, color: "var(--red)", flex: 1 }}>{deleteError}</span>
          <button onClick={() => setDeleteError("")} style={{ background: "none", border: "none", color: "var(--red)", cursor: "pointer", fontSize: 18, lineHeight: 1 }}>×</button>
        </div>
      )}

      <div className="card" style={{ overflow: "hidden", padding: 0 }}>
        {/* Table header */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 90px 70px 80px 100px 140px", padding: "11px 18px", borderBottom: "1px solid var(--border)", background: "var(--bg-primary)" }}>
          {["Market", "Category", "Type", "Duration", "Status", "Actions"].map(h => (
            <span key={h} style={{ fontSize: 11, color: "var(--text-secondary)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.4px" }}>{h}</span>
          ))}
        </div>

        {filtered.length === 0 ? (
          <div style={{ padding: "40px 20px", textAlign: "center", color: "var(--text-secondary)" }}>
            No markets found
          </div>
        ) : (
          filtered.map(m => (
            <div key={m.id}>
              {editingId === m.id ? (
                <div style={{ padding: "16px 18px", borderBottom: "1px solid var(--border)", background: "var(--emerald-bg)", display: "flex", flexDirection: "column", gap: 14 }}>
                  <textarea className="input-dark" value={editTitle} onChange={e => setEditTitle(e.target.value)}
                    rows={2} style={{ fontSize: 14, resize: "vertical", fontFamily: "inherit", minHeight: 52 }} placeholder="Market title" />

                  {/* Image */}
                  <div style={{ display: "flex", gap: 10, alignItems: "flex-start", flexWrap: "wrap" }}>
                    {editImage && (
                      <div style={{ position: "relative", flexShrink: 0 }}>
                        <img src={editImage} alt="preview" style={{ width: 80, height: 60, objectFit: "cover", borderRadius: 8, border: "1px solid var(--border)", display: "block" }} />
                        <button onClick={() => setEditImage("")} style={{ position: "absolute", top: -6, right: -6, width: 20, height: 20, borderRadius: "50%", background: "#ef4444", border: "none", color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <X size={11} />
                        </button>
                      </div>
                    )}
                    <button onClick={() => fileInputRef.current?.click()} style={{ display: "flex", alignItems: "center", gap: 7, padding: "8px 14px", borderRadius: 8, background: "var(--bg-card-hover)", border: "1px dashed var(--border)", color: "var(--text-secondary)", fontSize: 13, cursor: "pointer" }}>
                      <ImagePlus size={14} /> {editImage ? "Change image" : "Upload image"}
                    </button>
                    <input ref={fileInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={e => { const f = e.target.files?.[0]; if (f) handleImageFile(f); }} />
                  </div>

                  {/* Category */}
                  <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
                    {categories.map(cat => (
                      <button key={cat} onClick={() => setEditCategory(cat)} style={{
                        padding: "4px 11px", borderRadius: 20, fontSize: 12, cursor: "pointer", border: "1px solid",
                        borderColor: editCategory === cat ? "var(--emerald)" : "var(--border)",
                        background: editCategory === cat ? "var(--emerald-bg)" : "var(--bg-card-hover)",
                        color: editCategory === cat ? "var(--emerald)" : "var(--text-secondary)",
                        textTransform: "capitalize",
                      }}>{cat}</button>
                    ))}
                  </div>

                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={saveEdit} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 8, background: "var(--emerald)", border: "none", color: "white", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                      <Save size={13} /> Save Changes
                    </button>
                    <button onClick={() => setEditingId(null)} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 8, background: "var(--bg-card-hover)", border: "1px solid var(--border)", color: "var(--text-secondary)", fontSize: 13, cursor: "pointer" }}>
                      <X size={13} /> Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  style={{ display: "grid", gridTemplateColumns: "1fr 90px 70px 80px 100px 140px", padding: "12px 18px", borderBottom: "1px solid var(--border)", alignItems: "center", transition: "background 0.15s" }}
                  onMouseEnter={e => (e.currentTarget.style.background = "var(--bg-card-hover)")}
                  onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                >
                  <div style={{ paddingRight: 12, display: "flex", alignItems: "center", gap: 10 }}>
                    {m.image ? (
                      <img src={m.image} alt="" style={{ width: 36, height: 36, borderRadius: 7, objectFit: "cover", border: "1px solid var(--border)", flexShrink: 0 }} />
                    ) : (
                      <div style={{ width: 36, height: 36, borderRadius: 7, background: "var(--bg-card-hover)", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 16 }}>📊</div>
                    )}
                    <div>
                      <span style={{ fontSize: 13, color: "var(--text-primary)", display: "block" }}>
                        {m.title.length > 44 ? m.title.slice(0, 44) + "…" : m.title}
                      </span>
                      {m.status === "open" && <Countdown expiresAt={m.expiresAt} duration={m.duration} compact />}
                    </div>
                  </div>
                  <span style={{ fontSize: 12, color: "var(--text-secondary)", textTransform: "capitalize" }}>{m.category}</span>
                  <span style={{ fontSize: 11, color: "#6366f1", fontWeight: 700 }}>
                    {m.type === "MULTI_YESNO" ? "MULTI+Y/N" : m.type.replace("_", "/")}
                  </span>
                  <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <Clock size={11} color="var(--text-muted)" />
                    <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>{DURATION_LABELS[m.duration]}</span>
                  </div>
                  <span className={`badge-${m.status}`} style={{ fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 20, textTransform: "uppercase", display: "inline-block" }}>
                    {m.status}
                  </span>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {/* Edit */}
                    <button onClick={() => startEdit(m)} title="Edit" style={{ width: 30, height: 30, borderRadius: 7, background: "var(--bg-card-hover)", border: "1px solid var(--border)", color: "var(--text-secondary)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.15s" }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "#6366f1"; (e.currentTarget as HTMLElement).style.color = "#6366f1"; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "var(--border)"; (e.currentTarget as HTMLElement).style.color = "var(--text-secondary)"; }}>
                      <Pencil size={13} />
                    </button>

                    {/* Toggle */}
                    {m.status !== "settled" && (
                      <button onClick={() => toggleMarketStatus(m.id)} title={m.status === "open" ? "Close market" : "Open market"}
                        style={{ width: 30, height: 30, borderRadius: 7, background: "var(--bg-card-hover)", border: "1px solid var(--border)", color: m.status === "open" ? "#10b981" : "var(--text-secondary)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.15s" }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = m.status === "open" ? "#ef4444" : "#10b981"; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "var(--border)"; }}>
                        {m.status === "open" ? <PowerOff size={13} /> : <Power size={13} />}
                      </button>
                    )}

                    {/* Delete */}
                    {confirmDelete === m.id ? (
                      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                        {m.status === "settled" && (
                          <span style={{ fontSize: 9, color: "var(--red)", fontWeight: 600 }}>
                            Deletes all trade history
                          </span>
                        )}
                        <div style={{ display: "flex", gap: 4 }}>
                          <button onClick={() => handleDelete(m.id)} style={{ display: "flex", alignItems: "center", gap: 3, padding: "4px 8px", borderRadius: 6, background: "#ef4444", border: "none", color: "white", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                            <CheckCircle2 size={11} /> Yes
                          </button>
                          <button onClick={() => setConfirmDelete(null)} style={{ display: "flex", alignItems: "center", gap: 3, padding: "4px 8px", borderRadius: 6, background: "var(--bg-card-hover)", border: "1px solid var(--border)", color: "var(--text-secondary)", fontSize: 11, cursor: "pointer" }}>
                            <XCircle size={11} /> No
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button onClick={() => setConfirmDelete(m.id)} title="Delete" style={{ width: 30, height: 30, borderRadius: 7, background: "var(--bg-card-hover)", border: "1px solid var(--border)", color: "var(--red)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.15s" }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "var(--red-bg)"; (e.currentTarget as HTMLElement).style.borderColor = "var(--red-border)"; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "var(--bg-card-hover)"; (e.currentTarget as HTMLElement).style.borderColor = "var(--border)"; }}>
                        <Trash2 size={13} />
                      </button>
                    )}                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
