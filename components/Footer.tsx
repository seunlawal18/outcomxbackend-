"use client";
import Link from "next/link";
import { TrendingUp, ArrowUp, Mail, MapPin } from "lucide-react";

const quickLinks = [
  { label: "FAQs",               href: "#" },
  { label: "Blog",               href: "#" },
  { label: "Careers",            href: "#" },
  { label: "Help Center",        href: "#" },
  { label: "API Documentation",  href: "#" },
];

const legalLinks = [
  { label: "Privacy Policy",           href: "#" },
  { label: "Terms of Service",         href: "#" },
  { label: "Prohibition Policies",     href: "#" },
  { label: "Dispute Resolution Policy",href: "#" },
];

function XIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.746l7.73-8.835L1.254 2.25H8.08l4.253 5.622 5.911-5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}
function InstagramIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}
function LinkedInIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-4 0v7h-4v-7a6 6 0 0 1 6-6z" />
      <rect x="2" y="9" width="4" height="12" />
      <circle cx="4" cy="4" r="2" />
    </svg>
  );
}

const socials = [
  { icon: <XIcon />,         label: "X / Twitter" },
  { icon: <InstagramIcon />, label: "Instagram"   },
  { icon: <LinkedInIcon />,  label: "LinkedIn"    },
];

export default function Footer() {
  const scrollToTop = () => window.scrollTo({ top: 0, behavior: "smooth" });

  return (
    <footer className="site-footer">
      {/* ── Main grid ─────────────────────────────────────────── */}
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "52px 24px 36px" }}>
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
          gap: "36px 40px",
        }}>

          {/* Brand */}
          <div style={{ maxWidth: 260 }}>
            {/* Logo */}
            <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 6 }}>
              <div style={{
                width: 34, height: 34, borderRadius: 9,
                background: "var(--footer-icon-bg)",
                border: "1px solid var(--footer-border)",
                display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0,
              }}>
                <TrendingUp size={18} color="var(--footer-accent)" />
              </div>
              <span style={{
                fontSize: 18, fontWeight: 800,
                color: "var(--footer-text)",
                letterSpacing: "-0.5px",
              }}>
                OUTCOMX
              </span>
            </div>

            <p style={{
              fontSize: 11, fontWeight: 600,
              color: "var(--footer-accent)",
              marginBottom: 12, marginTop: 2,
              letterSpacing: "0.3px",
            }}>
              Formerly OutcomX Beta
            </p>

            <p style={{
              fontSize: 13,
              color: "var(--footer-text-sub)",
              lineHeight: 1.75,
              marginBottom: 22,
            }}>
              The future of prediction markets. Trade the future, and turn your insights into profit.
            </p>

            {/* Social icons */}
            <div style={{ display: "flex", gap: 10 }}>
              {socials.map(({ icon, label }) => (
                <a
                  key={label}
                  href="#"
                  aria-label={label}
                  style={{
                    width: 34, height: 34, borderRadius: 8,
                    background: "var(--footer-icon-bg)",
                    border: "1px solid var(--footer-border)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    color: "var(--footer-link)",
                    textDecoration: "none",
                    transition: "background 0.2s, color 0.2s, border-color 0.2s",
                  }}
                  onMouseEnter={e => {
                    const el = e.currentTarget as HTMLElement;
                    el.style.background = "var(--footer-icon-hover)";
                    el.style.color = "var(--footer-link-hover)";
                    el.style.borderColor = "var(--footer-btn-border)";
                  }}
                  onMouseLeave={e => {
                    const el = e.currentTarget as HTMLElement;
                    el.style.background = "var(--footer-icon-bg)";
                    el.style.color = "var(--footer-link)";
                    el.style.borderColor = "var(--footer-border)";
                  }}
                >
                  {icon}
                </a>
              ))}
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h4 style={{
              fontSize: 13, fontWeight: 700,
              color: "var(--footer-text)",
              marginBottom: 16, marginTop: 0,
              textTransform: "uppercase", letterSpacing: "0.6px",
            }}>
              Quick Links
            </h4>
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 11 }}>
              {quickLinks.map(({ label, href }) => (
                <li key={label}>
                  <Link
                    href={href}
                    style={{
                      fontSize: 13,
                      color: "var(--footer-link)",
                      textDecoration: "none",
                      transition: "color 0.18s",
                      display: "inline-flex", alignItems: "center", gap: 5,
                    }}
                    onMouseEnter={e => (e.currentTarget.style.color = "var(--footer-link-hover)")}
                    onMouseLeave={e => (e.currentTarget.style.color = "var(--footer-link)")}
                  >
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 style={{
              fontSize: 13, fontWeight: 700,
              color: "var(--footer-text)",
              marginBottom: 16, marginTop: 0,
              textTransform: "uppercase", letterSpacing: "0.6px",
            }}>
              Legal
            </h4>
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 11 }}>
              {legalLinks.map(({ label, href }) => (
                <li key={label}>
                  <Link
                    href={href}
                    style={{
                      fontSize: 13,
                      color: "var(--footer-link)",
                      textDecoration: "none",
                      transition: "color 0.18s",
                    }}
                    onMouseEnter={e => (e.currentTarget.style.color = "var(--footer-link-hover)")}
                    onMouseLeave={e => (e.currentTarget.style.color = "var(--footer-link)")}
                  >
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 style={{
              fontSize: 13, fontWeight: 700,
              color: "var(--footer-text)",
              marginBottom: 16, marginTop: 0,
              textTransform: "uppercase", letterSpacing: "0.6px",
            }}>
              Contact
            </h4>

            <a
              href="mailto:support@outcomx.io"
              style={{
                display: "flex", alignItems: "center", gap: 8,
                fontSize: 13, color: "var(--footer-accent)",
                textDecoration: "none", marginBottom: 14,
                transition: "opacity 0.18s",
              }}
              onMouseEnter={e => (e.currentTarget.style.opacity = "0.8")}
              onMouseLeave={e => (e.currentTarget.style.opacity = "1")}
            >
              <Mail size={14} style={{ flexShrink: 0 }} />
              support@outcomx.io
            </a>

            <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
              <MapPin size={14} color="var(--footer-text-sub)" style={{ flexShrink: 0, marginTop: 2 }} />
              <p style={{
                fontSize: 13,
                color: "var(--footer-text-sub)",
                lineHeight: 1.65, margin: 0,
              }}>
                8 The Green, Ste A, Dover<br />
                County of Kent, 19901.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Divider ───────────────────────────────────────────── */}
      <div style={{ borderTop: "1px solid var(--footer-divider)" }} />

      {/* ── Bottom bar ────────────────────────────────────────── */}
      <div className="site-footer-bottom">
        <div style={{
          maxWidth: 1200, margin: "0 auto",
          padding: "18px 24px",
          display: "flex",
          flexDirection: "column",
          gap: 10,
          position: "relative",
        }}>
          <p style={{
            fontSize: 12,
            color: "var(--footer-text-muted)",
            lineHeight: 1.75, margin: 0,
            maxWidth: 860,
            paddingRight: 52,
          }}>
            Prediction markets involve financial risk — only trade with funds you can afford to lose.
            OUTCOMX does not provide investment or financial advice. All market outcomes are resolved
            transparently using publicly verifiable sources. Participation is restricted to individuals
            18 years and older and may be limited in some jurisdictions. Please review our Terms of
            Service, Privacy Policy, and Prohibition Policy before using the platform.
          </p>

          <p style={{ fontSize: 12, color: "var(--footer-text-muted)", margin: 0 }}>
            © 2026 OUTCOMX. All rights reserved.
          </p>

          {/* Back to top */}
          <button
            onClick={scrollToTop}
            aria-label="Back to top"
            style={{
              position: "absolute", right: 24, top: "50%", transform: "translateY(-50%)",
              width: 36, height: 36, borderRadius: "50%",
              background: "var(--footer-btn-bg)",
              border: "1px solid var(--footer-btn-border)",
              color: "var(--footer-text)",
              cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              transition: "background 0.2s, border-color 0.2s",
              flexShrink: 0,
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.background = "var(--footer-btn-hover)";
              (e.currentTarget as HTMLElement).style.borderColor = "var(--footer-link-hover)";
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.background = "var(--footer-btn-bg)";
              (e.currentTarget as HTMLElement).style.borderColor = "var(--footer-btn-border)";
            }}
          >
            <ArrowUp size={16} />
          </button>
        </div>
      </div>
    </footer>
  );
}
