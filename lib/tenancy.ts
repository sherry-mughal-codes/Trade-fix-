import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ACTIVE_ORG_COOKIE, ModuleKey } from "@/lib/tenancy-config";

export type OrganizationContext = {
  userId: string;
  isSuperadmin: boolean;
  activeOrganizationId: string | null;
  activeOrganizationName: string | null;
  enabledModules: string[];
};

function parseEnabledModules(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string");
  }

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
    } catch {
      return [];
    }
  }

  return [];
}

export async function getOrganizationContext(): Promise<OrganizationContext | null> {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id || null;
  if (!userId) return null;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      isSuperadmin: true,
      memberships: {
        where: { isActive: true, organization: { isActive: true } },
        select: {
          organizationId: true,
          organization: {
            select: {
              id: true,
              name: true,
              enabledModules: true,
              isActive: true,
            },
          },
        },
      },
    },
  });

  if (!user) return null;

  if (user.isSuperadmin) {
    const activeOrganizationId = cookies().get(ACTIVE_ORG_COOKIE)?.value || null;
    if (!activeOrganizationId) {
      return {
        userId,
        isSuperadmin: true,
        activeOrganizationId: null,
        activeOrganizationName: null,
        enabledModules: [],
      };
    }

    const org = await prisma.organization.findUnique({
      where: { id: activeOrganizationId },
      select: { id: true, name: true, enabledModules: true, isActive: true },
    });

    if (!org || !org.isActive) {
      cookies().delete(ACTIVE_ORG_COOKIE);
      return {
        userId,
        isSuperadmin: true,
        activeOrganizationId: null,
        activeOrganizationName: null,
        enabledModules: [],
      };
    }

    return {
      userId,
      isSuperadmin: true,
      activeOrganizationId: org.id,
      activeOrganizationName: org.name,
      enabledModules: parseEnabledModules(org.enabledModules),
    };
  }

  const membership = user.memberships[0];
  if (!membership?.organization?.isActive) {
    return {
      userId,
      isSuperadmin: false,
      activeOrganizationId: null,
      activeOrganizationName: null,
      enabledModules: [],
    };
  }

  return {
    userId,
    isSuperadmin: false,
    activeOrganizationId: membership.organization.id,
    activeOrganizationName: membership.organization.name,
    enabledModules: parseEnabledModules(membership.organization.enabledModules),
  };
}

export async function requireOrganizationContext(): Promise<OrganizationContext> {
  const ctx = await getOrganizationContext();
  if (!ctx) {
    redirect("/auth/login");
  }
  if (!ctx.activeOrganizationId) {
    redirect("/orgs");
  }
  return ctx;
}

export async function requireModuleAccess(moduleKey: ModuleKey) {
  const ctx = await requireOrganizationContext();
  if (!ctx.enabledModules.includes(moduleKey)) {
    redirect("/");
  }
  return ctx;
}

export async function getSuperadminOrganizations() {
  return prisma.organization.findMany({
    orderBy: { name: "asc" },
    include: {
      memberships: {
        where: { isOwner: true, isActive: true },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              username: true,
              isActive: true,
            },
          },
        },
        take: 1,
      },
    },
  });
}
