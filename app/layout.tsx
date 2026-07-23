import type { Metadata, Viewport } from "next";
import "./globals.css";
import ThemeProvider from "@/components/ThemeProvider";
import SessionRestore from "@/components/SessionRestore";
import RealtimeSync from "@/components/RealtimeSync";
import VerificationBanner from "@/components/VerificationBanner";
import ToastContainer from "@/components/ToastContainer";
import Web3Provider from "@/components/providers/Web3Provider";

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
        <Web3Provider>
          <ThemeProvider>
            <SessionRestore />
            <RealtimeSync />
            {children}
            <ToastContainer />
          </ThemeProvider>
        </Web3Provider>
      </body>
    </html>
  );
}
