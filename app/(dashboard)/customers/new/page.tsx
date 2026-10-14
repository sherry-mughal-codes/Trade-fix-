import { prisma } from "@/lib/prisma";
import CustomerForm from "../customer-form";
import { requireOrganizationId } from "@/lib/tenant-db";
import { ensureStandardPriceLists } from "@/lib/price-lists";

export const dynamic = "force-dynamic";

export default async function NewCustomerPage() {
  const organizationId = await requireOrganizationId();
  await ensureStandardPriceLists(organizationId);
  const [currencies, companyTypes, priceLists] = await Promise.all([
    prisma.currency.findMany({ where: { organizationId }, orderBy: { code: "asc" } }),
    prisma.companyType.findMany({ where: { organizationId, isActive: true }, orderBy: { title: "asc" } }),
    prisma.priceList.findMany({
      where: { organizationId, type: "SELLING", isActive: true },
      orderBy: [{ isSystemDefault: "desc" }, { name: "asc" }],
      select: { id: true, name: true, type: true, isSystemDefault: true, isActive: true },
    }),
  ]);

  return <CustomerForm currencies={currencies} companyTypes={companyTypes} priceLists={priceLists} />;
}
