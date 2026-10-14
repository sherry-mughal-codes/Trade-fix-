import { prisma } from "@/lib/prisma";
import { requirePageAccess } from "@/lib/rbac";
import RolesRightsClient from "./roles-rights-client";
import { requireOrganizationContext } from "@/lib/tenancy";

const prismaAny = prisma as any;

const ALLOWED_GROUPS = new Set<string>([
  "Dashboard",
  "Customers",
  "Invoices",
  "Payments",
  "Journal",
  "HR",
  "Reports",
  "Settings",
]);

const EXCLUDED_KEYS = new Set<string>([
]);

export default async function RolesRightsPage() {
  await requirePageAccess("settings.rolesRights.manage", "/");
  const organizationId = (await requireOrganizationContext()).activeOrganizationId!;

  const roles = await prismaAny.role.findMany({
    where: { organizationId },
    orderBy: { name: "asc" },
  });
  const permissions = await prismaAny.permission.findMany({
    orderBy: [{ group: "asc" }, { order: "asc" }, { label: "asc" }],
  });
  const filteredPermissions = permissions.filter((permission: any) => ALLOWED_GROUPS.has(permission.group) && !EXCLUDED_KEYS.has(permission.key));

  const rolePermissions = await prismaAny.rolePermission.findMany({
    where: { roleId: { in: roles.map((r: any) => r.id) } },
    select: { roleId: true, permissionId: true, allowed: true },
  });

  const allowed: Record<string, Record<string, boolean>> = {};
  for (const rp of rolePermissions) {
    if (!allowed[rp.roleId]) allowed[rp.roleId] = {};
    allowed[rp.roleId][rp.permissionId] = Boolean(rp.allowed);
  }

  return (
    <RolesRightsClient
      roles={roles.map((r: any) => ({ id: r.id, name: r.name, isSystem: r.isSystem }))}
      permissions={filteredPermissions.map((p: any) => ({
        id: p.id,
        key: p.key,
        label: p.label,
        group: p.group,
        order: p.order,
      }))}
      allowed={allowed}
    />
  );
}
