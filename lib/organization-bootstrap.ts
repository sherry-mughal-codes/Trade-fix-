import bcrypt from "bcryptjs";

import { PERMISSIONS, SYSTEM_ROLES } from "@/lib/permissions";
import { MODULE_KEYS, ModuleKey } from "@/lib/tenancy-config";

export const DEFAULT_ENABLED_MODULES = [...MODULE_KEYS];

export const DEFAULT_CHART_OF_ACCOUNTS = [
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
] as const;

export const DEFAULT_GROUP_ACCOUNT_NAMES = {
  assets: "Assets",
  liability: "Liability",
  equity: "Equity",
  income: "Income",
  expense: "Expense",
  cashGroup: "Cash",
  bankGroup: "Bank",
  indirectExpenseGroup: "Indirect Expense",
} as const;

export const DEFAULT_LEAF_ACCOUNT_NAMES = {
  cashInHand: "Cash in Hand",
  accountsReceivable: "Accounts Receivable",
  inventory: "Inventory",
  accountsPayable: "Accounts Payable",
  salaryPayable: "Salary Payable",
  temporaryOpening: "Temporary Opening",
  ownersShares: "Owners Shares",
  salesIncome: "Sales Income",
  inventoryGainAdjustment: "Inventory Gain Adjustment",
  costOfGoodsSold: "Cost of Goods Sold",
  inventoryLossAdjustment: "Inventory Loss Adjustment",
  salaryExpense: "Salary Expense",
  adminExpense: "Admin Expense",
  otherExpenses: "Other Expenses",
} as const;

export type FirstBankAccountInput = {
  name: string;
  code?: string | null;
};

const DEFAULT_ACCOUNT_BOOTSTRAP_SKIP_THRESHOLD = 8;

export function slugifyOrganizationName(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export async function seedPermissions(prisma: any) {
  for (const permission of PERMISSIONS) {
    await prisma.permission.upsert({
      where: { key: permission.key },
      update: {
        label: permission.label,
        group: permission.group,
        order: permission.order || 0,
      },
      create: {
        key: permission.key,
        label: permission.label,
        group: permission.group,
        order: permission.order || 0,
      },
    });
  }
}

export async function seedOrganizationRoles(prisma: any, organizationId: string) {
  const permissionRows = await prisma.permission.findMany({
    select: { id: true, key: true },
  });

  const roleByName = new Map<string, any>();
  for (const roleSeed of SYSTEM_ROLES) {
    const role = await prisma.role.upsert({
      where: {
        organizationId_name: {
          organizationId,
          name: roleSeed.name,
        },
      },
      update: { isSystem: roleSeed.isSystem },
      create: {
        organizationId,
        name: roleSeed.name,
        isSystem: roleSeed.isSystem,
      },
    });
    roleByName.set(role.name, role);
  }

  for (const roleSeed of SYSTEM_ROLES) {
    const role = roleByName.get(roleSeed.name);
    if (!role) continue;

    const allowAll = Boolean(roleSeed.allowAll);
    const allowed = new Set(roleSeed.allowedKeys || []);

    for (const permission of permissionRows) {
      const isAllowed = allowAll || allowed.has(permission.key);
      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: role.id,
            permissionId: permission.id,
          },
        },
        update: { allowed: isAllowed },
        create: {
          roleId: role.id,
          permissionId: permission.id,
          allowed: isAllowed,
        },
      });
    }
  }

  return roleByName;
}

