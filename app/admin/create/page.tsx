"use client";
import { useState, useRef, useEffect } from "react";
import { useStore } from "@/lib/store";
import { useRouter } from "next/navigation";
import { MarketType, MarketCategory, MarketDuration, DURATION_LABELS } from "@/lib/types";
import {
  PlusCircle, X, CheckCircle2, Sparkles, Tag, Layers,
  ToggleLeft, Clock, AlignJustify, Clock3, Clock4,
  CalendarDays, BarChart3, TrendingUp, CalendarRange,
  ImagePlus, Trash2, Percent, AlertCircle, Link2, FileText,
} from "lucide-react";

const durationIcons: Record<MarketDuration, React.ReactNode> = {
  "5min":    <AlignJustify size={14} />,
  "15min":   <Clock3 size={14} />,
  "1hour":   <Clock4 size={14} />,
  "4hours":  <Clock size={14} />,
  "daily":   <CalendarDays size={14} />,
  "weekly":  <BarChart3 size={14} />,
  "monthly": <TrendingUp size={14} />,
  "yearly":  <CalendarRange size={14} />,
};

const durations = Object.keys(DURATION_LABELS) as MarketDuration[];

const MARKET_TYPE_INFO: Record<MarketType, { label: string; desc: string; example: string }> = {
  YES_NO:      { label: "Yes / No",          desc: "Binary — will something happen or not",              example: "Will BTC hit $100K?" },
  UP_DOWN:     { label: "Up / Down",          desc: "Directional — price goes up or down",               example: "BTC Up or Down in 5 min?" },
  MULTI:       { label: "Multi outcome",      desc: "Multiple outcomes — pick one winner",               example: "Arsenal vs Draw vs Newcastle" },
  MULTI_YESNO: { label: "Multi + Yes/No",     desc: "Multiple outcomes each with Yes/No trade buttons",  example: "Chelsea 65% Yes/No, Man U 35% Yes/No" },
};

