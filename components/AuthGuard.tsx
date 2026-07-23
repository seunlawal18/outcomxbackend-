"use client";
import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useStore } from "@/lib/store";

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const isLoggedIn = useStore((s) => s.isLoggedIn);
  const router     = useRouter();
  const pathname   = usePathname();

  useEffect(() => {
    if (!isLoggedIn) {
      router.replace(`/login?redirect=${encodeURIComponent(pathname)}`);
    }
  }, [isLoggedIn, pathname, router]);

  if (!isLoggedIn) return null;
  return <>{children}</>;
}
