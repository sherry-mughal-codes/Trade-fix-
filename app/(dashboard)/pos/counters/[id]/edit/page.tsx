import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireOrganizationId, withOrganization } from "@/lib/tenant-db";
import { requirePOSProfileAccess } from "../../../access";
import CounterForm from "../../counter-form";

export const dynamic = "force-dynamic";

export default async function EditCounterPage({ params }: { params: { id: string } }) {
  await requirePOSProfileAccess();
  const organizationId = await requireOrganizationId();

  const [counter, warehouses] = await Promise.all([
    prisma.counterMaster.findFirst({
      where: withOrganization(organizationId, { id: params.id }),
    }),
    prisma.inventoryWarehouse.findMany({
      where: withOrganization(organizationId, { isActive: true }),
      orderBy: { name: "asc" },
      select: { name: true },
    }),
  ]);

  if (!counter) notFound();

  return (
    <CounterForm
      initialData={JSON.parse(JSON.stringify(counter))}
      warehouses={JSON.parse(JSON.stringify(warehouses))}
    />
  );
}
