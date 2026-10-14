import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import CustomerForm from "../../customer-form";
import { requireOrganizationId, withOrganization } from "@/lib/tenant-db";
import { ensureStandardPriceLists } from "@/lib/price-lists";

export const dynamic = "force-dynamic";

export default async function EditCustomerPage({ params }: { params: { id: string } }) {
  const organizationId = await requireOrganizationId();
  await ensureStandardPriceLists(organizationId);
  const [customer, currencies, companyTypes, priceLists] = await Promise.all([
    prisma.party.findFirst({
      where: withOrganization(organizationId, {
        id: params.id,
        type: { in: ["CUSTOMER", "BOTH"] },
      }),
      include: { companyType: true },
    }),
    prisma.currency.findMany({ where: { organizationId }, orderBy: { code: "asc" } }),
    prisma.companyType.findMany({ where: { organizationId, isActive: true }, orderBy: { title: "asc" } }),
    prisma.priceList.findMany({
      where: { organizationId, type: "SELLING", isActive: true },
      orderBy: [{ isSystemDefault: "desc" }, { name: "asc" }],
      select: { id: true, name: true, type: true, isSystemDefault: true, isActive: true },
    }),
  ]);

  if (!customer) notFound();

  return <CustomerForm initialData={JSON.parse(JSON.stringify(customer))} currencies={currencies} companyTypes={companyTypes} priceLists={priceLists} />;
}