export async function ensureDefaultAccountsForOrganization(
  prisma: any,
  organizationId: string,
  options?: { firstBankAccount?: FirstBankAccountInput | null },
) {
  const firstBank = options?.firstBankAccount || null;
  const defaultAccountNames = DEFAULT_CHART_OF_ACCOUNTS.map((account) => account.name);
  const existingDefaultCount = await prisma.account.count({
    where: {
      organizationId,
      name: { in: defaultAccountNames },
    },
  });

  // Legacy organizations can already contain an older CoA with overlapping names/codes.
  // Re-applying the new defaults on page load causes unique-code collisions and crashes
  // settings/data screens in production. Once enough default accounts exist, treat the
  // bootstrap as complete and only allow the optional first bank account creation below.
  if (existingDefaultCount < DEFAULT_ACCOUNT_BOOTSTRAP_SKIP_THRESHOLD) {
    const groups = DEFAULT_CHART_OF_ACCOUNTS.filter((a) => a.parentName === null);
    const nonRoots = DEFAULT_CHART_OF_ACCOUNTS.filter((a) => a.parentName !== null);

    for (const account of groups) {
      await prisma.account.upsert({
        where: {
          organizationId_name: { organizationId, name: account.name },
        },
        update: {
          code: account.code,
          type: account.type,
          subType: account.subType,
          isSystem: account.isSystem,
          isGroup: account.isGroup,
          parentId: null,
        },
        create: {
          organizationId,
          code: account.code,
          name: account.name,
          type: account.type,
          subType: account.subType,
          isSystem: account.isSystem,
          isGroup: account.isGroup,
          parentId: null,
        },
      });
    }

    const existing = await prisma.account.findMany({
      where: { organizationId },
      select: { id: true, name: true, code: true },
    });
    const byName = new Map<string, string>(existing.map((a: any) => [a.name, a.id] as const));

    const nonRootLevelOrder = ["Cash", "Bank", "Indirect Expense"];
    const sortedNonRoots = [...nonRoots].sort((a, b) => {
      const aLvl = a.isGroup ? 0 : (nonRootLevelOrder.includes(a.parentName as string) ? 1 : 2);
      const bLvl = b.isGroup ? 0 : (nonRootLevelOrder.includes(b.parentName as string) ? 1 : 2);
      if (aLvl !== bLvl) return aLvl - bLvl;
      return a.code.localeCompare(b.code);
    });

    for (const account of sortedNonRoots) {
      const parentId = byName.get(account.parentName as string) || null;
      const upserted: any = await prisma.account.upsert({
        where: {
          organizationId_name: { organizationId, name: account.name },
        },
        update: {
          code: account.code,
          type: account.type,
          subType: account.subType,
          isSystem: account.isSystem,
          isGroup: account.isGroup,
          parentId,
        },
        create: {
          organizationId,
          code: account.code,
          name: account.name,
          type: account.type,
          subType: account.subType,
          isSystem: account.isSystem,
          isGroup: account.isGroup,
          parentId,
        },
        select: { id: true, name: true },
      });
      byName.set(upserted.name, upserted.id);
    }
  }

  if (firstBank?.name) {
    const existing = await prisma.account.findMany({
      where: { organizationId },
      select: { id: true, name: true },
    });
    const byName = new Map<string, string>(existing.map((a: any) => [a.name, a.id] as const));
    const bankGroupId = byName.get(DEFAULT_GROUP_ACCOUNT_NAMES.bankGroup) || null;
    const bankName = firstBank.name.trim();
    const bankCode = (firstBank.code || "1201").toString().trim();
    if (bankGroupId && bankName) {
      await prisma.account.upsert({
        where: {
          organizationId_name: { organizationId, name: bankName },
        },
        update: {
          code: bankCode,
          type: "ASSET",
          subType: "Bank",
          isSystem: false,
          isGroup: false,
          parentId: bankGroupId,
        },
        create: {
          organizationId,
          code: bankCode,
          name: bankName,
          type: "ASSET",
          subType: "Bank",
          isSystem: false,
          isGroup: false,
          parentId: bankGroupId,
        },
      });
    }
  }
}

