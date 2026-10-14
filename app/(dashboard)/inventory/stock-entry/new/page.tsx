import { prisma } from "@/lib/prisma";
import { requireOrganizationId, withOrganization } from "@/lib/tenant-db";
import { requireInventoryAccess } from "../../access";
import StockEntryDocumentForm from "../../stock-entry-document-form";

export const dynamic = "force-dynamic";

export default async function NewStockEntryPage() {
  await requireInventoryAccess("inventory.stockEntry.manage");
  const organizationId = await requireOrganizationId();

  const [items, batches, warehouses] = await Promise.all([
    prisma.item.findMany({
      where: withOrganization(organizationId, { itemType: "INVENTORY", isActive: true }),
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        defaultUnit: true,
        trackBatches: true,
        hasExpiry: true,
      },
    }),
    prisma.inventoryBatchMaster.findMany({
      where: withOrganization(organizationId, { isActive: true }),
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.inventoryWarehouse.findMany({
      where: withOrganization(organizationId, { isActive: true }),
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  return (
    <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
      <StockEntryDocumentForm
        items={items}
        batches={batches}
        warehouses={warehouses}
        defaultDate={new Date().toISOString().slice(0, 10)}
      />
    </div>
  );
}
