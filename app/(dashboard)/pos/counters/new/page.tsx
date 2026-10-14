import { prisma } from "@/lib/prisma";
import { requireOrganizationId, withOrganization } from "@/lib/tenant-db";
import { requirePOSProfileAccess } from "../../access";
import CounterForm from "../counter-form";

export const dynamic = "force-dynamic";

export default async function NewCounterPage() {
  await requirePOSProfileAccess();
  const organizationId = await requireOrganizationId();

  const warehouses = await prisma.inventoryWarehouse.findMany({
    where: withOrganization(organizationId, { isActive: true }),
    orderBy: { name: "asc" },
    select: { name: true },
  });

  return (
    <CounterForm
      warehouses={JSON.parse(JSON.stringify(warehouses))}
    />
  );
}
