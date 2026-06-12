"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { X, ChevronLeft, ChevronRight, Zap, TrendingUp, Globe, Star } from "lucide-react";

interface Slide {
  id: number;
  tag: string;
  tagColor: string;
  headline: string;
  sub: string;
  cta: string;
  href: string;
  gradient: string;
  icon: React.ReactNode;
  accent: string;
}

const slides: Slide[] = [
  {
    id: 1,
    tag: "🔥 HOT MARKET",
    tagColor: "#f59e0b",
    headline: "Trade the Future on OUTCOMX",
    sub: "Prediction markets across sports, crypto, politics & more. Pick your side and trade the outcome.",
    cta: "Browse Markets",
    href: "/",
    gradient: "linear-gradient(135deg, #0d1b3e 0%, #0a2a5e 50%, #0d1b3e 100%)",
    icon: <span style={{ fontSize: 64, opacity: 0.15, position: "absolute", right: 40, top: "50%", transform: "translateY(-50%)" }}>₿</span>,
    accent: "#3b82f6",
  },
  {
    id: 2,
    tag: "⚡ LIVE NOW",
    tagColor: "#10b981",
    headline: "Crypto Markets — Trade in Minutes",
    sub: "Fast-paced BTC, ETH and crypto prediction markets. 5-minute to daily durations.",
    cta: "Trade Crypto",
    href: "/?category=crypto",
    gradient: "linear-gradient(135deg, #0f2027 0%, #203a43 50%, #2c5364 100%)",
    icon: <Globe size={80} style={{ opacity: 0.1, position: "absolute", right: 40, top: "50%", transform: "translateY(-50%)" }} />,
    accent: "#10b981",
  },
  {
    id: 3,
    tag: "📈 TRENDING",
    tagColor: "#6366f1",
    headline: "Sports & Esports Prediction Markets",
    sub: "Who wins the match? Trade on football, basketball, esports and more.",
    cta: "View Sports",
    href: "/?category=sports",
    gradient: "linear-gradient(135deg, #1a0533 0%, #2d1b69 50%, #1a0533 100%)",
    icon: <Star size={80} style={{ opacity: 0.1, position: "absolute", right: 40, top: "50%", transform: "translateY(-50%)" }} />,
    accent: "#6366f1",
  },
  {
    id: 4,
    tag: "🏛️ POLITICS",
    tagColor: "#ef4444",
    headline: "Political Prediction Markets",
    sub: "Elections, policy decisions, geopolitical events — trade the outcomes that shape the world.",
    cta: "Trade Politics",
    href: "/?category=politics",
    gradient: "linear-gradient(135deg, #1a0a0a 0%, #3d1515 50%, #1a0a0a 100%)",
    icon: <Zap size={80} style={{ opacity: 0.1, position: "absolute", right: 40, top: "50%", transform: "translateY(-50%)" }} />,
    accent: "#ef4444",
  },
  {
    id: 5,
    tag: "🌟 FEATURED",
    tagColor: "#f59e0b",
    headline: "New to OUTCOMX? Start Here",
    sub: "Register free and get a starting balance to trade on real prediction markets instantly.",
    cta: "Sign Up Free",
    href: "/register",
    gradient: "linear-gradient(135deg, #0d1f0d 0%, #0a3d1a 50%, #0d1f0d 100%)",
    icon: <TrendingUp size={80} style={{ opacity: 0.1, position: "absolute", right: 40, top: "50%", transform: "translateY(-50%)" }} />,
    accent: "#10b981",
  },
];

const SHOW_AFTER_MS = 3 * 60 * 1000; // 3 minutes
const AUTO_ADVANCE_MS = 5000;

