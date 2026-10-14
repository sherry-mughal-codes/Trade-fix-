import { redirect } from "next/navigation";
import { hasPermission } from "@/lib/rbac";

export async function hasPOSProfileAccess() {
  return hasPermission("pos.profile.manage");
}

export async function requirePOSProfileAccess() {
  if (!(await hasPOSProfileAccess())) {
    redirect("/");
  }
}

export async function requirePOSAccess() {
  const hasAccess = await hasPermission("pos.access");
  if (!hasAccess) {
    redirect("/");
  }
}
