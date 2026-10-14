import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

type RenameRow = {
  matchName: string;
  matchCode?: string;
  newName?: string;
  newCode?: string;
  newType?: string;
  newSubType?: string | null;
  newIsGroup?: boolean;
  newIsSystem?: boolean;
  parentByName?: string | null;
  note?: string;
};

const RENAME_PLAN: RenameRow[] = [
  {
    matchName: "Cash",
    matchCode: "1000",
    newName: "Cash in Hand",
    newCode: "1101",
    newType: "ASSET",
    newSubType: "Cash",
    newIsGroup: false,
    newIsSystem: false,
    parentByName: "Cash",
    note: "Old 1000 'Cash' was a leaf; renaming to 1101 'Cash in Hand' under new 1100 'Cash' group.",
  },
  {
    matchName: "Bank",
    matchCode: "1001",
    newName: "Bank",
    newCode: "1200",
    newType: "ASSET",
    newSubType: "Bank",
    newIsGroup: true,
    newIsSystem: true,
    parentByName: "Assets",
    note: "Old 1001 Bank; promoting to group account 1200. If there are postings on this account they must be moved to a child bank account afterward.",
  },
  {
    matchName: "Accounts Receivable",
    matchCode: "1200",
    newCode: "1300",
    parentByName: "Assets",
  },
  {
    matchName: "Inventory Asset",
    newName: "Inventory",
    newCode: "1400",
    parentByName: "Assets",
  },
  {
    matchName: "Accounts Payable",
    matchCode: "2000",
    newCode: "2100",
    parentByName: "Liability",
  },
  {
    matchName: "Salary Payable",
    matchCode: "2100",
    newCode: "2200",
    parentByName: "Liability",
  },
  {
    matchName: "Opening Stock Equity",
    newName: "Temporary Opening",
    newCode: "3100",
    newSubType: "Opening Balance",
    parentByName: "Equity",
  },
  {
    matchName: "Inventory Adjustment Gain",
    newName: "Inventory Gain Adjustment",
    newCode: "4200",
    parentByName: "Income",
  },
  {
    matchName: "Sales Income",
    matchCode: "4000",
    newCode: "4100",
    parentByName: "Income",
  },
  {
    matchName: "Cost of Goods Sold",
    matchCode: "5000",
    newCode: "5100",
    parentByName: "Expense",
  },
  {
    matchName: "Inventory Adjustment Loss",
    newName: "Inventory Loss Adjustment",
    newCode: "5200",
    parentByName: "Expense",
  },
  {
    matchName: "General Expenses",
    newName: "Admin Expense",
    newCode: "5320",
    newSubType: "Expense",
    parentByName: "Indirect Expense",
  },
  {
    matchName: "Salary Expense",
    matchCode: "7000",
    newCode: "5310",
    parentByName: "Indirect Expense",
  },
];

const NEW_ACCOUNTS: Array<{
  code: string;
  name: string;
  type: string;
  subType: string | null;
  isGroup: boolean;
  isSystem: boolean;
  parentByName: string | null;
}> = [
  { code: "1000", name: "Assets", type: "ASSET", subType: null, isGroup: true, isSystem: true, parentByName: null },
  { code: "2000", name: "Liability", type: "LIABILITY", subType: null, isGroup: true, isSystem: true, parentByName: null },
  { code: "3000", name: "Equity", type: "EQUITY", subType: null, isGroup: true, isSystem: true, parentByName: null },
  { code: "4000", name: "Income", type: "INCOME", subType: null, isGroup: true, isSystem: true, parentByName: null },
  { code: "5000", name: "Expense", type: "EXPENSE", subType: null, isGroup: true, isSystem: true, parentByName: null },
  { code: "1100", name: "Cash", type: "ASSET", subType: "Cash", isGroup: true, isSystem: true, parentByName: "Assets" },
  { code: "3200", name: "Owners Shares", type: "EQUITY", subType: "Equity", isGroup: false, isSystem: false, parentByName: "Equity" },
  { code: "5300", name: "Indirect Expense", type: "EXPENSE", subType: "Expense", isGroup: true, isSystem: false, parentByName: "Expense" },
  { code: "5330", name: "Other Expenses", type: "EXPENSE", subType: "Expense", isGroup: false, isSystem: false, parentByName: "Indirect Expense" },
];

