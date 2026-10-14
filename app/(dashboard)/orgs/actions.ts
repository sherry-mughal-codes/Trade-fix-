"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { clearOrganizationTransactionalData, seedOrganizationDemoData } from "@/lib/organization-data-tools";
import { createOrganizationWithOwner, DEFAULT_ENABLED_MODULES } from "@/lib/organization-bootstrap";
import { ACTIVE_ORG_COOKIE } from "@/lib/tenancy-config";
import { getPermissionContext } from "@/lib/rbac";

async function requireSuperadmin() {
  const ctx = await getPermissionContext();
  if (!ctx.isAuthenticated || !ctx.isSuperadmin) {
    throw new Error("Not allowed");
  }
}

export async function switchOrganization(organizationId: string) {
  await requireSuperadmin();

  const organization = await prisma.organization.findFirst({
    where: { id: organizationId, isActive: true },
    select: { id: true },
  });

  if (!organization) {
    throw new Error("Organization not found");
  }

  cookies().set(ACTIVE_ORG_COOKIE, organization.id, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  });

  revalidatePath("/");
  revalidatePath("/orgs");
  redirect("/");
}

export async function clearOrganizationSwitch() {
  await requireSuperadmin();
  cookies().delete(ACTIVE_ORG_COOKIE);
  revalidatePath("/");
  revalidatePath("/orgs");
  redirect("/orgs");
}

export async function disableOrganization(organizationId: string) {
  await requireSuperadmin();

  await prisma.organization.update({
    where: { id: organizationId },
    data: { isActive: false },
  });

  if (cookies().get(ACTIVE_ORG_COOKIE)?.value === organizationId) {
    cookies().delete(ACTIVE_ORG_COOKIE);
  }

  revalidatePath("/orgs");
}

export async function enableOrganization(organizationId: string) {
  await requireSuperadmin();

  await prisma.organization.update({
    where: { id: organizationId },
    data: { isActive: true },
  });

  revalidatePath("/orgs");
}

export async function updateOrganizationModules(organizationId: string, formData: FormData) {
  await requireSuperadmin();

  const enabledModules = DEFAULT_ENABLED_MODULES.filter((moduleKey) => formData.get(moduleKey) === "on");
  await prisma.organization.update({
    where: { id: organizationId },
    data: { enabledModules },
  });

  revalidatePath("/orgs");
}

export async function createOrganization(formData: FormData) {
  await requireSuperadmin();

  const organizationName = String(formData.get("organizationName") || "").trim();
  const ownerName = String(formData.get("ownerName") || "").trim();
  const ownerEmail = String(formData.get("ownerEmail") || "").trim().toLowerCase();
  const ownerUsername = String(formData.get("ownerUsername") || "").trim().toLowerCase();
  const ownerPassword = String(formData.get("ownerPassword") || "");
  const firstBankAccountName = String(formData.get("firstBankAccountName") || "").trim();
  const firstBankAccountCode = String(formData.get("firstBankAccountCode") || "").trim();
  const enabledModules = DEFAULT_ENABLED_MODULES.filter((moduleKey) => formData.get(moduleKey) === "on");

  if (!organizationName || !ownerName || (!ownerEmail && !ownerUsername) || ownerPassword.length < 6) {
    throw new Error("Organization, owner, email or username, and a 6-character password are required.");
  }
  if (!firstBankAccountName) {
    throw new Error("First bank account name is required (e.g. HBL Current).");
  }

  await createOrganizationWithOwner(prisma, {
    organizationName,
    ownerName,
    ownerEmail: ownerEmail || undefined,
    ownerUsername: ownerUsername || undefined,
    ownerPassword,
    enabledModules,
    firstBankAccount: {
      name: firstBankAccountName,
      code: firstBankAccountCode || null,
    },
  });
  revalidatePath("/orgs");
  redirect("/orgs");
}

export async function clearOrganizationTransactions(organizationId: string) {
  await requireSuperadmin();

  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { id: true, name: true },
  });

  if (!organization) {
    throw new Error("Organization not found.");
  }

  await clearOrganizationTransactionalData(prisma, organizationId);
  revalidatePath("/orgs");
  redirect(`/orgs?success=${encodeURIComponent(`Transactional data cleared for ${organization.name}.`)}`);
}

export async function loadOrganizationDemoData(organizationId: string) {
  await requireSuperadmin();

  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { id: true, name: true },
  });

  if (!organization) {
    throw new Error("Organization not found.");
  }

  await seedOrganizationDemoData(prisma, organizationId);
  revalidatePath("/orgs");
  redirect(`/orgs?success=${encodeURIComponent(`Demo data loaded for ${organization.name}.`)}`);
}
