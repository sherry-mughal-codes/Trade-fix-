import { prisma } from "@/lib/prisma";
import InvoiceForm from "../../invoice-form";
import { notFound } from "next/navigation";
import { requirePageAccess } from "@/lib/rbac";
import { requireOrganizationId, withOrganization } from "@/lib/tenant-db";
import { ensureStandardPriceLists } from "@/lib/price-lists";

export default async function EditInvoicePage({ params }: { params: { id: string } }) {
  await requirePageAccess("invoices.action.edit", "/invoices");
  const organizationId = await requireOrganizationId();
  const standardLists = await ensureStandardPriceLists(organizationId);

  const [invoice, parties, currencies, items, companySettings, standardSellingRows, standardBuyingRows] = await Promise.all([
    prisma.invoice.findFirst({
      where: withOrganization(organizationId, { id: params.id }),
      include: { items: true },
    }),
    prisma.party.findMany({
      where: { organizationId },
      orderBy: { name: "asc" },
    }),
    prisma.currency.findMany({
      where: { organizationId },
      orderBy: { code: "asc" },
    }),
    prisma.item.findMany({
      where: { organizationId },
      orderBy: { name: "asc" },
    }),
    prisma.companySettings.findFirst({ where: { organizationId } }),
    prisma.priceListItem.findMany({
      where: { organizationId, priceListId: standardLists.selling.id },
      select: { itemId: true, unitName: true, price: true },
    }),
    prisma.priceListItem.findMany({
      where: { organizationId, priceListId: standardLists.buying.id },
      select: { itemId: true, unitName: true, price: true },
    }),
  ]);

  if (!invoice) {
    notFound();
  }

  return (
    <InvoiceForm
      key={params.id}
      parties={parties}
      currencies={currencies}
      initialData={invoice}
      savedItems={items}
      companySettings={companySettings}
      standardSellingPriceListId={standardLists.selling.id}
      standardBuyingPriceListId={standardLists.buying.id}
      standardSellingPrices={standardSellingRows.reduce<Record<string, number>>((acc, row) => {
        acc[row.itemId] = Number(row.price || 0);
        return acc;
      }, {})}
      standardBuyingPrices={standardBuyingRows.reduce<Record<string, number>>((acc, row) => {
        acc[row.itemId] = Number(row.price || 0);
        return acc;
      }, {})}
    />
  );
}
