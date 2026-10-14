import { prisma } from "@/lib/prisma";
import { getPermissionContext, requirePageAccess } from "@/lib/rbac";
import UsersClient from "./users-client";
import { requireOrganizationContext } from "@/lib/tenancy";

const prismaAny = prisma as any;

export default async function UsersPage() {
  await requirePageAccess("settings.users.manage", "/");

  const ctx = await getPermissionContext();
  const orgCtx = await requireOrganizationContext();
  const organizationId = orgCtx.activeOrganizationId!;

  const roles = await prismaAny.role.findMany({
    where: { organizationId },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  const memberships = await prismaAny.organizationMembership.findMany({
    where: { organizationId, isActive: true },
    orderBy: { createdAt: "asc" },
    select: {
      user: {
        select: {
          id: true,
          email: true,
          username: true,
          name: true,
          isActive: true,
          isSuperadmin: true,
          roles: {
            where: { role: { organizationId } },
            select: { roleId: true, role: { select: { name: true } } },
          },
        },
      },
    },
  });

  return (
    <UsersClient
      roles={roles}
      currentUserId={ctx.userId}
      users={memberships
        .map((membership: any) => membership.user)
        .filter((u: any) => (ctx.isSuperadmin ? true : !u.isSuperadmin))
        .map((u: any) => ({
          id: u.id,
          email: u.email,
          username: u.username,
          name: u.name,
          isActive: u.isActive,
          isSuperadmin: u.isSuperadmin,
          roleIds: u.roles.map((r: any) => r.roleId),
          roleNames: u.roles.map((r: any) => r.role.name),
        }))}
    />
  );
}
