import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireOrganizationId, withOrganization } from "@/lib/tenant-db";
import { requirePOSProfileAccess } from "../../../access";
import POSProfileForm from "../../pos-profile-form";

export const dynamic = "force-dynamic";

export default async function EditPOSProfilePage({ params }: { params: { id: string } }) {
  await requirePOSProfileAccess();
  const organizationId = await requireOrganizationId();

  const [profile, users, customers, priceLists, counters, accounts] = await Promise.all([
    prisma.pOSProfile.findFirst({
      where: withOrganization(organizationId, { id: params.id }),
    }),
    prisma.user.findMany({
      where: { isActive: true },
      orderBy: [{ name: "asc" }, { email: "asc" }],
      select: { id: true, name: true, email: true },
    }),
    prisma.party.findMany({
      where: withOrganization(organizationId, {
        type: { in: ["CUSTOMER", "BOTH"] },
        isActive: true,
      }),
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.priceList.findMany({
      where: withOrganization(organizationId, {
        type: "SELLING",
        isActive: true,
      }),
      orderBy: [{ isSystemDefault: "desc" }, { name: "asc" }],
      select: { id: true, name: true },
    }),
    prisma.counterMaster.findMany({
      where: withOrganization(organizationId, { isActive: true }),
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.account.findMany({
      where: withOrganization(organizationId),
      orderBy: { name: "asc" },
      select: { id: true, name: true, type: true, subType: true, isGroup: true },
    }),
  ]);

  if (!profile) notFound();

  return (
    <POSProfileForm
      initialData={JSON.parse(JSON.stringify(profile))}
      users={JSON.parse(JSON.stringify(users))}
      customers={JSON.parse(JSON.stringify(customers))}
      priceLists={JSON.parse(JSON.stringify(priceLists))}
      counters={JSON.parse(JSON.stringify(counters))}
      accounts={JSON.parse(JSON.stringify(accounts))}
    />
  );
}