export async function seedOrganizationDefaults(
  prisma: any,
  input: {
    organizationId: string;
    companyName: string;
    enabledModules?: string[];
    firstBankAccount?: FirstBankAccountInput | null;
  },
) {
  const organizationId = input.organizationId;
  const companyName = input.companyName;
  const enabledModules = input.enabledModules || DEFAULT_ENABLED_MODULES;
  const allowNegativeStock = !enabledModules.includes("inventory");

  await ensureDefaultAccountsForOrganization(prisma, organizationId, {
    firstBankAccount: input.firstBankAccount || null,
  });

  const allAccounts = await prisma.account.findMany({
    where: { organizationId },
    select: { name: true, id: true, code: true },
  });
  const idByName = new Map(allAccounts.map((a: any) => [a.name, a.id] as const));

  const resolveAccountRef = (name: string) => idByName.get(name) || name;

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

  const companyTypes = ["Private Limited", "Partnership", "Sole Proprietor", "Association of Persons"];
  for (const title of companyTypes) {
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

  const defaults = {
    companyName,
    baseCurrency: "PKR",
    defaultSalesAccount: resolveAccountRef(DEFAULT_LEAF_ACCOUNT_NAMES.salesIncome),
    defaultPurchaseAccount: resolveAccountRef(DEFAULT_LEAF_ACCOUNT_NAMES.costOfGoodsSold),
    defaultReceivableAccount: resolveAccountRef(DEFAULT_LEAF_ACCOUNT_NAMES.accountsReceivable),
    defaultPayableAccount: resolveAccountRef(DEFAULT_LEAF_ACCOUNT_NAMES.accountsPayable),
    defaultInventoryAssetAccount: resolveAccountRef(DEFAULT_LEAF_ACCOUNT_NAMES.inventory),
    defaultCogsAccount: resolveAccountRef(DEFAULT_LEAF_ACCOUNT_NAMES.costOfGoodsSold),
    defaultStockAdjustmentGainAccount: resolveAccountRef(DEFAULT_LEAF_ACCOUNT_NAMES.inventoryGainAdjustment),
    defaultStockAdjustmentLossAccount: resolveAccountRef(DEFAULT_LEAF_ACCOUNT_NAMES.inventoryLossAdjustment),
    defaultOpeningStockAccount: resolveAccountRef(DEFAULT_LEAF_ACCOUNT_NAMES.temporaryOpening),
    defaultSalaryExpenseAccount: resolveAccountRef(DEFAULT_LEAF_ACCOUNT_NAMES.salaryExpense),
    defaultSalaryPayableAccount: resolveAccountRef(DEFAULT_LEAF_ACCOUNT_NAMES.salaryPayable),
    defaultCashGroupAccount: resolveAccountRef(DEFAULT_GROUP_ACCOUNT_NAMES.cashGroup),
    defaultBankGroupAccount: resolveAccountRef(DEFAULT_GROUP_ACCOUNT_NAMES.bankGroup),
    defaultExpenseGroupAccount: resolveAccountRef(DEFAULT_GROUP_ACCOUNT_NAMES.indirectExpenseGroup),
    allowNegativeStock,
  };

  await prisma.companySettings.upsert({
    where: { organizationId },
    update: defaults,
    create: {
      organizationId,
      ...defaults,
    },
  });
}

const USERNAME_REGEX = /^[a-z0-9._-]+$/;

function normalizeOptionalEmail(value?: string | null) {
  const email = String(value || "").trim().toLowerCase();
  return email || null;
}

function normalizeOptionalUsername(value?: string | null) {
  const username = String(value || "").trim().toLowerCase();
  return username || null;
}

async function findExistingUserIdentity(tx: any, email: string | null, username: string | null) {
  const checks = [] as Array<Record<string, string>>;
  if (email) {
    checks.push({ email });
    checks.push({ username: email });
  }
  if (username) {
    checks.push({ username });
    checks.push({ email: username });
  }
  if (!checks.length) return null;

  return tx.user.findFirst({
    where: { OR: checks },
    select: { id: true },
  });
}

export async function createOrganizationWithOwner(
  prisma: any,
  input: {
    organizationName: string;
    slug?: string;
    enabledModules?: string[];
    ownerName: string;
    ownerEmail?: string;
    ownerUsername?: string;
    ownerPassword: string;
    firstBankAccount?: FirstBankAccountInput | null;
  },
) {
  const slug = slugifyOrganizationName(input.slug || input.organizationName);
  const enabledModules = (input.enabledModules || DEFAULT_ENABLED_MODULES).filter((item): item is ModuleKey | string =>
    typeof item === "string" && DEFAULT_ENABLED_MODULES.includes(item as ModuleKey),
  );
  const ownerEmail = normalizeOptionalEmail(input.ownerEmail);
  const ownerUsername = normalizeOptionalUsername(input.ownerUsername);

  if (!ownerEmail && !ownerUsername) {
    throw new Error("Owner email or username is required.");
  }

  if (ownerUsername && !USERNAME_REGEX.test(ownerUsername)) {
    throw new Error("Username can only contain letters, numbers, dots, underscores, and hyphens.");
  }

  const firstBankAccount = input.firstBankAccount || null;

  return prisma.$transaction(async (tx: any) => {
    const organization = await tx.organization.create({
      data: {
        name: input.organizationName,
        slug,
        enabledModules,
        isActive: true,
      },
    });

    const existingIdentity = await findExistingUserIdentity(tx, ownerEmail, ownerUsername);
    let owner;
    if (existingIdentity) {
      owner = await tx.user.update({
        where: { id: existingIdentity.id },
        data: {
          name: input.ownerName.trim(),
          isActive: true,
        },
      });
    } else {
      const hashedPassword = await bcrypt.hash(input.ownerPassword, 10);
      owner = await tx.user.create({
        data: {
          email: ownerEmail,
          username: ownerUsername,
          name: input.ownerName.trim(),
          password: hashedPassword,
          isActive: true,
          isSuperadmin: false,
        },
      });
    }

    await tx.organizationMembership.upsert({
      where: {
        organizationId_userId: { organizationId: organization.id, userId: owner.id },
      },
      update: { isOwner: true, isActive: true },
      create: {
        organizationId: organization.id,
        userId: owner.id,
        isOwner: true,
        isActive: true,
      },
    });

    await seedPermissions(tx);
    const roles = await seedOrganizationRoles(tx, organization.id);
    const adminRole = roles.get("admin");
    if (adminRole) {
      await tx.userRole.upsert({
        where: {
          userId_roleId: { userId: owner.id, roleId: adminRole.id },
        },
        update: {},
        create: {
          userId: owner.id,
          roleId: adminRole.id,
        },
      });
    }

    await seedOrganizationDefaults(tx, {
      organizationId: organization.id,
      companyName: input.organizationName,
      enabledModules,
      firstBankAccount,
    });

    return organization;
  });
}
