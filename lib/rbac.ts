import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { PERMISSIONS } from "@/lib/permissions";
import { getOrganizationContext } from "@/lib/tenancy";
import { AppError } from "@/lib/errors";

export type PermissionCheckResult = {
  isAuthenticated: boolean;
  userId: string | null;
  isSuperadmin: boolean;
  permissions: string[];
  activeOrganizationId: string | null;
  activeOrganizationName: string | null;
  enabledModules: string[];
};

function isRbacDisabled() {
  return process.env.RBAC_DISABLED === "true" || process.env.NEXT_PUBLIC_RBAC_DISABLED === "true";
}

function filterPermissionsForModules(permissionKeys: string[], enabledModules: string[]) {
  if (enabledModules.length === 0) {
    return permissionKeys.filter((key) => key.startsWith("dashboard.") || key.startsWith("settings."));
  }

  return permissionKeys.filter((key) => {
    if (key.startsWith("dashboard.") || key.startsWith("settings.")) {
      return true;
    }

    const modulePrefix = key.split(".")[0];
    return enabledModules.includes(modulePrefix);
  });
}

export async function getPermissionContext(): Promise<PermissionCheckResult> {
  if (isRbacDisabled()) {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id || null;
    if (!userId) {
      return {
        isAuthenticated: false,
        userId: null,
        isSuperadmin: false,
        permissions: [],
        activeOrganizationId: null,
        activeOrganizationName: null,
        enabledModules: [],
      };
    }
    const orgCtx = await getOrganizationContext();
    return {
      isAuthenticated: true,
      userId,
      isSuperadmin: true,
      permissions: filterPermissionsForModules(PERMISSIONS.map((p) => p.key), orgCtx?.enabledModules || []),
      activeOrganizationId: orgCtx?.activeOrganizationId || null,
      activeOrganizationName: orgCtx?.activeOrganizationName || null,
      enabledModules: orgCtx?.enabledModules || [],
    };
  }

  const session = await getServerSession(authOptions);
  const userId = session?.user?.id || null;
  if (!userId) {
    return {
      isAuthenticated: false,
      userId: null,
      isSuperadmin: false,
      permissions: [],
      activeOrganizationId: null,
      activeOrganizationName: null,
      enabledModules: [],
    };
  }

  const orgCtx = await getOrganizationContext();
  const activeOrganizationId = orgCtx?.activeOrganizationId || null;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      isActive: true,
      isSuperadmin: true,
      roles: {
        where: activeOrganizationId
          ? {
              role: {
                organizationId: activeOrganizationId,
              },
            }
          : undefined,
        select: {
          role: {
            select: {
              organizationId: true,
              permissions: {
                where: { allowed: true },
                select: {
                  permission: {
                    select: { key: true },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!user || !user.isActive) {
    return {
      isAuthenticated: false,
      userId: null,
      isSuperadmin: false,
      permissions: [],
      activeOrganizationId: null,
      activeOrganizationName: null,
      enabledModules: [],
    };
  }

  if (user.isSuperadmin) {
    const permissions = filterPermissionsForModules(PERMISSIONS.map((p) => p.key), orgCtx?.enabledModules || []);
    return {
      isAuthenticated: true,
      userId: user.id,
      isSuperadmin: true,
      permissions,
      activeOrganizationId,
      activeOrganizationName: orgCtx?.activeOrganizationName || null,
      enabledModules: orgCtx?.enabledModules || [],
    };
  }

  if (!activeOrganizationId) {
    return {
      isAuthenticated: true,
      userId: user.id,
      isSuperadmin: false,
      permissions: [],
      activeOrganizationId: null,
      activeOrganizationName: null,
      enabledModules: [],
    };
  }

  const keys = new Set<string>();
  for (const ur of user.roles) {
    for (const rp of ur.role.permissions) {
      keys.add(rp.permission.key);
    }
  }
  const permissions = filterPermissionsForModules(Array.from(keys), orgCtx?.enabledModules || []);

  return {
    isAuthenticated: true,
    userId: user.id,
    isSuperadmin: false,
    permissions,
    activeOrganizationId,
    activeOrganizationName: orgCtx?.activeOrganizationName || null,
    enabledModules: orgCtx?.enabledModules || [],
  };
}

export async function hasPermission(permissionKey: string) {
  if (isRbacDisabled()) {
    const session = await getServerSession(authOptions);
    return !!session?.user?.id;
  }
  const ctx = await getPermissionContext();
  if (!ctx.isAuthenticated) return false;
  return ctx.permissions.includes(permissionKey);
}

export async function requirePermission(permissionKey: string) {
  const ok = await hasPermission(permissionKey);
  if (!ok) {
    throw AppError.forbidden(permissionKey);
  }
}

export async function requirePageAccess(permissionKey: string, redirectTo: string = "/") {
  const ctx = await getPermissionContext();
  if (!ctx.isAuthenticated) {
    redirect(redirectTo);
  }
  if (ctx.isSuperadmin && !ctx.activeOrganizationId) {
    redirect("/orgs");
  }
  if (!ctx.isSuperadmin && !ctx.activeOrganizationId) {
    redirect("/auth/login");
  }
  if (!ctx.permissions.includes(permissionKey)) {
    redirect(redirectTo);
  }
}
