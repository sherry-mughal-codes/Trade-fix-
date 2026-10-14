import fs from "fs";
import path from "path";

import { PrismaClient } from "@prisma/client";

import {
  seedOrganizationDefaults,
  seedOrganizationRoles,
  seedPermissions,
  slugifyOrganizationName,
} from "../lib/organization-bootstrap";

const prisma = new PrismaClient();

function readJsonFile<T>(dir: string, fileName: string, fallback: T): T {
  const filePath = path.join(dir, fileName);
  if (!fs.existsSync(filePath)) {
    return fallback;
  }

  return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
}

async function main() {
  const backfillDir = process.env.BACKFILL_DIR || path.resolve(process.cwd(), ".migration/export");
  const users = readJsonFile<any[]>(backfillDir, "users.json", []);
  const settingsRows = readJsonFile<any[]>(backfillDir, "company-settings.json", []);
  const companyTypes = readJsonFile<any[]>(backfillDir, "company-types.json", []);

  const primarySettings = settingsRows[0] || null;
  const companyName = primarySettings?.companyName || "TradeFix";
  const adminRow = users[0] || null;

  await seedPermissions(prisma);

  const organization = await prisma.organization.upsert({
    where: { slug: slugifyOrganizationName(companyName) || "tradefix" },
    update: {
      name: companyName,
      isActive: true,
      enabledModules: ["customers", "invoices", "payments", "journal", "reports", "hr"],
    },
    create: {
      name: companyName,
      slug: slugifyOrganizationName(companyName) || "tradefix",
      isActive: true,
      enabledModules: ["customers", "invoices", "payments", "journal", "reports", "hr"],
    },
  });

  const admin = await prisma.user.upsert({
    where: { email: (adminRow?.email || process.env.TRADEFIX_ADMIN_EMAIL || "zeeshan@firmeleven.com").toLowerCase() },
    update: {
      name: adminRow?.name || "TradeFix Admin",
      password:
        adminRow?.password ||
        process.env.TRADEFIX_ADMIN_BCRYPT_HASH ||
        process.env.TAXFIX_ADMIN_BCRYPT_HASH ||
        "$2a$10$OA2/L7GSmuJdpqTt15E8L.P6l1LVuEdg6c3.i3/o045sIIj48v9X6",
      isActive: true,
      isSuperadmin: true,
    },
    create: {
      email: (adminRow?.email || process.env.TRADEFIX_ADMIN_EMAIL || "zeeshan@firmeleven.com").toLowerCase(),
      name: adminRow?.name || "TradeFix Admin",
      password:
        adminRow?.password ||
        process.env.TRADEFIX_ADMIN_BCRYPT_HASH ||
        process.env.TAXFIX_ADMIN_BCRYPT_HASH ||
        "$2a$10$OA2/L7GSmuJdpqTt15E8L.P6l1LVuEdg6c3.i3/o045sIIj48v9X6",
      isActive: true,
      isSuperadmin: true,
    },
  });

  await prisma.organizationMembership.upsert({
    where: {
      organizationId_userId: {
        organizationId: organization.id,
        userId: admin.id,
      },
    },
    update: { isOwner: true, isActive: true },
    create: {
      organizationId: organization.id,
      userId: admin.id,
      isOwner: true,
      isActive: true,
    },
  });

  await seedOrganizationRoles(prisma, organization.id);
  await seedOrganizationDefaults(prisma, {
    organizationId: organization.id,
    companyName,
  });

  if (primarySettings) {
    await prisma.companySettings.update({
      where: { organizationId: organization.id },
      data: {
        companyName: primarySettings.companyName || companyName,
        email: primarySettings.email || null,
        phone: primarySettings.phone || null,
        address: primarySettings.address || null,
        taxId: primarySettings.taxId || null,
        baseCurrency: primarySettings.baseCurrency || "PKR",
        dateFormat: primarySettings.dateFormat || "YYYY-MM-DD",
        invoiceTerms: primarySettings.invoiceTerms || null,
        invoicePrefix: primarySettings.invoicePrefix || "INV-",
        invoiceStartNumber: Number(primarySettings.invoiceStartNumber || 1),
        invoiceCurrentNumber: Number(primarySettings.invoiceCurrentNumber || 1),
        journalPrefix: primarySettings.journalPrefix || "JRN-",
        journalStartNumber: Number(primarySettings.journalStartNumber || 1),
        journalCurrentNumber: Number(primarySettings.journalCurrentNumber || 1),
        paymentPrefix: primarySettings.paymentPrefix || "PAY-",
        paymentStartNumber: Number(primarySettings.paymentStartNumber || 1),
        paymentCurrentNumber: Number(primarySettings.paymentCurrentNumber || 1),
        defaultSalesAccount: primarySettings.defaultSalesAccount || "Sales Income",
        defaultPurchaseAccount: primarySettings.defaultPurchaseAccount || "Cost of Goods Sold",
        defaultReceivableAccount: primarySettings.defaultReceivableAccount || "Accounts Receivable",
        defaultPayableAccount: primarySettings.defaultPayableAccount || "Accounts Payable",
        defaultInventoryAssetAccount: primarySettings.defaultInventoryAssetAccount || "Inventory",
        defaultCogsAccount: primarySettings.defaultCogsAccount || "Cost of Goods Sold",
        defaultStockAdjustmentGainAccount: primarySettings.defaultStockAdjustmentGainAccount || "Inventory Gain Adjustment",
        defaultStockAdjustmentLossAccount: primarySettings.defaultStockAdjustmentLossAccount || "Inventory Loss Adjustment",
        defaultOpeningStockAccount: primarySettings.defaultOpeningStockAccount || "Temporary Opening",
        defaultCashGroupAccount: primarySettings.defaultCashGroupAccount || "Cash",
        defaultBankGroupAccount: primarySettings.defaultBankGroupAccount || "Bank",
        defaultExpenseGroupAccount: primarySettings.defaultExpenseGroupAccount || "Indirect Expense",
        salaryDivisionDays: Number(primarySettings.salaryDivisionDays || 30),
        defaultSalaryExpenseAccount: primarySettings.defaultSalaryExpenseAccount || "Salary Expense",
        defaultSalaryPayableAccount: primarySettings.defaultSalaryPayableAccount || "Salary Payable",
        logoUrl: primarySettings.logoUrl || null,
        lightLogoUrl: primarySettings.lightLogoUrl || null,
        iconUrl: primarySettings.iconUrl || null,
        darkIconUrl: primarySettings.darkIconUrl || null,
      },
    });
  }

  for (const companyType of companyTypes) {
    await prisma.companyType.upsert({
      where: {
        organizationId_title: {
          organizationId: organization.id,
          title: companyType.title,
        },
      },
      update: {
        isActive: Boolean(companyType.isActive),
      },
      create: {
        organizationId: organization.id,
        title: companyType.title,
        isActive: Boolean(companyType.isActive),
      },
    });
  }

  console.log(`Backfill completed for org ${organization.name} (${organization.id})`);
}

main()
  .catch(async (error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