function Section({ icon, title, subtitle, children }: {
  icon: React.ReactNode; title: string; subtitle?: string; children: React.ReactNode;
}) {
  return (
    <div>
      <div style={{ marginBottom: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ color: "var(--emerald)" }}>{icon}</span>
          <p style={{ fontSize: 12, color: "var(--text-secondary)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", margin: 0 }}>
            {title}
          </p>
        </div>
        {subtitle && <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "4px 0 0 22px" }}>{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

export default function CreateMarketPage() {
  const { createMarket } = useStore();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [title, setTitle]                 = useState("");
  const [category, setCategory]           = useState<MarketCategory>("sports");
  const [type, setType]                   = useState<MarketType>("YES_NO");
  const [duration, setDuration]           = useState<MarketDuration>("daily");
  const [customOptions, setCustomOptions] = useState<string[]>(["Team A", "Draw", "Team B"]);
  const [newOption, setNewOption]         = useState("");
  const [image, setImage]                 = useState<string>("");
  const [banner, setBanner]               = useState<string>("");
  const [resolutionSource, setResolutionSource] = useState<string>("");
  const [imageError, setImageError]       = useState("");
  const [isDragging, setIsDragging]       = useState(false);
  const [success, setSuccess]             = useState(false);
  const [submitting, setSubmitting]       = useState(false);
  const [error, setError]                 = useState("");

  // Opening probabilities — admin sets these
  const [probInputs, setProbInputs] = useState<Record<string, string>>({});

  const getOptions = (): string[] => {
    if (type === "YES_NO")               return ["Yes", "No"];
    if (type === "UP_DOWN")              return ["Up", "Down"];
    if (type === "MULTI" || type === "MULTI_YESNO") return customOptions;
    return customOptions;
  };

  const options = getOptions();

  // Initialise prob inputs when options change
  useEffect(() => {
    const opts = getOptions();
    const equal = Math.floor(100 / opts.length);
    const newInputs: Record<string, string> = {};
    opts.forEach((opt, i) => {
      // Keep existing value if option already had one
      newInputs[opt] = probInputs[opt] ?? (i === 0
        ? String(100 - equal * (opts.length - 1))
        : String(equal));
    });
    setProbInputs(newInputs);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, customOptions]);

  const probTotal = options.reduce((s, opt) => s + (parseFloat(probInputs[opt] || "0") || 0), 0);
  const probValid = Math.abs(probTotal - 100) <= 1;

  const setProbFor = (opt: string, val: string) => {
    setProbInputs(prev => ({ ...prev, [opt]: val }));
  };

  // Auto-balance: set last option to make total = 100
  const autoBalance = () => {
    if (options.length < 2) return;
    const allButLast = options.slice(0, -1);
    const sumRest = allButLast.reduce((s, o) => s + (parseFloat(probInputs[o] || "0") || 0), 0);
    const last = Math.max(1, Math.min(99, Math.round(100 - sumRest)));
    setProbInputs(prev => ({ ...prev, [options[options.length - 1]]: String(last) }));
  };

  const handleAddOption = () => {
    const trimmed = newOption.trim();
    if (trimmed && !customOptions.includes(trimmed) && customOptions.length < 10) {
      setCustomOptions([...customOptions, trimmed]);
      setNewOption("");
    }
  };

  const removeOption = (opt: string) => {
    if (customOptions.length <= 2) return;
    setCustomOptions(customOptions.filter(o => o !== opt));
    setProbInputs(prev => { const n = { ...prev }; delete n[opt]; return n; });
  };

  const updateOption = (idx: number, val: string) => {
    const old = customOptions[idx];
    const updated = [...customOptions];
    updated[idx] = val;
    setCustomOptions(updated);
    setProbInputs(prev => {
      const n = { ...prev };
      n[val] = n[old] ?? "";
      if (val !== old) delete n[old];
      return n;
    });
  };

  const processImageFile = (file: File) => {
    setImageError("");
    if (!file.type.startsWith("image/")) { setImageError("Please upload an image file."); return; }
    if (file.size > 2 * 1024 * 1024)    { setImageError("Image must be under 2MB."); return; }
    const reader = new FileReader();
    reader.onload = (e) => setImage(e.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleSubmit = async () => {
    setError("");
    if (!title.trim() || title.trim().length < 10) {
      setError("Market title must be at least 10 characters.");
      return;
    }
    if (!probValid) {
      setError(`Probabilities must sum to 100 (currently ${probTotal.toFixed(0)}%). Use Auto-balance to fix.`);
      return;
    }

    const finalProbs: Record<string, number> = {};
    options.forEach(opt => { finalProbs[opt] = parseFloat(probInputs[opt] || "0") || 0; });

    setSubmitting(true);
    await createMarket({
      title: title.trim(), category, type, duration,
      options, status: "open", result: null,
      image: image || undefined,
      banner: banner.trim() || undefined,
      resolutionSource: resolutionSource.trim() || undefined,
      probabilities: finalProbs,
    });
    setSuccess(true);
    setTimeout(() => router.push("/admin/manage"), 1500);
  };

  const categories: MarketCategory[] = ["sports","crypto","politics","finance","esports","entertainment","economy"];
  const optionColors = ["#10b981","#ef4444","#f59e0b","#6366f1","#3b82f6","#8b5cf6","#ec4899","#14b8a6","#f97316","#84cc16"];

  return (
    <div style={{ padding: "28px 24px", maxWidth: 720 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
        <div style={{ width: 44, height: 44, borderRadius: 12, background: "linear-gradient(135deg, #10b981, #059669)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Sparkles size={22} color="white" />
        </div>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>Create Market</h1>
          <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: 0 }}>Add a new prediction market to the platform</p>
        </div>
      </div>

      <div className="card" style={{ padding: 24, display: "flex", flexDirection: "column", gap: 24 }}>

        {/* ── Market Image ── */}
        <Section icon={<ImagePlus size={15} />} title="Market Image (optional)">
          {image ? (
            <div style={{ position: "relative", display: "inline-block", width: "100%" }}>
              <img src={image} alt="preview" style={{ width: "100%", maxHeight: 160, objectFit: "cover", borderRadius: 10, border: "1px solid var(--border)", display: "block" }} />
              <button onClick={() => { setImage(""); if (fileInputRef.current) fileInputRef.current.value = ""; }}
                style={{ position: "absolute", top: 8, right: 8, width: 30, height: 30, borderRadius: "50%", background: "rgba(0,0,0,0.6)", border: "none", color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Trash2 size={14} />
              </button>
            </div>
          ) : (
            <div
              onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={e => { e.preventDefault(); setIsDragging(false); const f = e.dataTransfer.files?.[0]; if (f) processImageFile(f); }}
              onClick={() => fileInputRef.current?.click()}
              style={{ border: `2px dashed ${isDragging ? "var(--emerald)" : "var(--border)"}`, borderRadius: 10, padding: "20px", textAlign: "center", cursor: "pointer", background: isDragging ? "var(--emerald-bg)" : "var(--bg-card-hover)", transition: "all 0.2s" }}
            >
              <ImagePlus size={20} color="var(--text-secondary)" style={{ margin: "0 auto 8px", display: "block" }} />
              <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: 0 }}>Drop image or click to browse · JPG, PNG, WebP · Max 2MB</p>
            </div>
          )}
          <input ref={fileInputRef} type="file" accept="image/*" onChange={e => { const f = e.target.files?.[0]; if (f) processImageFile(f); }} style={{ display: "none" }} />
          {imageError && <p style={{ fontSize: 12, color: "var(--red)", marginTop: 6 }}>{imageError}</p>}
        </Section>

        {/* ── Title ── */}
        <Section icon={<Tag size={15} />} title="Market Title *">
          <textarea
            className="input-dark"
            placeholder="e.g. Will Bitcoin hit $100K by end of 2026?"
            value={title}
            onChange={e => setTitle(e.target.value)}
            rows={2}
            style={{ resize: "vertical", fontFamily: "inherit", fontSize: 14, lineHeight: 1.5, minHeight: 56 }}
          />
          <p style={{ fontSize: 11, color: title.length > 0 && title.length < 10 ? "var(--red)" : "var(--text-muted)", marginTop: 4, textAlign: "right" }}>
            {title.length} chars {title.length > 0 && title.length < 10 ? `— need ${10 - title.length} more` : ""}
          </p>
        </Section>

        {/* ── Category ── */}
        <Section icon={<Layers size={15} />} title="Category">
          <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
            {categories.map(cat => (
              <button key={cat} onClick={() => setCategory(cat)} style={{
                padding: "6px 13px", borderRadius: 20, fontSize: 13, fontWeight: 500, cursor: "pointer",
                border: "1px solid", borderColor: category === cat ? "var(--emerald)" : "var(--border)",
                background: category === cat ? "var(--emerald-bg)" : "var(--bg-card-hover)",
                color: category === cat ? "var(--emerald)" : "var(--text-secondary)",
                textTransform: "capitalize", transition: "all 0.15s",
              }}>
                {cat}
              </button>
            ))}
          </div>
        </Section>

        {/* ── Market Type ── */}
        <Section icon={<ToggleLeft size={15} />} title="Market Type">
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {(Object.entries(MARKET_TYPE_INFO) as [MarketType, typeof MARKET_TYPE_INFO[MarketType]][]).map(([t, info]) => (
              <button key={t} onClick={() => setType(t)} style={{
                flex: 1, minWidth: 140, padding: "12px 10px", borderRadius: 10, cursor: "pointer",
                border: "1px solid", borderColor: type === t ? "var(--emerald)" : "var(--border)",
                background: type === t ? "var(--emerald-bg)" : "var(--bg-card-hover)",
                color: type === t ? "var(--emerald)" : "var(--text-secondary)",
                transition: "all 0.15s", textAlign: "left",
              }}>
                <p style={{ fontSize: 13, fontWeight: 700, margin: "0 0 3px", color: type === t ? "var(--emerald)" : "var(--text-primary)" }}>
                  {info.label}
                </p>
                <p style={{ fontSize: 11, color: "var(--text-muted)", margin: "0 0 4px" }}>{info.desc}</p>
                <p style={{ fontSize: 11, color: "var(--text-muted)", margin: 0, fontStyle: "italic" }}>e.g. {info.example}</p>
              </button>
            ))}
          </div>
        </Section>

        {/* ── Duration ── */}
        <Section icon={<Clock size={15} />} title="Duration">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))", gap: 8 }}>
            {durations.map(d => (
              <button key={d} onClick={() => setDuration(d)} style={{
                padding: "9px 10px", borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: "pointer",
                border: "1px solid", borderColor: duration === d ? "var(--emerald)" : "var(--border)",
                background: duration === d ? "var(--emerald-bg)" : "var(--bg-card-hover)",
                color: duration === d ? "var(--emerald)" : "var(--text-secondary)",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 6, transition: "all 0.15s",
              }}>
                {durationIcons[d]} {DURATION_LABELS[d]}
              </button>
            ))}
          </div>
        </Section>

        {/* ── Options (MULTI / MULTI_YESNO) ── */}
        {(type === "MULTI" || type === "MULTI_YESNO") && (
          <Section icon={<PlusCircle size={15} />} title="Outcomes" subtitle="Name each possible outcome. Min 2, max 10.">
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 10 }}>
              {customOptions.map((opt, idx) => (
                <div key={idx} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ width: 10, height: 10, borderRadius: "50%", background: optionColors[idx % optionColors.length], flexShrink: 0 }} />
                  <input
                    className="input-dark"
                    value={opt}
                    onChange={e => updateOption(idx, e.target.value)}
                    placeholder={`Outcome ${idx + 1}`}
                    style={{ flex: 1, fontSize: 13 }}
                  />
                  <button
                    onClick={() => removeOption(opt)}
                    disabled={customOptions.length <= 2}
                    style={{ width: 28, height: 28, borderRadius: 6, background: "var(--red-bg)", border: "1px solid var(--red-border)", color: "var(--red)", cursor: customOptions.length <= 2 ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", opacity: customOptions.length <= 2 ? 0.4 : 1 }}
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
            {customOptions.length < 10 && (
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  className="input-dark"
                  placeholder="Add outcome..."
                  value={newOption}
                  onChange={e => setNewOption(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleAddOption()}
                  style={{ flex: 1, fontSize: 13 }}
                />
                <button onClick={handleAddOption} style={{ padding: "10px 16px", borderRadius: 8, background: "var(--emerald-bg)", border: "1px solid var(--emerald-border)", color: "var(--emerald)", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600 }}>
                  <PlusCircle size={14} /> Add
                </button>
              </div>
            )}
          </Section>
        )}

        {/* ── Opening Probabilities ── */}
        <Section
          icon={<Percent size={15} />}
          title="Opening Probabilities *"
          subtitle="Set the starting odds for each outcome. Must sum to 100%. These reflect real-world likelihood before any trades."
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {options.map((opt, idx) => {
              const val = parseFloat(probInputs[opt] || "0") || 0;
              const color = optionColors[idx % optionColors.length];
              return (
                <div key={opt} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  {/* Option label */}
                  <div style={{ display: "flex", alignItems: "center", gap: 7, minWidth: 100 }}>
                    <span style={{ width: 10, height: 10, borderRadius: "50%", background: color, flexShrink: 0 }} />
                    <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{opt}</span>
                  </div>

                  {/* Probability bar */}
                  <div style={{ flex: 1, height: 6, background: "var(--bg-card-hover)", borderRadius: 3, overflow: "hidden" }}>
                    <div style={{ width: `${Math.min(val, 100)}%`, height: "100%", background: color, borderRadius: 3, transition: "width 0.2s" }} />
                  </div>

                  {/* Input */}
                  <div style={{ position: "relative", width: 80 }}>
                    <input
                      type="number"
                      min="1" max="99"
                      className="input-dark"
                      value={probInputs[opt] ?? ""}
                      onChange={e => setProbFor(opt, e.target.value)}
                      style={{ paddingRight: 22, fontSize: 14, fontWeight: 700, textAlign: "right" }}
                    />
                    <span style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", fontSize: 13, color: "var(--text-muted)", pointerEvents: "none" }}>%</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Total indicator */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 14, padding: "10px 14px", borderRadius: 10, background: probValid ? "var(--emerald-bg)" : "var(--red-bg)", border: `1px solid ${probValid ? "var(--emerald-border)" : "var(--red-border)"}` }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {probValid
                ? <CheckCircle2 size={14} color="var(--emerald)" />
                : <AlertCircle size={14} color="var(--red)" />}
              <span style={{ fontSize: 13, fontWeight: 600, color: probValid ? "var(--emerald)" : "var(--red)" }}>
                Total: {probTotal.toFixed(0)}% {probValid ? "✓ Valid" : `— needs to be 100%`}
              </span>
            </div>
            <button
              onClick={autoBalance}
              style={{ fontSize: 12, fontWeight: 600, padding: "4px 10px", borderRadius: 6, background: "var(--bg-card-hover)", border: "1px solid var(--border)", color: "var(--text-secondary)", cursor: "pointer" }}
            >
              Auto-balance
            </button>
          </div>

          {/* Helpful note */}
          <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 8, lineHeight: 1.5 }}>
            💡 These are opening odds only. As users place trades, probabilities shift automatically based on trading volume.
          </p>
        </Section>

        {/* ── Banner URL (optional) ── */}
        <Section icon={<Link2 size={15} />} title="Banner Image URL (optional)" subtitle="Wide banner shown at the top of the market page. Use a direct image URL (https://...).">
          <input
            className="input-dark"
            type="url"
            placeholder="https://example.com/banner.jpg"
            value={banner}
            onChange={e => setBanner(e.target.value)}
            style={{ fontSize: 13 }}
          />
        </Section>

        {/* ── Resolution Source ── */}
        <Section icon={<FileText size={15} />} title="Resolution Source" subtitle="Where will the result be verified? Shown to users so they know how the market will be settled.">
          <input
            className="input-dark"
            type="text"
            placeholder="e.g. Official Premier League match result / Binance BTC/USDT spot price"
            value={resolutionSource}
            onChange={e => setResolutionSource(e.target.value)}
            style={{ fontSize: 13 }}
          />
          <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 6 }}>
            💡 Examples: "BBC Sport match report", "CoinGecko BTC price at expiry", "Official election results"
          </p>
        </Section>

        {/* ── Preview ── */}
        <Section icon={<Sparkles size={15} />} title="Preview">
          <div style={{ padding: "14px 16px", borderRadius: 10, background: "var(--bg-card-hover)", border: "1px solid var(--border)" }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", margin: "0 0 10px" }}>
              {title || "Market title will appear here…"}
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {options.map((opt, idx) => {
                const prob = parseFloat(probInputs[opt] || "0") || 0;
                const color = optionColors[idx % optionColors.length];
                return (
                  <div key={opt} style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 10px", borderRadius: 8, background: `${color}18`, border: `1px solid ${color}40` }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color }}>{opt}</span>
                    <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>{prob}%</span>
                  </div>
                );
              })}
            </div>
            <p style={{ fontSize: 11, color: "var(--text-muted)", margin: "8px 0 0" }}>
              {category} · {DURATION_LABELS[duration]} · {type.replace("_", "/")}
            </p>
          </div>
        </Section>

        {/* ── Error ── */}
        {error && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderRadius: 10, background: "var(--red-bg)", border: "1px solid var(--red-border)" }}>
            <AlertCircle size={15} color="var(--red)" />
            <span style={{ fontSize: 13, color: "var(--red)" }}>{error}</span>
          </div>
        )}

        {/* ── Submit ── */}
        {success ? (
          <div className="fade-in" style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px", background: "var(--emerald-bg)", border: "1px solid var(--emerald-border)", borderRadius: 10, color: "var(--emerald)", fontWeight: 600 }}>
            <CheckCircle2 size={18} /> Market created! Redirecting…
          </div>
        ) : (
          <button
            className="btn-emerald"
            onClick={handleSubmit}
            disabled={submitting || !title.trim() || title.trim().length < 10 || !probValid}
            style={{ fontSize: 15, padding: "13px", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
          >
            {submitting ? (
              <><span style={{ width: 16, height: 16, border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", borderRadius: "50%", display: "inline-block", animation: "spin 0.8s linear infinite" }} /> Creating…</>
            ) : (
              <><Sparkles size={16} /> Create Market</>
            )}
          </button>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
