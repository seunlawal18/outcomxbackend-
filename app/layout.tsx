import type { Metadata, Viewport } from "next";
import "./globals.css";
import ThemeProvider from "@/components/ThemeProvider";
import SessionRestore from "@/components/SessionRestore";
import VerificationBanner from "@/components/VerificationBanner";

export const metadata: Metadata = {
  title: "OUTCOMX — Prediction Markets",
  description: "Simulated prediction market platform. Trade the future, turn your insights into profit.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="dark" data-scroll-behavior="smooth">
      <body>
        <ThemeProvider>
          <SessionRestore />
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
