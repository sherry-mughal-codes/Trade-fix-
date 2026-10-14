const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

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

const DEFAULT_MODULES = ["customers", "invoices", "payments", "inventory", "journal", "reports", "hr", "pos"];

function slugify(value) {
  return value
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

async function ensureDefaultOrganization(companyName) {
  const slug = slugify(companyName || "tradefix");
  return prisma.organization.upsert({
    where: { slug },
    update: {
      name: companyName || "TradeFix",
      isActive: true,
      enabledModules: DEFAULT_MODULES,
    },
    create: {
      name: companyName || "TradeFix",
      slug,
      isActive: true,
      enabledModules: DEFAULT_MODULES,
    },
  });
}

async function ensureAdmin() {
  const email = process.env.TRADEFIX_ADMIN_EMAIL || process.env.TAXFIX_ADMIN_EMAIL || "zeeshan@firmeleven.com";
  const hashedPassword =
    process.env.TRADEFIX_ADMIN_BCRYPT_HASH || process.env.TAXFIX_ADMIN_BCRYPT_HASH ||
    "$2b$10$UTXJZcw5TWcV6HEhGPuwA.qmMylJDdLPhkAoTAw6oUe2a4qDy8qRe";

  return prisma.user.upsert({
    where: { email },
    update: {
      password: hashedPassword,
      isActive: true,
      isSuperadmin: true,
      name: "TradeFix Admin",
    },
    create: {
      email,
      password: hashedPassword,
      isActive: true,
      isSuperadmin: true,
      name: "TradeFix Admin",
    },
  });
}

async function ensureOrganizationMembership(organizationId, userId) {
  await prisma.organizationMembership.upsert({
    where: {
      organizationId_userId: {
        organizationId,
        userId,
      },
    },
    update: {
      isOwner: true,
      isActive: true,
    },
    create: {
      organizationId,
      userId,
      isOwner: true,
      isActive: true,
    },
  });
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
  const accountNames = [
    "Assets",
    "Liability",
    "Equity",
    "Income",
    "Expense",
    "Cash",
    "Cash in Hand",
    "Bank",
    "Accounts Receivable",
    "Inventory",
    "Accounts Payable",
    "Salary Payable",
    "Temporary Opening",
    "Owners Shares",
    "Sales Income",
    "Inventory Gain Adjustment",
    "Cost of Goods Sold",
    "Inventory Loss Adjustment",
    "Indirect Expense",
    "Salary Expense",
    "Admin Expense",
    "Other Expenses",
  ];
  const existing = await prisma.account.count({
    where: { organizationId, name: { in: accountNames } },
  });
  const totalAccountsForOrg = await prisma.account.count({
    where: { organizationId },
  });
  const accountBootstrapDone =
    existing >= 10 || totalAccountsForOrg >= 8;

  if (!accountBootstrapDone) {
    const DEFAULT_CHART_OF_ACCOUNTS = [
      { code: "1000", name: "Assets", type: "ASSET", subType: null, isSystem: true, isGroup: true, parentName: null },
      { code: "2000", name: "Liability", type: "LIABILITY", subType: null, isSystem: true, isGroup: true, parentName: null },
      { code: "3000", name: "Equity", type: "EQUITY", subType: null, isSystem: true, isGroup: true, parentName: null },
      { code: "4000", name: "Income", type: "INCOME", subType: null, isSystem: true, isGroup: true, parentName: null },
      { code: "5000", name: "Expense", type: "EXPENSE", subType: null, isSystem: true, isGroup: true, parentName: null },
      { code: "1100", name: "Cash", type: "ASSET", subType: "Cash", isSystem: true, isGroup: true, parentName: "Assets" },
      { code: "1101", name: "Cash in Hand", type: "ASSET", subType: "Cash", isSystem: false, isGroup: false, parentName: "Cash" },
      { code: "1200", name: "Bank", type: "ASSET", subType: "Bank", isSystem: true, isGroup: true, parentName: "Assets" },
      { code: "1300", name: "Accounts Receivable", type: "ASSET", subType: "Receivable", isSystem: true, isGroup: false, parentName: "Assets" },
      { code: "1400", name: "Inventory", type: "ASSET", subType: "Inventory", isSystem: true, isGroup: false, parentName: "Assets" },
      { code: "2100", name: "Accounts Payable", type: "LIABILITY", subType: "Payable", isSystem: true, isGroup: false, parentName: "Liability" },
      { code: "2200", name: "Salary Payable", type: "LIABILITY", subType: "Payroll", isSystem: false, isGroup: false, parentName: "Liability" },
      { code: "3100", name: "Temporary Opening", type: "EQUITY", subType: "Opening Balance", isSystem: false, isGroup: false, parentName: "Equity" },
      { code: "3200", name: "Owners Shares", type: "EQUITY", subType: "Equity", isSystem: false, isGroup: false, parentName: "Equity" },
      { code: "4100", name: "Sales Income", type: "INCOME", subType: "Sales", isSystem: false, isGroup: false, parentName: "Income" },
      { code: "4200", name: "Inventory Gain Adjustment", type: "INCOME", subType: "Inventory", isSystem: false, isGroup: false, parentName: "Income" },
      { code: "5100", name: "Cost of Goods Sold", type: "EXPENSE", subType: "COGS", isSystem: false, isGroup: false, parentName: "Expense" },
      { code: "5200", name: "Inventory Loss Adjustment", type: "EXPENSE", subType: "Inventory", isSystem: false, isGroup: false, parentName: "Expense" },
      { code: "5300", name: "Indirect Expense", type: "EXPENSE", subType: "Expense", isSystem: false, isGroup: true, parentName: "Expense" },
      { code: "5310", name: "Salary Expense", type: "EXPENSE", subType: "Payroll", isSystem: false, isGroup: false, parentName: "Indirect Expense" },
      { code: "5320", name: "Admin Expense", type: "EXPENSE", subType: "Expense", isSystem: false, isGroup: false, parentName: "Indirect Expense" },
      { code: "5330", name: "Other Expenses", type: "EXPENSE", subType: "Expense", isSystem: false, isGroup: false, parentName: "Indirect Expense" },
    ];

    const roots = DEFAULT_CHART_OF_ACCOUNTS.filter((a) => a.parentName === null);
    const nonRoots = DEFAULT_CHART_OF_ACCOUNTS.filter((a) => a.parentName !== null);

    for (const a of roots) {
      await prisma.account.upsert({
        where: { organizationId_name: { organizationId, name: a.name } },
        update: {
          code: a.code, type: a.type, subType: a.subType,
          isSystem: a.isSystem, isGroup: a.isGroup, parentId: null,
        },
        create: {
          organizationId,
          code: a.code, name: a.name, type: a.type, subType: a.subType,
          isSystem: a.isSystem, isGroup: a.isGroup, parentId: null,
        },
      });
    }

    const byName = new Map(
      (await prisma.account.findMany({ where: { organizationId }, select: { id: true, name: true } }))
        .map((a) => [a.name, a.id])
    );

    const nonRootLevelOrder = ["Cash", "Bank", "Indirect Expense"];
    const sorted = [...nonRoots].sort((a, b) => {
      const aLvl = a.isGroup ? 0 : (nonRootLevelOrder.includes(a.parentName) ? 1 : 2);
      const bLvl = b.isGroup ? 0 : (nonRootLevelOrder.includes(b.parentName) ? 1 : 2);
      if (aLvl !== bLvl) return aLvl - bLvl;
      return a.code.localeCompare(b.code);
    });

    for (const a of sorted) {
      const parentId = byName.get(a.parentName) || null;
      const upserted = await prisma.account.upsert({
        where: { organizationId_name: { organizationId, name: a.name } },
        update: {
          code: a.code, type: a.type, subType: a.subType,
          isSystem: a.isSystem, isGroup: a.isGroup, parentId,
        },
        create: {
          organizationId,
          code: a.code, name: a.name, type: a.type, subType: a.subType,
          isSystem: a.isSystem, isGroup: a.isGroup, parentId,
        },
        select: { id: true, name: true },
      });
      byName.set(upserted.name, upserted.id);
    }
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

  const accts = new Map(
    (await prisma.account.findMany({ where: { organizationId }, select: { id: true, name: true, code: true } }))
      .map((a) => [a.name, a])
  );
  const ref = (name) => (accts.get(name)?.id || name);

  await prisma.companySettings.upsert({
    where: { organizationId },
    update: {
      companyName: companyName || "TradeFix",
      baseCurrency: "PKR",
      defaultSalesAccount: ref("Sales Income"),
      defaultPurchaseAccount: ref("Cost of Goods Sold"),
      defaultReceivableAccount: ref("Accounts Receivable"),
      defaultPayableAccount: ref("Accounts Payable"),
      defaultInventoryAssetAccount: ref("Inventory"),
      defaultCogsAccount: ref("Cost of Goods Sold"),
      defaultStockAdjustmentGainAccount: ref("Inventory Gain Adjustment"),
      defaultStockAdjustmentLossAccount: ref("Inventory Loss Adjustment"),
      defaultOpeningStockAccount: ref("Temporary Opening"),
      defaultSalaryExpenseAccount: ref("Salary Expense"),
      defaultSalaryPayableAccount: ref("Salary Payable"),
      defaultCashGroupAccount: ref("Cash"),
      defaultBankGroupAccount: ref("Bank"),
      defaultExpenseGroupAccount: ref("Indirect Expense"),
    },
    create: {
      organizationId,
      companyName: companyName || "TradeFix",
      baseCurrency: "PKR",
      defaultSalesAccount: ref("Sales Income"),
      defaultPurchaseAccount: ref("Cost of Goods Sold"),
      defaultReceivableAccount: ref("Accounts Receivable"),
      defaultPayableAccount: ref("Accounts Payable"),
      defaultInventoryAssetAccount: ref("Inventory"),
      defaultCogsAccount: ref("Cost of Goods Sold"),
      defaultStockAdjustmentGainAccount: ref("Inventory Gain Adjustment"),
      defaultStockAdjustmentLossAccount: ref("Inventory Loss Adjustment"),
      defaultOpeningStockAccount: ref("Temporary Opening"),
      defaultSalaryExpenseAccount: ref("Salary Expense"),
      defaultSalaryPayableAccount: ref("Salary Payable"),
      defaultCashGroupAccount: ref("Cash"),
      defaultBankGroupAccount: ref("Bank"),
      defaultExpenseGroupAccount: ref("Indirect Expense"),
    },
  });
}

async function main() {
  await ensurePermissions();
  const admin = await ensureAdmin();
  const organization = await ensureDefaultOrganization("TradeFix");
  await ensureOrganizationMembership(organization.id, admin.id);
  await ensureOrganizationRoles(organization.id);
  await ensureDefaults(organization.id, organization.name);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