const DELETED_ACCOUNT_NAMES = ["Purchase Account"];

const SETTINGS_MAP: Array<{
  field: string;
  newValue: string;
  ifMatchesAny?: string[];
}> = [
  { field: "defaultInventoryAssetAccount", newValue: "Inventory", ifMatchesAny: ["Inventory Asset"] },
  { field: "defaultOpeningStockAccount", newValue: "Temporary Opening", ifMatchesAny: ["Opening Stock Equity"] },
  { field: "defaultStockAdjustmentGainAccount", newValue: "Inventory Gain Adjustment", ifMatchesAny: ["Inventory Adjustment Gain"] },
  { field: "defaultStockAdjustmentLossAccount", newValue: "Inventory Loss Adjustment", ifMatchesAny: ["Inventory Adjustment Loss"] },
  { field: "defaultPurchaseAccount", newValue: "Cost of Goods Sold", ifMatchesAny: ["Purchase Account"] },
  { field: "defaultExpenseGroupAccount", newValue: "Indirect Expense", ifMatchesAny: [null as any] },
  { field: "defaultCashGroupAccount", newValue: "Cash", ifMatchesAny: [null as any] },
  { field: "defaultBankGroupAccount", newValue: "Bank", ifMatchesAny: [null as any] },
];

type AccountLike = {
  id: string;
  name: string;
  code: string;
  type: string;
  subType: string | null;
  isGroup: boolean;
  isSystem: boolean;
  parentId: string | null;
};

type LiveState = {
  byId: Map<string, AccountLike>;
  byName: Map<string, AccountLike>;
  byCode: Map<string, AccountLike>;
};

function buildState(rows: AccountLike[]): LiveState {
  const byId = new Map<string, AccountLike>();
  const byName = new Map<string, AccountLike>();
  const byCode = new Map<string, AccountLike>();
  for (const r of rows) {
    byId.set(r.id, r);
    byName.set(r.name, r);
    byCode.set(r.code, r);
  }
  return { byId, byName, byCode };
}

function applyStatePatch(state: LiveState, id: string, patch: Partial<AccountLike>) {
  const acc = state.byId.get(id);
  if (!acc) return;
  const oldName = acc.name;
  const oldCode = acc.code;
  const next: AccountLike = { ...acc, ...patch };
  state.byId.set(id, next);
  if (oldName !== next.name) {
    state.byName.delete(oldName);
  }
  state.byName.set(next.name, next);
  if (oldCode !== next.code) {
    state.byCode.delete(oldCode);
  }
  state.byCode.set(next.code, next);
}

function applyStateCreate(state: LiveState, acc: AccountLike) {
  state.byId.set(acc.id, acc);
  state.byName.set(acc.name, acc);
  state.byCode.set(acc.code, acc);
}

function applyStateDelete(state: LiveState, id: string) {
  const acc = state.byId.get(id);
  if (!acc) return;
  state.byId.delete(id);
  state.byName.delete(acc.name);
  state.byCode.delete(acc.code);
}

async function refetchState(prisma: PrismaClient, orgId: string): Promise<LiveState> {
  const rows = (await prisma.account.findMany({
    where: { organizationId: orgId },
    select: { id: true, name: true, code: true, type: true, subType: true, isGroup: true, isSystem: true, parentId: true },
  })) as AccountLike[];
  return buildState(rows);
}

