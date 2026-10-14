const fs = require("fs");
const path = require("path");

const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const DEFAULT_MODULES = ["customers", "invoices", "payments", "journal", "reports", "hr"];

const PERMISSIONS = [
  ["dashboard.access", "Access dashboard", "Dashboard", 10],
  ["customers.access", "Access customers", "Customers", 10],
  ["customers.list", "View customers", "Customers", 20],
  ["customers.create", "Create customer", "Customers", 30],
  ["customers.action.edit", "Edit customer", "Customers", 40],
  ["customers.action.delete", "Delete customer", "Customers", 50],
  ["invoices.access", "Access invoices", "Invoices", 10],
  ["invoices.list", "View invoices list", "Invoices", 20],
  ["invoices.create", "Create invoice", "Invoices", 30],
  ["invoices.action.view", "View invoice", "Invoices", 40],
  ["invoices.action.edit", "Edit invoice", "Invoices", 50],
  ["invoices.action.delete", "Delete invoice", "Invoices", 60],
  ["invoices.action.changeStatus", "Change invoice status", "Invoices", 70],
  ["invoices.payment.record", "Record invoice payment", "Invoices", 80],
  ["invoices.paymentPromise.manage", "Manage payment promises", "Invoices", 90],
  ["payments.access", "Access payments", "Payments", 10],
  ["payments.list", "View payments list", "Payments", 20],
  ["payments.create", "Create payment", "Payments", 30],
  ["payments.action.view", "View payment", "Payments", 40],
  ["payments.action.edit", "Edit payment", "Payments", 50],
  ["payments.action.delete", "Delete payment", "Payments", 60],
  ["journal.access", "Access journal", "Journal", 10],
  ["journal.list", "View journal", "Journal", 20],
  ["journal.create", "Create journal entry", "Journal", 30],
  ["journal.action.edit", "Edit journal entry", "Journal", 40],
  ["journal.action.delete", "Delete journal entry", "Journal", 50],
  ["hr.access", "Access HR", "HR", 10],
  ["hr.employees.list", "View employees", "HR", 20],
  ["hr.employees.create", "Create employee", "HR", 30],
  ["hr.employees.action.edit", "Edit employee", "HR", 40],
  ["hr.employees.action.delete", "Delete employee", "HR", 45],
  ["hr.salary.process", "Process salary", "HR", 50],
  ["hr.salary.payments", "Salary payments", "HR", 60],
  ["reports.access", "Access reports", "Reports", 10],
  ["reports.invoicesDueToday", "Report: Invoices Due Today", "Reports", 20],
  ["reports.dueAgeing", "Report: Due Ageing", "Reports", 30],
  ["reports.draftInvoicesToday", "Report: Draft Invoices Today", "Reports", 40],
  ["reports.promisesDueToday", "Report: Promises Due Today", "Reports", 50],
  ["reports.generalLedger", "Report: General Ledger", "Reports", 60],
  ["reports.receivableSummary", "Report: Receivable Summary", "Reports", 70],
  ["settings.access", "Access settings", "Settings", 10],
  ["settings.company.update", "Update company settings", "Settings", 20],
  ["settings.data.access", "Access data settings", "Settings", 30],
  ["settings.masters.manage", "Manage master data", "Settings", 35],
  ["settings.rolesRights.manage", "Manage roles & rights", "Settings", 40],
  ["settings.users.manage", "Manage users", "Settings", 50],
  ["settings.organizations.manage", "Manage organizations", "Settings", 60],
];

const SYSTEM_ROLES = [
  { name: "admin", isSystem: true, allowAll: true, allowedKeys: [] },
  {
    name: "accountant",
    isSystem: true,
    allowAll: false,
    allowedKeys: [
      "dashboard.access",
      "customers.access",
      "customers.list",
      "invoices.access",
      "invoices.list",
      "invoices.action.view",
      "payments.access",
      "payments.list",
      "journal.access",
      "journal.list",
      "reports.access",
      "reports.invoicesDueToday",
      "reports.dueAgeing",
      "reports.draftInvoicesToday",
      "reports.promisesDueToday",
      "reports.generalLedger",
      "reports.receivableSummary",
      "settings.access",
      "settings.data.access",
    ],
  },
  {
    name: "hr",
    isSystem: true,
    allowAll: false,
    allowedKeys: [
      "dashboard.access",
      "hr.access",
      "hr.employees.list",
      "hr.employees.create",
      "hr.employees.action.edit",
      "hr.employees.action.delete",
      "hr.salary.process",
      "hr.salary.payments",
      "settings.access",
    ],
  },
  {
    name: "viewer",
    isSystem: true,
    allowAll: false,
    allowedKeys: [
      "dashboard.access",
      "customers.access",
      "customers.list",
      "invoices.access",
      "invoices.list",
      "invoices.action.view",
      "payments.access",
      "payments.list",
      "journal.access",
      "journal.list",
      "reports.access",
      "reports.invoicesDueToday",
      "reports.dueAgeing",
      "reports.draftInvoicesToday",
      "reports.promisesDueToday",
      "reports.generalLedger",
      "reports.receivableSummary",
    ],
  },
];

