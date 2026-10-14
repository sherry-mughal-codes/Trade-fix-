import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import CustomerForm from "@/app/(dashboard)/customers/customer-form";
import { requireOrganizationId, withOrganization } from "@/lib/tenant-db";
import { ensureStandardPriceLists } from "@/lib/price-lists";

export const dynamic = "force-dynamic";

export default async function EditSupplierPage({ params }: { params: { id: string } }) {
  const organizationId = await requireOrganizationId();
  await ensureStandardPriceLists(organizationId);
  const [supplier, currencies, companyTypes, priceLists] = await Promise.all([
    prisma.party.findFirst({
      where: withOrganization(organizationId, {
        id: params.id,
        type: { in: ["SUPPLIER", "BOTH"] },
      }),
      include: { companyType: true },
    }),
    prisma.currency.findMany({ where: { organizationId }, orderBy: { code: "asc" } }),
    prisma.companyType.findMany({ where: { organizationId, isActive: true }, orderBy: { title: "asc" } }),
    prisma.priceList.findMany({
      where: { organizationId, type: "BUYING", isActive: true },
      orderBy: [{ isSystemDefault: "desc" }, { name: "asc" }],
      select: { id: true, name: true, type: true, isSystemDefault: true, isActive: true },
    }),
  ]);

  if (!supplier) notFound();

  return <CustomerForm initialData={JSON.parse(JSON.stringify(supplier))} currencies={currencies} companyTypes={companyTypes} priceLists={priceLists} mode="supplier" />;
}