async function migrateOrganization(orgId: string, dryRun: boolean) {
  const initial = await refetchState(prisma, orgId);
  const state: LiveState = {
    byId: new Map(initial.byId),
    byName: new Map(initial.byName),
    byCode: new Map(initial.byCode),
  };

  console.log(`\n=== Organization ${orgId} ===  ${dryRun ? "[DRY RUN]" : "[APPLY]"}`);
  console.log(`Current accounts: ${state.byId.size}`);

  const planSteps: string[] = [];

  const TMP_PREFIX = "__tmp__";

  const hasAnyCodeChange = RENAME_PLAN.some((r) => r.newCode);
  if (hasAnyCodeChange) {
    for (const row of RENAME_PLAN) {
      if (!row.newCode) continue;
      const match = state.byName.get(row.matchName);
      if (!match) {
        planSteps.push(`SKIP tmp-code for '${row.matchName}': account not found`);
        continue;
      }
      if (match.code === row.newCode) continue;
      const tmpCode = TMP_PREFIX + row.newCode;
      if (state.byCode.has(tmpCode)) {
        planSteps.push(`CONFLICT tmp-code '${tmpCode}' for '${row.matchName}': code already exists. Manual fix.`);
        continue;
      }
      planSteps.push(`STAGE-1a vacate-code '${row.matchName}' (${match.id}): ${match.code} → ${tmpCode}`);
      if (!dryRun) {
        const updated = (await prisma.account.update({
          where: { id: match.id },
          data: { code: tmpCode },
          select: { id: true, name: true, code: true, type: true, subType: true, isGroup: true, isSystem: true, parentId: true },
        })) as AccountLike;
        applyStatePatch(state, updated.id, { code: updated.code });
      } else {
        applyStatePatch(state, match.id, { code: tmpCode });
      }
    }

    for (const row of RENAME_PLAN) {
      if (!row.newCode) continue;
      const match = state.byName.get(row.matchName);
      if (!match) continue;
      if (match.code === row.newCode) continue;
      if (!match.code.startsWith(TMP_PREFIX)) continue;
      planSteps.push(`STAGE-1b final-code '${row.matchName}' (${match.id}): ${match.code} → ${row.newCode}`);
      if (!dryRun) {
        const updated = (await prisma.account.update({
          where: { id: match.id },
          data: { code: row.newCode },
          select: { id: true, name: true, code: true, type: true, subType: true, isGroup: true, isSystem: true, parentId: true },
        })) as AccountLike;
        applyStatePatch(state, updated.id, { code: updated.code });
      } else {
        applyStatePatch(state, match.id, { code: row.newCode });
      }
    }
  }

  for (const row of RENAME_PLAN) {
    const match = state.byName.get(row.matchName);
    if (!match) {
      planSteps.push(`SKIP rename-attrs '${row.matchName}': not found`);
      continue;
    }
    const patch: Partial<AccountLike> = {};
    if (row.newName && row.newName !== match.name) patch.name = row.newName;
    if (row.newType && row.newType !== match.type) patch.type = row.newType;
    if (row.newSubType !== undefined && row.newSubType !== match.subType) patch.subType = row.newSubType;
    if (row.newIsGroup !== undefined && row.newIsGroup !== match.isGroup) patch.isGroup = row.newIsGroup;
    if (row.newIsSystem !== undefined && row.newIsSystem !== match.isSystem) patch.isSystem = row.newIsSystem;
    if (Object.keys(patch).length === 0) continue;
    const desc = Object.entries(patch)
      .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
      .join(", ");
    planSteps.push(`STAGE-2 rename-attrs '${row.matchName}' (${match.id}): ${desc}`);
    if (!dryRun) {
      const updated = (await prisma.account.update({
        where: { id: match.id },
        data: patch,
        select: { id: true, name: true, code: true, type: true, subType: true, isGroup: true, isSystem: true, parentId: true },
      })) as AccountLike;
      applyStatePatch(state, updated.id, patch);
    } else {
      applyStatePatch(state, match.id, patch);
    }
  }

  const rootGroups = NEW_ACCOUNTS.filter((a) => a.parentByName === null);
  const nonRootNewAccounts = NEW_ACCOUNTS.filter((a) => a.parentByName !== null);

  for (const group of rootGroups) {
    if (state.byName.has(group.name)) {
      planSteps.push(`STAGE-3 SKIP root group '${group.name}': already exists`);
      continue;
    }
    if (state.byCode.has(group.code)) {
      const existing = state.byCode.get(group.code)!;
      planSteps.push(`STAGE-3 CONFLICT root group '${group.name}' (code ${group.code}): occupied by '${existing.name}' (${existing.id}).`);
      continue;
    }
    planSteps.push(`STAGE-3 CREATE root group '${group.name}' code ${group.code}`);
    if (!dryRun) {
      const created = (await prisma.account.create({
        data: {
          organizationId: orgId,
          code: group.code,
          name: group.name,
          type: group.type,
          subType: group.subType,
          isGroup: group.isGroup,
          isSystem: group.isSystem,
          parentId: null,
        },
        select: { id: true, name: true, code: true, type: true, subType: true, isGroup: true, isSystem: true, parentId: true },
      })) as AccountLike;
      applyStateCreate(state, created);
    } else {
      applyStateCreate(state, {
        id: `new-${group.name}-${Math.random().toString(36).slice(2, 8)}`,
        name: group.name,
        code: group.code,
        type: group.type,
        subType: group.subType,
        isGroup: group.isGroup,
        isSystem: group.isSystem,
        parentId: null,
      });
    }
  }

  for (const newAcc of nonRootNewAccounts) {
    if (state.byName.has(newAcc.name)) {
      planSteps.push(`STAGE-4 SKIP '${newAcc.name}': already exists`);
      continue;
    }
    const parent = state.byName.get(newAcc.parentByName!);
    if (!parent) {
      planSteps.push(`STAGE-4 SKIP '${newAcc.name}': missing parent '${newAcc.parentByName}'`);
      continue;
    }
    if (state.byCode.has(newAcc.code)) {
      planSteps.push(`STAGE-4 CONFLICT '${newAcc.name}' code ${newAcc.code}: used by '${state.byCode.get(newAcc.code)!.name}'.`);
      continue;
    }
    planSteps.push(`STAGE-4 CREATE '${newAcc.name}' (${newAcc.code}) parent='${parent.name}' (${parent.id})`);
    if (!dryRun) {
      const created = (await prisma.account.create({
        data: {
          organizationId: orgId,
          code: newAcc.code,
          name: newAcc.name,
          type: newAcc.type,
          subType: newAcc.subType,
          isGroup: newAcc.isGroup,
          isSystem: newAcc.isSystem,
          parentId: parent.id,
        },
        select: { id: true, name: true, code: true, type: true, subType: true, isGroup: true, isSystem: true, parentId: true },
      })) as AccountLike;
      applyStateCreate(state, created);
    } else {
      applyStateCreate(state, {
        id: `new-${newAcc.name}-${Math.random().toString(36).slice(2, 8)}`,
        name: newAcc.name,
        code: newAcc.code,
        type: newAcc.type,
        subType: newAcc.subType,
        isGroup: newAcc.isGroup,
        isSystem: newAcc.isSystem,
        parentId: parent.id,
      });
    }
  }

  for (const row of RENAME_PLAN) {
    const accountFinalName = row.newName || row.matchName;
    const acc = state.byName.get(accountFinalName) || state.byName.get(row.matchName);
    if (!acc) {
      planSteps.push(`STAGE-5 SKIP parent-assign for '${row.matchName}': not found`);
      continue;
    }
    if (!row.parentByName) continue;
    const parent = state.byName.get(row.parentByName);
    if (!parent) {
      planSteps.push(`STAGE-5 SKIP parent-assign for '${accountFinalName}': missing parent '${row.parentByName}'`);
      continue;
    }
    if (parent.id === acc.id) {
      planSteps.push(`STAGE-5 SKIP parent-assign for '${accountFinalName}': parent is self`);
      continue;
    }
    if (acc.parentId === parent.id) continue;
    planSteps.push(`STAGE-5 PARENT '${accountFinalName}' (${acc.id}) → '${parent.name}' (${parent.id})`);
    if (!dryRun) {
      const updated = (await prisma.account.update({
        where: { id: acc.id },
        data: { parentId: parent.id },
        select: { id: true, name: true, code: true, type: true, subType: true, isGroup: true, isSystem: true, parentId: true },
      })) as AccountLike;
      applyStatePatch(state, acc.id, { parentId: updated.parentId });
    } else {
      applyStatePatch(state, acc.id, { parentId: parent.id });
    }
  }

  for (const name of DELETED_ACCOUNT_NAMES) {
    const acc = state.byName.get(name);
    if (!acc) {
      planSteps.push(`STAGE-6 SKIP delete '${name}': not present`);
      continue;
    }
    const usage = await prisma.journalRow.count({ where: { accountId: acc.id } });
    if (usage > 0) {
      planSteps.push(`STAGE-6 SKIP delete '${name}' (${acc.id}): has ${usage} journal rows. Account will remain in DB but is no longer part of defaults.`);
      continue;
    }
    planSteps.push(`STAGE-6 DELETE '${name}' (${acc.id}) — no journal rows`);
    if (!dryRun) {
      await prisma.account.delete({ where: { id: acc.id } });
      applyStateDelete(state, acc.id);
    }
  }

  const settings = await prisma.companySettings.findUnique({ where: { organizationId: orgId } });
  if (settings) {
    const settingsPatch: any = {};
    const finalState = dryRun ? state : await refetchState(prisma, orgId);

    const resolveRef = (value: string | null, targetName: string): string | null => {
      if (!value) return targetName;
      const byId = finalState.byId.get(value);
      if (byId) return byId.id;
      const byNameAcc = finalState.byName.get(targetName);
      return byNameAcc ? byNameAcc.id : targetName;
    };

    for (const s of SETTINGS_MAP) {
      const currentValue = (settings as any)[s.field] as string | null;
      if (s.ifMatchesAny) {
        const matchesName = (v: string | null, candidates: (string | null)[]) =>
          candidates.some((c) => (c === null ? !v : v === c));
        const matchById = currentValue ? finalState.byId.get(currentValue) : undefined;
        const currentName = matchById ? matchById.name : currentValue;
        if (!matchesName(currentName || null, s.ifMatchesAny as any)) continue;
      }
      const resolved = resolveRef(currentValue, s.newValue);
      if ((currentValue || null) !== resolved) settingsPatch[s.field] = resolved;
    }

    if (Object.keys(settingsPatch).length === 0) {
      planSteps.push(`CompanySettings: no changes needed`);
    } else {
      planSteps.push(
        `CompanySettings update: ` +
          Object.entries(settingsPatch)
            .map(([k, v]) => `${k}=${v}`)
            .join(", "),
      );
      if (!dryRun) {
        await prisma.companySettings.update({
          where: { organizationId: orgId },
          data: settingsPatch,
        });
      }
    }
  } else {
    planSteps.push(`WARN: No CompanySettings found for org ${orgId}.`);
  }

  for (const step of planSteps) console.log(`  • ${step}`);
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = !args.includes("--apply");
  const orgIdArg = args.find((a) => !a.startsWith("--"));

  let orgIds: string[];
  if (orgIdArg) {
    orgIds = [orgIdArg];
  } else {
    const orgs = await prisma.organization.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { createdAt: "asc" },
    });
    orgIds = orgs.map((o) => o.id);
    console.log(`Found ${orgs.length} active orgs to migrate:`);
    for (const o of orgs) console.log(`  - ${o.id}  ${o.name}`);
  }

  for (const id of orgIds) {
    try {
      await migrateOrganization(id, dryRun);
    } catch (err) {
      console.error(`ERROR in org ${id}:`, err);
    }
  }

  console.log(
    dryRun
      ? "\n\nDry run complete. Run again with --apply to make changes."
      : "\n\nMigration applied. Next steps: 1) If the 'Bank' account (now code 1200, group account) previously had journal rows as a LEAF, create a child leaf bank account (e.g. 'HBL Main') and migrate those journal rows to it, because group accounts can't be posted. 2) Verify the CoA in Data Settings.",
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