function readJsonFile(dir, fileName, fallback) {
  const filePath = path.join(dir, fileName);
  if (!fs.existsSync(filePath)) {
    return fallback;
  }

  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function ensurePermissions() {
  for (const [key, label, group, order] of PERMISSIONS) {
    await prisma.permission.upsert({
      where: { key },
      update: { label, group, order },
      create: { key, label, group, order },
    });
  }
}

async function ensureOrganizationRoles(organizationId) {
  const permissions = await prisma.permission.findMany({ select: { id: true, key: true } });
  const roleMap = new Map();

  for (const seed of SYSTEM_ROLES) {
    const role = await prisma.role.upsert({
      where: {
        organizationId_name: {
          organizationId,
          name: seed.name,
        },
      },
      update: { isSystem: seed.isSystem },
      create: { organizationId, name: seed.name, isSystem: seed.isSystem },
    });
    roleMap.set(seed.name, role);
  }

  for (const seed of SYSTEM_ROLES) {
    const role = roleMap.get(seed.name);
    for (const permission of permissions) {
      const allowed = seed.allowAll || seed.allowedKeys.includes(permission.key);
      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: role.id,
            permissionId: permission.id,
          },
        },
        update: { allowed },
        create: {
          roleId: role.id,
          permissionId: permission.id,
          allowed,
        },
      });
    }
  }
}

async function ensureDefaults(organizationId, companyName) {
  const accounts = [
    { code: "1000", name: "Cash", type: "ASSET", subType: "Cash", isSystem: true },
    { code: "1001", name: "Bank", type: "ASSET", subType: "Bank", isSystem: true },
    { code: "1200", name: "Accounts Receivable", type: "ASSET", subType: "Receivable", isSystem: true },
    { code: "2000", name: "Accounts Payable", type: "LIABILITY", subType: "Payable", isSystem: true },
    { code: "4000", name: "Sales Income", type: "INCOME", subType: "Sales", isSystem: false },
    { code: "5000", name: "Cost of Goods Sold", type: "EXPENSE", subType: "COGS", isSystem: false },
    { code: "6000", name: "General Expenses", type: "EXPENSE", subType: "Expense", isSystem: false },
    { code: "7000", name: "Salary Expense", type: "EXPENSE", subType: "Payroll", isSystem: false },
    { code: "2100", name: "Salary Payable", type: "LIABILITY", subType: "Payroll", isSystem: false },
  ];

  for (const account of accounts) {
    await prisma.account.upsert({
      where: {
        organizationId_name: {
          organizationId,
          name: account.name,
        },
      },
      update: account,
      create: {
        organizationId,
        ...account,
      },
    });
  }

  await prisma.currency.upsert({
    where: {
      organizationId_code: {
        organizationId,
        code: "PKR",
      },
    },
    update: { name: "Pakistani Rupee", symbol: "Rs" },
    create: {
      organizationId,
      code: "PKR",
      name: "Pakistani Rupee",
      symbol: "Rs",
    },
  });

  for (const title of ["Private Limited", "Partnership", "Sole Proprietor", "Association of Persons"]) {
    await prisma.companyType.upsert({
      where: {
        organizationId_title: {
          organizationId,
          title,
        },
      },
      update: { isActive: true },
      create: {
        organizationId,
        title,
        isActive: true,
      },
    });
  }

  await prisma.companySettings.upsert({
    where: { organizationId },
    update: {
      companyName: companyName || "TradeFix",
      baseCurrency: "PKR",
      defaultSalesAccount: "Sales Income",
      defaultPurchaseAccount: "Cost of Goods Sold",
      defaultReceivableAccount: "Accounts Receivable",
      defaultPayableAccount: "Accounts Payable",
      defaultSalaryExpenseAccount: "Salary Expense",
      defaultSalaryPayableAccount: "Salary Payable",
    },
    create: {
      organizationId,
      companyName: companyName || "TradeFix",
      baseCurrency: "PKR",
      defaultSalesAccount: "Sales Income",
      defaultPurchaseAccount: "Cost of Goods Sold",
      defaultReceivableAccount: "Accounts Receivable",
      defaultPayableAccount: "Accounts Payable",
      defaultSalaryExpenseAccount: "Salary Expense",
      defaultSalaryPayableAccount: "Salary Payable",
    },
  });
}

async function main() {
  const backfillDir = process.env.BACKFILL_DIR || path.resolve(process.cwd(), ".migration/export");
  const users = readJsonFile(backfillDir, "users.json", []);
  const settingsRows = readJsonFile(backfillDir, "company-settings.json", []);
  const companyTypes = readJsonFile(backfillDir, "company-types.json", []);

  const primarySettings = settingsRows[0] || null;
  const companyName = primarySettings?.companyName || "TradeFix";
  const adminRow = users[0] || null;
  const organizationSlug = slugify(companyName) || "tradefix";
  const adminEmail = (adminRow?.email || process.env.TRADEFIX_ADMIN_EMAIL || "zeeshan@firmeleven.com").toLowerCase();
  const adminPassword =
    adminRow?.password ||
    process.env.TRADEFIX_ADMIN_BCRYPT_HASH ||
    process.env.TAXFIX_ADMIN_BCRYPT_HASH ||
    "$2b$10$UTXJZcw5TWcV6HEhGPuwA.qmMylJDdLPhkAoTAw6oUe2a4qDy8qRe";

  await ensurePermissions();

  const organization = await prisma.organization.upsert({
    where: { slug: organizationSlug },
    update: {
      name: companyName,
      isActive: true,
      enabledModules: DEFAULT_MODULES,
    },
    create: {
      name: companyName,
      slug: organizationSlug,
      isActive: true,
      enabledModules: DEFAULT_MODULES,
    },
  });

  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      name: adminRow?.name || "TradeFix Admin",
      password: adminPassword,
      isActive: true,
      isSuperadmin: true,
    },
    create: {
      email: adminEmail,
      name: adminRow?.name || "TradeFix Admin",
      password: adminPassword,
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

  await ensureOrganizationRoles(organization.id);
  await ensureDefaults(organization.id, companyName);

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
        defaultCashGroupAccount: primarySettings.defaultCashGroupAccount || null,
        defaultBankGroupAccount: primarySettings.defaultBankGroupAccount || null,
        defaultExpenseGroupAccount: primarySettings.defaultExpenseGroupAccount || null,
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
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
