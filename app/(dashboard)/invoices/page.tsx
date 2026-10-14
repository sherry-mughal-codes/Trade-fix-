import { prisma } from "@/lib/prisma";
import { hasPermission, requirePageAccess } from "@/lib/rbac";
import { requireOrganizationId, withOrganization } from "@/lib/tenant-db";
import InvoicesPageClient, { InvoiceRow } from "./invoices-page-client";

export const dynamic = "force-dynamic";

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams?: {
    query?: string;
    filters?: string;
    page?: string;
    limit?: string;
    type?: string;
  };
}) {
  await requirePageAccess("invoices.list", "/");
  const organizationId = await requireOrganizationId();

  const canCreate = await hasPermission("invoices.create");
  const canView = await hasPermission("invoices.action.view");
  const canEdit = await hasPermission("invoices.action.edit");
  const canDelete = await hasPermission("invoices.action.delete");

  const query = searchParams?.query || "";
  const page = Number(searchParams?.page) || 1;
  const limit = Number(searchParams?.limit) || 50;
  const skip = (page - 1) * limit;
  const typeFilter = searchParams?.type || "SALE";

  let whereClause: any = withOrganization(organizationId, {
    OR: [
      { invoiceNumber: { contains: query } },
      { party: { name: { contains: query } } },
    ],
  });

  if (typeFilter === "SALE") {
    whereClause = withOrganization(organizationId, {
      ...whereClause,
      type: "SALE",
    });
  } else if (typeFilter === "PURCHASE") {
    whereClause = withOrganization(organizationId, {
      ...whereClause,
      type: "PURCHASE",
    });
  } else if (typeFilter === "POS") {
    whereClause = withOrganization(organizationId, {
      ...whereClause,
      type: "SALE",
      isPos: true,
    });
  }

  if (searchParams?.filters) {
    try {
      const filters = JSON.parse(atob(searchParams.filters));
      if (Array.isArray(filters) && filters.length > 0) {
        const filterConditions = filters.map((filter: any) => {
          const { field, operator, value } = filter;
          if (field === "type" && (operator === "equals" || operator === "not")) {
            if (value === "POS") {
              return operator === "not"
                ? { NOT: { type: "SALE", isPos: true } }
                : { type: "SALE", isPos: true };
            }
          }
          switch (operator) {
            case "contains":
              return { [field]: { contains: value } };
            case "equals":
              return { [field]: { equals: value } };
            case "startsWith":
              return { [field]: { startsWith: value } };
            case "endsWith":
              return { [field]: { endsWith: value } };
            case "not":
              return { [field]: { not: value } };
            case "gt":
              return { [field]: { gt: Number(value) } };
            case "lt":
              return { [field]: { lt: Number(value) } };
            case "gte":
              return { [field]: { gte: Number(value) } };
            case "lte":
              return { [field]: { lte: Number(value) } };
            default:
              return {};
          }
        });

        whereClause = {
          AND: [whereClause, ...filterConditions],
        };
      }
    } catch (e) {
      console.error("Failed to parse filters", e);
    }
  }

  const [invoices, totalCount] = await Promise.all([
    prisma.invoice.findMany({
      where: whereClause,
      orderBy: { createdAt: "desc" },
      include: { party: true, items: true, payments: true },
      take: limit,
      skip: skip,
    }),
    prisma.invoice.count({ where: whereClause }),
  ]);

  const companySettings = await prisma.companySettings.findFirst({
    where: { organizationId },
  });

  const accounts = await prisma.account.findMany({
    where: {
      organizationId,
      type: "ASSET",
    },
    include: { parent: true },
    orderBy: { name: "asc" },
  });

  const currencies = await prisma.currency.findMany({
    where: { organizationId },
    orderBy: { code: "asc" },
  });

  return (
    <InvoicesPageClient
      invoices={invoices as InvoiceRow[]}
      totalCount={totalCount}
      page={page}
      limit={limit}
      companySettings={companySettings}
      accounts={accounts as any}
      currencies={currencies as any}
      canCreate={canCreate}
      canView={canView}
      canEdit={canEdit}
      canDelete={canDelete}
    />
  );
}
