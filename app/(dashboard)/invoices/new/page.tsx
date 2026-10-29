import { prisma } from "@/lib/prisma";
import InvoiceForm from "../invoice-form";
import { requirePageAccess } from "@/lib/rbac";
import { requireOrganizationId, withOrganization } from "@/lib/tenant-db";
import { ensureStandardPriceLists } from "@/lib/price-lists";

export default async function NewInvoicePage({
  searchParams,
}: {
  searchParams?: { duplicate?: string };
}) {
  await requirePageAccess("invoices.create", "/invoices");
  const organizationId = await requireOrganizationId();
  const standardLists = await ensureStandardPriceLists(organizationId);
  const [parties, currencies, companySettings, items, inventoryBatches, inventoryWarehouses, standardSellingRows, standardBuyingRows] = await Promise.all([
    prisma.party.findMany({
      where: { organizationId, isActive: true },
      orderBy: { name: "asc" },
    }),
    prisma.currency.findMany({
      where: { organizationId },
      orderBy: { code: "asc" },
    }),
    prisma.companySettings.findFirst({ where: { organizationId } }),
    prisma.item.findMany({
      where: { organizationId, isActive: true },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        description: true,
        defaultUnit: true,
        itemType: true,
        trackBatches: true,
        hasExpiry: true,
      },
    }),
    prisma.inventoryBatchMaster.findMany({
      where: { organizationId, isActive: true },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
      },
    }),
    prisma.inventoryWarehouse.findMany({
      where: { organizationId, isActive: true },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
      },
    }),
    prisma.priceListItem.findMany({
      where: { organizationId, priceListId: standardLists.selling.id },
      select: { itemId: true, unitName: true, price: true },
    }),
    prisma.priceListItem.findMany({
      where: { organizationId, priceListId: standardLists.buying.id },
      select: { itemId: true, unitName: true, price: true },
    }),
  ]);

  const customerExposureRows = await prisma.invoice.groupBy({
    by: ["partyId"],
    where: {
      organizationId,
      type: "SALE",
      status: { notIn: ["DRAFT", "CANCELLED"] },
      balanceAmount: { gt: 0 },
    },
    _sum: {
      balanceAmount: true,
    },
  });

  const exposureByParty = new Map(customerExposureRows.map((row) => [row.partyId, Number(row._sum.balanceAmount || 0)]));
  const partiesWithExposure = parties.map((party: any) => ({
    ...party,
    currentExposure: exposureByParty.get(party.id) || 0,
  }));

  let initialData = null;
  if (searchParams?.duplicate) {
    const sourceInvoice = await prisma.invoice.findFirst({
      where: withOrganization(organizationId, { id: searchParams.duplicate }),
      include: {
        items: {
          include: {
            item: true,
          },
        },
      },
    });

    if (sourceInvoice) {
      // Remove ID and other fields to treat as new
      const { 
          id, 
          invoiceNumber, 
          status, 
          createdAt, 
          updatedAt, 
          payments, 
          balanceAmount, 
          paidAmount, 
          journalEntryId,
          ...rest 
      } = sourceInvoice as any;
      
      initialData = {
        ...rest,
        date: new Date(), // Reset date to today
        dueDate: null, // Reset due date
        // Items are fine as is, Form will map them.
      };
    }
  }

  const saleDefaultInvoiceNumber = companySettings
    ? `${companySettings.invoicePrefix}${companySettings.invoiceCurrentNumber}`
    : "INV-1";

  const purchaseDefaultInvoiceNumber = companySettings
    ? `${companySettings.purchaseInvoicePrefix || "PINV-"}${companySettings.purchaseInvoiceCurrentNumber || 1}`
    : "PINV-1";

  return (
    <InvoiceForm
      key={searchParams?.duplicate || "new"}
      parties={partiesWithExposure}
      currencies={currencies}
      saleDefaultInvoiceNumber={saleDefaultInvoiceNumber}
      purchaseDefaultInvoiceNumber={purchaseDefaultInvoiceNumber}
      savedItems={items}
      savedBatches={inventoryBatches}
      savedWarehouses={inventoryWarehouses}
      companySettings={companySettings}
      initialData={initialData}
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
