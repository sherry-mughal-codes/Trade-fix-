"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { hasPermission } from "@/lib/rbac";
import { requireOrganizationContext } from "@/lib/tenancy";

const prismaAny = prisma as any;

export async function createRole(name: string) {
  if (!(await hasPermission("settings.rolesRights.manage"))) return { error: "Not allowed" };
  const trimmed = (name || "").trim();
  if (!trimmed) return { error: "Role name is required" };
  const organizationId = (await requireOrganizationContext()).activeOrganizationId!;

  try {
    const role = await prismaAny.role.create({
      data: { organizationId, name: trimmed, isSystem: false },
    });

    const permissions = await prismaAny.permission.findMany({ select: { id: true } });
    await prismaAny.rolePermission.createMany({
      data: permissions.map((p: any) => ({
        roleId: role.id,
        permissionId: p.id,
        allowed: false,
      })),
    });
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Failed to create role" };
  }

  revalidatePath("/settings/roles-rights");
  return { success: true };
}

export async function renameRole(roleId: string, name: string) {
  if (!(await hasPermission("settings.rolesRights.manage"))) return { error: "Not allowed" };
  const trimmed = (name || "").trim();
  if (!trimmed) return { error: "Role name is required" };
  const organizationId = (await requireOrganizationContext()).activeOrganizationId!;

  try {
    const role = await prismaAny.role.findFirst({
      where: { id: roleId, organizationId },
      select: { isSystem: true },
    });
    if (!role) return { error: "Role not found" };
    if (role.isSystem) return { error: "System roles cannot be renamed" };

    await prismaAny.role.update({ where: { id: roleId }, data: { name: trimmed } });
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Failed to rename role" };
  }

  revalidatePath("/settings/roles-rights");
  return { success: true };
}

export async function deleteRole(roleId: string) {
  if (!(await hasPermission("settings.rolesRights.manage"))) return { error: "Not allowed" };
  const organizationId = (await requireOrganizationContext()).activeOrganizationId!;

  try {
    const role = await prismaAny.role.findFirst({
      where: { id: roleId, organizationId },
      select: { isSystem: true },
    });
    if (!role) return { error: "Role not found" };
    if (role.isSystem) return { error: "System roles cannot be deleted" };

    await prismaAny.role.delete({ where: { id: roleId } });
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Failed to delete role" };
  }

  revalidatePath("/settings/roles-rights");
  return { success: true };
}

export async function saveRolePermissions(input: {
  updates: Array<{ roleId: string; permissionId: string; allowed: boolean }>;
}) {
  if (!(await hasPermission("settings.rolesRights.manage"))) return { error: "Not allowed" };
  const updates = input?.updates || [];
  const organizationId = (await requireOrganizationContext()).activeOrganizationId!;

  try {
    const validRoleIds = new Set<string>(
      (
        await prismaAny.role.findMany({
          where: { organizationId, id: { in: updates.map((u: any) => u.roleId) } },
          select: { id: true },
        })
      ).map((role: any) => role.id),
    );

    await prismaAny.$transaction(
      updates
        .filter((u: any) => validRoleIds.has(u.roleId))
        .map((u: any) =>
        prismaAny.rolePermission.upsert({
          where: { roleId_permissionId: { roleId: u.roleId, permissionId: u.permissionId } },
          update: { allowed: Boolean(u.allowed) },
          create: { roleId: u.roleId, permissionId: u.permissionId, allowed: Boolean(u.allowed) },
        })
      )
    );
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Failed to save permissions" };
  }

  revalidatePath("/settings/roles-rights");
  return { success: true };
}
