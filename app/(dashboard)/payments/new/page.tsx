import { prisma } from "@/lib/prisma";
import PaymentForm from "../payment-form";
import { requirePageAccess } from "@/lib/rbac";
import { requireOrganizationId } from "@/lib/tenant-db";

export default async function NewPaymentPage() {
  await requirePageAccess("payments.create", "/payments");
  const organizationId = await requireOrganizationId();
  const [parties, currencies, accounts, companySettings] = await Promise.all([
    prisma.party.findMany({
      where: { organizationId },
      orderBy: { name: 'asc' },
    }),
    prisma.currency.findMany({
      where: { organizationId },
      orderBy: { code: 'asc' },
    }),
    prisma.account.findMany({
      where: { organizationId, type: "ASSET" },
      include: { parent: true },
      orderBy: { name: 'asc' }
    }),
    prisma.companySettings.findFirst({
      where: { organizationId },
      select: { defaultCashGroupAccount: true, defaultBankGroupAccount: true },
    }),
  ]);

  const cashGroup = await prisma.account.findFirst({
    where: {
      organizationId,
      isGroup: true,
      OR: [
        ...(companySettings?.defaultCashGroupAccount ? [{ id: companySettings.defaultCashGroupAccount }, { name: companySettings.defaultCashGroupAccount }] : []),
        { code: "1100" },
        { name: "Cash" },
      ],
    },
    select: { id: true },
  });
  const cashGroupAccountId = cashGroup?.id || null;

  const bankGroup = await prisma.account.findFirst({
    where: {
      organizationId,
      isGroup: true,
      OR: [
        ...(companySettings?.defaultBankGroupAccount ? [{ id: companySettings.defaultBankGroupAccount }, { name: companySettings.defaultBankGroupAccount }] : []),
        { code: "1200" },
        { name: "Bank" },
      ],
    },
    select: { id: true },
  });
  const bankGroupAccountId = bankGroup?.id || null;

  return (
    <div className="space-y-6">
      <PaymentForm
        parties={parties}
        currencies={currencies}
        accounts={accounts}
        cashGroupAccountId={cashGroupAccountId}
        bankGroupAccountId={bankGroupAccountId}
      />
    </div>
  );
}
