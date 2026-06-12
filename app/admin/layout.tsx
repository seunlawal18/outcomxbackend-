"use client";
import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useStore } from "@/lib/store";
import AdminSidebar from "@/components/admin/AdminSidebar";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { isAdminLoggedIn } = useStore();
  const router   = useRouter();
  const pathname = usePathname();

  // Wait for Zustand to rehydrate from localStorage before making
  // any redirect decisions — prevents flash redirect on page refresh
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  // Listen for admin token expiry — redirect to login immediately
  useEffect(() => {
    const handler = () => {
      useStore.setState({ isAdminLoggedIn: false });
      router.replace(`/admin/login?from=${encodeURIComponent(pathname)}`);
    };
    window.addEventListener("admin-token-expired", handler);
    return () => window.removeEventListener("admin-token-expired", handler);
  }, [router, pathname]);

  const isLoginPage = pathname === "/admin/login";

  useEffect(() => {
    if (!mounted) return;
    // Not logged in and not on the login page → redirect to login,
    // preserving current path so we can return after login
    if (!isAdminLoggedIn && !isLoginPage) {
      router.replace(`/admin/login?from=${encodeURIComponent(pathname)}`);
    }
  }, [mounted, isAdminLoggedIn, isLoginPage, router, pathname]);

  // Render login page without the admin shell
  if (isLoginPage) {
    return <>{children}</>;
  }

  // Not mounted yet — show nothing to prevent flash
  if (!mounted) return null;

  // Mounted but not logged in — redirect is in progress
  if (!isAdminLoggedIn) return null;

  // Logged in — render full admin shell
  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "var(--bg-primary)" }}>
      <AdminSidebar />
      <main
        style={{ flex: 1, overflow: "auto", minWidth: 0 }}
        className="admin-main-content"
      >
        {children}
      </main>

      <style>{`
        @media (max-width: 768px) {
          .admin-main-content {
            padding-top: 56px;
          }
        }
      `}</style>
    </div>
  );
}