export default function NewsSlideshow() {
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [current, setCurrent] = useState(0);
  const [paused, setPaused] = useState(false);
  const [progress, setProgress] = useState(0);
  const router = useRouter();
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const progressRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Show after 3 minutes
  useEffect(() => {
    const t = setTimeout(() => {
      if (!dismissed) setVisible(true);
    }, SHOW_AFTER_MS);
    return () => clearTimeout(t);
  }, [dismissed]);

  // Auto-advance + progress bar
  useEffect(() => {
    if (!visible || paused) {
      if (timerRef.current) clearInterval(timerRef.current);
      if (progressRef.current) clearInterval(progressRef.current);
      return;
    }

    setProgress(0);
    const step = 100 / (AUTO_ADVANCE_MS / 50);
    progressRef.current = setInterval(() => {
      setProgress((p) => Math.min(p + step, 100));
    }, 50);

    timerRef.current = setInterval(() => {
      setCurrent((c) => (c + 1) % slides.length);
      setProgress(0);
    }, AUTO_ADVANCE_MS);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (progressRef.current) clearInterval(progressRef.current);
    };
  }, [visible, paused, current]);

  const goTo = (i: number) => {
    setCurrent(i);
    setProgress(0);
  };
  const prev = () => goTo((current - 1 + slides.length) % slides.length);
  const next = () => goTo((current + 1) % slides.length);

  const dismiss = () => {
    setVisible(false);
    setDismissed(true);
  };

  if (!visible) return null;

  const slide = slides[current];

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        overflow: "hidden",
        borderBottom: "1px solid var(--border)",
      }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* Progress bar */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: "rgba(255,255,255,0.1)", zIndex: 10 }}>
        <div
          style={{
            height: "100%",
            width: `${progress}%`,
            background: slide.accent,
            transition: "width 0.05s linear",
          }}
        />
      </div>

      {/* Slide */}
      <div
        key={slide.id}
        style={{
          background: slide.gradient,
          padding: "clamp(14px, 3vw, 40px) clamp(16px, 5vw, 60px)",
          minHeight: "clamp(120px, 18vw, 200px)",
          display: "flex",
          alignItems: "center",
          position: "relative",
          overflow: "hidden",
          cursor: "pointer",
          animation: "fadeIn 0.4s ease",
        }}
        onClick={() => router.push(slide.href)}
      >
        {/* Background icon */}
        {slide.icon}

        {/* Decorative circles */}
        <div style={{
          position: "absolute", right: -60, top: -60,
          width: 200, height: 200, borderRadius: "50%",
          background: `${slide.accent}15`,
          pointerEvents: "none",
        }} />
        <div style={{
          position: "absolute", right: 60, bottom: -80,
          width: 160, height: 160, borderRadius: "50%",
          background: `${slide.accent}10`,
          pointerEvents: "none",
        }} />

        {/* Content */}
        <div style={{ position: "relative", zIndex: 2, maxWidth: 700 }}>
          <span style={{
            display: "inline-block",
            fontSize: "clamp(10px, 1.5vw, 12px)",
            fontWeight: 700,
            color: slide.tagColor,
            marginBottom: 8,
            letterSpacing: "0.5px",
          }}>
            {slide.tag}
          </span>
          <h2 style={{
            fontSize: "clamp(18px, 3.5vw, 32px)",
            fontWeight: 900,
            color: "#ffffff",
            margin: "0 0 8px",
            lineHeight: 1.2,
            letterSpacing: "-0.5px",
          }}>
            {slide.headline}
          </h2>
          <p style={{
            fontSize: "clamp(11px, 1.8vw, 14px)",
            color: "rgba(255,255,255,0.7)",
            margin: "0 0 12px",
            lineHeight: 1.4,
            maxWidth: 500,
          }}
          className="slideshow-sub"
          >
            {slide.sub}
          </p>
          <button
            onClick={(e) => { e.stopPropagation(); router.push(slide.href); }}
            style={{
              padding: "clamp(8px, 1.5vw, 10px) clamp(16px, 3vw, 24px)",
              borderRadius: 24,
              background: slide.accent,
              border: "none",
              color: "#fff",
              fontSize: "clamp(12px, 1.5vw, 14px)",
              fontWeight: 700,
              cursor: "pointer",
              letterSpacing: "0.5px",
              textTransform: "uppercase",
              transition: "opacity 0.2s, transform 0.2s",
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.opacity = "0.85"; (e.currentTarget as HTMLElement).style.transform = "translateY(-1px)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity = "1"; (e.currentTarget as HTMLElement).style.transform = "translateY(0)"; }}
          >
            {slide.cta} →
          </button>
        </div>

        {/* Nav arrows */}
        <button
          onClick={(e) => { e.stopPropagation(); prev(); }}
          style={{
            position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)",
            width: 32, height: 32, borderRadius: "50%",
            background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.2)",
            color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
            zIndex: 5, transition: "background 0.2s",
          }}
          onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.25)")}
          onMouseLeave={e => (e.currentTarget.style.background = "rgba(255,255,255,0.15)")}
        >
          <ChevronLeft size={16} />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); next(); }}
          style={{
            position: "absolute", right: 44, top: "50%", transform: "translateY(-50%)",
            width: 32, height: 32, borderRadius: "50%",
            background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.2)",
            color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
            zIndex: 5, transition: "background 0.2s",
          }}
          onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.25)")}
          onMouseLeave={e => (e.currentTarget.style.background = "rgba(255,255,255,0.15)")}
        >
          <ChevronRight size={16} />
        </button>

        {/* Close */}
        <button
          onClick={(e) => { e.stopPropagation(); dismiss(); }}
          style={{
            position: "absolute", right: 10, top: 10,
            width: 28, height: 28, borderRadius: "50%",
            background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.15)",
            color: "rgba(255,255,255,0.7)", cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            zIndex: 10, transition: "all 0.2s",
          }}
          onMouseEnter={e => { (e.currentTarget.style.background = "rgba(0,0,0,0.5)"); (e.currentTarget.style.color = "#fff"); }}
          onMouseLeave={e => { (e.currentTarget.style.background = "rgba(0,0,0,0.3)"); (e.currentTarget.style.color = "rgba(255,255,255,0.7)"); }}
        >
          <X size={13} />
        </button>
      </div>

      {/* Dot indicators */}
      <div style={{
        position: "absolute", bottom: 10, left: "50%", transform: "translateX(-50%)",
        display: "flex", gap: 6, zIndex: 10,
      }}>
        {slides.map((_, i) => (
          <button
            key={i}
            onClick={(e) => { e.stopPropagation(); goTo(i); }}
            style={{
              width: i === current ? 20 : 6,
              height: 6, borderRadius: 3,
              background: i === current ? slide.accent : "rgba(255,255,255,0.3)",
              border: "none", cursor: "pointer", padding: 0,
              transition: "all 0.3s ease",
            }}
          />
        ))}
      </div>

      <style>{`
        @media (max-width: 480px) {
          .slideshow-sub { display: none !important; }
        }
      `}</style>
    </div>
  );
}
