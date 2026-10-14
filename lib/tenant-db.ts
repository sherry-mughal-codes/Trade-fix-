import { prisma } from "@/lib/prisma";
import { requireOrganizationContext } from "@/lib/tenancy";
import { AppError } from "@/lib/errors";

function guessRecordType(delegate: any): string {
  if (!delegate) return "Record";
  try {
    if (typeof delegate === "object") {
      if (typeof (delegate as any)._modelName === "string") return (delegate as any)._modelName;
      if (typeof (delegate as any).name === "string") return (delegate as any).name;
      const proto = Object.getPrototypeOf(delegate);
      if (proto?.name) return String(proto.name);
    }
  } catch {
    /* swallow */
  }
  return "Record";
}

export async function requireOrganizationId() {
  const ctx = await requireOrganizationContext();
  if (!ctx.activeOrganizationId) {
    throw AppError.orgRequired();
  }
  return ctx.activeOrganizationId;
}

export function withOrganization<T extends Record<string, any> | undefined>(
  organizationId: string,
  where?: T,
) {
  return {
    ...(where || {}),
    organizationId,
  };
}

export async function requireOwnedRecord(
  delegate: any,
  id: string,
  organizationId: string,
  args?: Record<string, any> & { recordType?: string },
) {
  const recordType = args?.recordType ?? guessRecordType(delegate);
  const record = await delegate.findFirst({
    ...((args || {}) as any),
    where: withOrganization(organizationId, {
      id,
      ...(((args?.where) as Record<string, any> | undefined) || {}),
    }),
  });

  if (!record) {
    const existsGlobal = await delegate
      .findFirst({
        select: { id: true },
        where: { id, ...(((args?.where) as Record<string, any> | undefined) || {}) },
      })
      .catch(() => null);
    if (existsGlobal) {
      throw AppError.notOwned(recordType);
    }
    throw AppError.notFound(recordType, id);
  }

  return record;
}

export async function getScopedSettings(organizationId: string) {
  return prisma.companySettings.findFirst({
    where: { organizationId },
  });
}

export async function getScopedLookups(organizationId: string) {
  const [currencies, accounts, companyTypes] = await Promise.all([
    prisma.currency.findMany({
      where: { organizationId },
      orderBy: { code: "asc" },
    }),
    prisma.account.findMany({
      where: { organizationId },
      orderBy: { name: "asc" },
    }),
    prisma.companyType.findMany({
      where: { organizationId, isActive: true },
      orderBy: { title: "asc" },
    }),
  ]);

  return { currencies, accounts, companyTypes };
}
