import { redirect } from "next/navigation";

// /admin → redirect to /admin/dashboard
// The layout handles auth — if not logged in it redirects to /admin/login first
export default function AdminRoot() {
  redirect("/admin/dashboard");
}
