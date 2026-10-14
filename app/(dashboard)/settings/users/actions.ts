"use server";

import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { getPermissionContext, hasPermission } from "@/lib/rbac";
import { requireOrganizationContext } from "@/lib/tenancy";

const prismaAny = prisma as any;
const USERNAME_REGEX = /^[a-z0-9._-]+$/;

async function canManageUsers() {
  return await hasPermission("settings.users.manage");
}

function normalizeEmail(value: string | null | undefined) {
  const email = String(value || "").trim().toLowerCase();
  return email || null;
}

function normalizeUsername(value: string | null | undefined) {
  const username = String(value || "").trim().toLowerCase();
  return username || null;
}

async function hasIdentityConflict(email: string | null, username: string | null) {
  const checks = [] as Array<Record<string, string>>;
  if (email) {
    checks.push({ email });
    checks.push({ username: email });
  }
  if (username) {
    checks.push({ username });
    checks.push({ email: username });
  }
  if (!checks.length) {
    return null;
  }
  return prismaAny.user.findFirst({
    where: { OR: checks },
    select: { id: true },
  });
}

export async function createUser(input: {
  email?: string;
  username?: string;
  name: string;
  password: string;
  roleIds: string[];
}) {
  if (!(await canManageUsers())) return { error: "Not allowed" };

  const email = normalizeEmail(input.email);
  const username = normalizeUsername(input.username);
  const name = (input.name || "").trim();
  const password = input.password || "";
  const roleIds = Array.isArray(input.roleIds) ? Array.from(new Set(input.roleIds.filter(Boolean))) : [];
  const organizationId = (await requireOrganizationContext()).activeOrganizationId!;

  if (!email && !username) return { error: "Email or username is required" };
  if (username && !USERNAME_REGEX.test(username)) {
    return { error: "Username can only contain letters, numbers, dots, underscores, and hyphens" };
  }
  if (!password || password.length < 6) return { error: "Password must be at least 6 characters" };

  try {
    const validRoleCount = roleIds.length
      ? await prismaAny.role.count({ where: { organizationId, id: { in: roleIds } } })
      : 0;
    if (roleIds.length && validRoleCount !== roleIds.length) {
      return { error: "One or more selected roles are invalid" };
    }

    const existing = await hasIdentityConflict(email, username);
    if (existing) {
      return { error: "Email or username is already in use" };
    }

    const hashed = await bcrypt.hash(password, 10);
    const user = await prismaAny.user.create({
      data: {
        email,
        username,
        name: name || null,
        password: hashed,
        isActive: true,
        isSuperadmin: false,
      },
      select: { id: true },
    });

    if (roleIds.length > 0) {
      await prismaAny.userRole.createMany({
        data: roleIds.map((roleId: string) => ({ userId: user.id, roleId })),
      });
    }

    await prismaAny.organizationMembership.upsert({
      where: {
        organizationId_userId: {
          organizationId,
          userId: user.id,
        },
      },
      update: { isActive: true },
      create: {
        organizationId,
        userId: user.id,
        isOwner: false,
        isActive: true,
      },
    });
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Failed to create user" };
  }

  revalidatePath("/settings/users");
  return { success: true };
}

export async function updateUserRoles(userId: string, roleIds: string[]) {
  if (!(await canManageUsers())) return { error: "Not allowed" };

  const ctx = await getPermissionContext();
  const isRequesterSuperadmin = ctx.isSuperadmin;
  const organizationId = (await requireOrganizationContext()).activeOrganizationId!;

  const target = await prismaAny.user.findUnique({
    where: { id: userId },
    select: { isSuperadmin: true },
  });
  if (!target) return { error: "User not found" };
  if (target.isSuperadmin && !isRequesterSuperadmin) return { error: "Not allowed" };

  const membership = await prismaAny.organizationMembership.findUnique({
    where: { organizationId_userId: { organizationId, userId } },
  });
  if (!membership) return { error: "User is not part of the active organization" };

  const validRoleCount = roleIds.length
    ? await prismaAny.role.count({ where: { organizationId, id: { in: roleIds } } })
    : 0;
  if (roleIds.length && validRoleCount !== roleIds.length) {
    return { error: "One or more selected roles are invalid" };
  }

  try {
    await prismaAny.$transaction(async (tx: any) => {
      await tx.userRole.deleteMany({ where: { userId, role: { organizationId } } });
      if (roleIds?.length) {
        await tx.userRole.createMany({
          data: roleIds.map((roleId: string) => ({ userId, roleId })),
        });
      }
    });
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Failed to update roles" };
  }

  revalidatePath("/settings/users");
  return { success: true };
}

export async function resetUserPassword(userId: string, newPassword: string) {
  if (!(await canManageUsers())) return { error: "Not allowed" };

  const ctx = await getPermissionContext();
  const isRequesterSuperadmin = ctx.isSuperadmin;
  const organizationId = (await requireOrganizationContext()).activeOrganizationId!;

  const target = await prismaAny.user.findUnique({
    where: { id: userId },
    select: { isSuperadmin: true },
  });
  if (!target) return { error: "User not found" };
  if (target.isSuperadmin && !isRequesterSuperadmin) return { error: "Not allowed" };
  const membership = await prismaAny.organizationMembership.findUnique({
    where: { organizationId_userId: { organizationId, userId } },
  });
  if (!membership) return { error: "User is not part of the active organization" };

  if (!newPassword || newPassword.length < 6) return { error: "Password must be at least 6 characters" };

  try {
    const hashed = await bcrypt.hash(newPassword, 10);
    await prismaAny.user.update({ where: { id: userId }, data: { password: hashed } });
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Failed to reset password" };
  }

  revalidatePath("/settings/users");
  return { success: true };
}

export async function setUserActive(userId: string, isActive: boolean) {
  if (!(await canManageUsers())) return { error: "Not allowed" };

  const ctx = await getPermissionContext();
  const isRequesterSuperadmin = ctx.isSuperadmin;
  const organizationId = (await requireOrganizationContext()).activeOrganizationId!;

  if (!isActive && ctx.userId === userId) return { error: "You cannot disable your own user" };

  const target = await prismaAny.user.findUnique({
    where: { id: userId },
    select: { isSuperadmin: true },
  });
  if (!target) return { error: "User not found" };
  if (target.isSuperadmin && !isRequesterSuperadmin) return { error: "Not allowed" };
  const membership = await prismaAny.organizationMembership.findUnique({
    where: { organizationId_userId: { organizationId, userId } },
  });
  if (!membership) return { error: "User is not part of the active organization" };

  try {
    await prismaAny.user.update({ where: { id: userId }, data: { isActive: Boolean(isActive) } });
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Failed to update status" };
  }

  revalidatePath("/settings/users");
  return { success: true };
}
