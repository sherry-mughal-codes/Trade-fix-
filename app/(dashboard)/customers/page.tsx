import Link from "next/link";
import { prisma } from "@/lib/prisma";
import CustomersPageClient, { CustomerRow } from "./customers-page-client";
import { hasPermission, requirePageAccess } from "@/lib/rbac";
import { requireOrganizationId, withOrganization } from "@/lib/tenant-db";

export const dynamic = "force-dynamic";

export default async function CustomersPage({
  searchParams,
}: {
  searchParams?: { query?: string; filters?: string; page?: string; limit?: string };
}) {
  await requirePageAccess("customers.list", "/");
  const organizationId = await requireOrganizationId();
  const canCreate = await hasPermission("customers.create");
  const canEdit = await hasPermission("customers.action.edit");
  const canDelete = await hasPermission("customers.action.delete");

  const query = searchParams?.query || "";
  const page = Number(searchParams?.page) || 1;
  const limit = Number(searchParams?.limit) || 50;
  const skip = (page - 1) * limit;

  let whereClause: any = withOrganization(organizationId, {
    type: { in: ["CUSTOMER", "BOTH"] },
    OR: [{ name: { contains: query } }, { ntn: { contains: query } }, { strn: { contains: query } }, { contactPerson: { contains: query } }],
  });

  if (searchParams?.filters) {
    try {
      const filters = JSON.parse(atob(searchParams.filters));
      if (Array.isArray(filters) && filters.length > 0) {
        whereClause = {
          AND: [
            whereClause,
            ...filters.map((filter: any) => {
              if (filter.field === "companyType.title") {
                return { companyType: { title: { [filter.operator === "contains" ? "contains" : "equals"]: filter.value } } };
              }
              return { [filter.field]: { [filter.operator === "contains" ? "contains" : "equals"]: filter.value } };
            }),
          ],
        };
      }
    } catch (error) {
      console.error("Failed to parse customer filters", error);
    }
  }

  const [customers, totalCount] = await Promise.all([
    prisma.party.findMany({
      where: whereClause,
      orderBy: { createdAt: "desc" },
      include: { companyType: true },
      take: limit,
      skip,
    }),
    prisma.party.count({ where: whereClause }),
  ]);

  const customerIds = customers.map((customer) => customer.id);
  const exposureRows = customerIds.length
    ? await prisma.invoice.groupBy({
        by: ["partyId"],
        where: {
          organizationId,
          partyId: { in: customerIds },
          type: "SALE",
          status: { notIn: ["DRAFT", "CANCELLED"] },
          balanceAmount: { gt: 0 },
        },
        _sum: {
          balanceAmount: true,
        },
      })
    : [];

  const exposureByCustomer = new Map(exposureRows.map((row) => [row.partyId, Number(row._sum.balanceAmount || 0)]));

  const rows: CustomerRow[] = customers.map((c) => ({
    ...(c as any),
    _usedCredit: exposureByCustomer.get(c.id) || 0,
  }));

  return (
    <CustomersPageClient
      customers={rows}
      totalCount={totalCount}
      page={page}
      limit={limit}
      canCreate={canCreate}
      canEdit={canEdit}
      canDelete={canDelete}
    />
  );
}
