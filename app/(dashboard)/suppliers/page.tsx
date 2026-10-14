import { prisma } from "@/lib/prisma";
import SuppliersPageClient, { SupplierRow } from "./suppliers-page-client";
import { hasPermission, requirePageAccess } from "@/lib/rbac";
import { requireOrganizationId, withOrganization } from "@/lib/tenant-db";

export const dynamic = "force-dynamic";

export default async function SuppliersPage({
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
    type: { in: ["SUPPLIER", "BOTH"] },
    OR: [{ name: { contains: query } }, { ntn: { contains: query } }, { strn: { contains: query } }, { contactPerson: { contains: query } }],
  });

  if (searchParams?.filters) {
    try {
      const filters = JSON.parse(atob(searchParams.filters));
      if (Array.isArray(filters) && filters.length > 0) {
        whereClause = {
          AND: [
            whereClause,
            ...filters.map((filter: any) => ({
              [filter.field]: {
                [filter.operator === "contains" ? "contains" : "equals"]: filter.value,
              },
            })),
          ],
        };
      }
    } catch (error) {
      console.error("Failed to parse supplier filters", error);
    }
  }

  const [suppliers, totalCount] = await Promise.all([
    prisma.party.findMany({
      where: whereClause,
      orderBy: { createdAt: "desc" },
      include: { companyType: true },
      take: limit,
      skip,
    }),
    prisma.party.count({ where: whereClause }),
  ]);

  const supplierIds = suppliers.map((supplier) => supplier.id);
  const exposureRows = supplierIds.length
    ? await prisma.invoice.groupBy({
        by: ["partyId"],
        where: {
          organizationId,
          partyId: { in: supplierIds },
          type: "PURCHASE",
          status: { notIn: ["DRAFT", "CANCELLED"] },
          balanceAmount: { gt: 0 },
        },
        _sum: {
          balanceAmount: true,
        },
      })
    : [];

  const exposureBySupplier = new Map(exposureRows.map((row) => [row.partyId, Number(row._sum.balanceAmount || 0)]));

  const rows: SupplierRow[] = suppliers.map((s) => ({
    ...(s as any),
    _openPayable: exposureBySupplier.get(s.id) || 0,
  }));

  return (
    <SuppliersPageClient
      suppliers={rows}
      totalCount={totalCount}
      page={page}
      limit={limit}
      canCreate={canCreate}
      canEdit={canEdit}
      canDelete={canDelete}
    />
  );
}
