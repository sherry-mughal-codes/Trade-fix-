import { redirect } from "next/navigation";
import { hasPermission } from "@/lib/rbac";
import { getOrganizationContext } from "@/lib/tenancy";

export async function hasInventoryAccess(permissionKey: string = "inventory.access") {
  const orgCtx = await getOrganizationContext();
  if (!orgCtx?.activeOrganizationId || !orgCtx.enabledModules.includes("inventory")) {
    return false;
  }

  return hasPermission(permissionKey);
}

export async function requireInventoryAccess(permissionKey: string = "inventory.access") {
  if (!(await hasInventoryAccess(permissionKey))) {
    redirect("/");
  }
}
