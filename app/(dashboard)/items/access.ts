import { redirect } from "next/navigation";
import { hasPermission } from "@/lib/rbac";

export async function hasItemMasterAccess() {
  return (await hasPermission("settings.data.access")) || (await hasPermission("settings.masters.manage"));
}

export async function requireItemMasterAccess() {
  if (!(await hasItemMasterAccess())) {
    redirect("/");
  }
}
