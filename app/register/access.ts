import { redirect } from "next/navigation";
import { hasPermission } from "@/lib/rbac";

export async function requireRegisterAccess() {
  const [hasAccess, canOpen] = await Promise.all([
    hasPermission("pos.access"),
    hasPermission("pos.counter.open"),
  ]);
  if (!hasAccess || !canOpen) {
    redirect("/");
  }
}
