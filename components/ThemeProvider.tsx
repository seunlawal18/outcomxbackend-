"use client";
import { useEffect } from "react";
import { useTheme } from "@/lib/themeStore";

export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { theme } = useTheme();

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    document.body.style.backgroundColor = "";
  }, [theme]);

  return <>{children}</>;
}
