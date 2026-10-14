import { getNextJournalSequence } from "@/app/(dashboard)/journal/numbering";

type InventoryTx = any;

type JournalRowInput = {
  accountId: string;
  debit: number;
  credit: number;
  foreignDebit?: number;
  foreignCredit?: number;
  description?: string | null;
};

function normalizeNumber(value: unknown) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export { createSequencedJournalEntry, getCompanySettings };
export type { JournalRowInput, InventoryTx };

async function getCompanySettings(tx: InventoryTx, organizationId: string) {
  const settings = await tx.companySettings.findFirst({
    where: { organizationId },
    select: {
      id: true,
      companyName: true,
      baseCurrency: true,
      journalPrefix: true,
      journalStartNumber: true,
      journalCurrentNumber: true,
      defaultSalesAccount: true,
      defaultReceivableAccount: true,
      defaultPayableAccount: true,
      defaultInventoryAssetAccount: true,
      defaultCogsAccount: true,
      defaultStockAdjustmentGainAccount: true,
      defaultStockAdjustmentLossAccount: true,
      defaultOpeningStockAccount: true,
      defaultPurchaseAccount: true,
    },
  });

  if (!settings) {
    throw new Error("Company Settings not found");
  }

  return settings;
}

async function resolvePostingAccount(
  tx: InventoryTx,
  organizationId: string,
  value: string | null | undefined,
  label: string,
) {
  if (!value) {
    throw new Error(`${label} is not configured in settings.`);
  }

  const account = await tx.account.findFirst({
    where: {
      organizationId,
      OR: [{ id: value }, { name: value }],
    },
    select: {
      id: true,
      name: true,
      isGroup: true,
    },
  });

  if (!account) {
    throw new Error(`${label} not found: ${value}`);
  }

  if (account.isGroup) {
    throw new Error(`${label} "${account.name}" is a group account.`);
  }

  return account;
}

async function createSequencedJournalEntry(
  tx: InventoryTx,
  organizationId: string,
  input: {
    date: Date;
    description: string;
    reference?: string | null;
    currency?: string | null;
    exchangeRate?: number | null;
    rows: JournalRowInput[];
    linkData?: Record<string, unknown>;
  },
) {
  const settings = await getCompanySettings(tx, organizationId);
  const prefix = settings.journalPrefix || "JRN-";
  const existingEntries = await tx.journalEntry.findMany({
    where: {
      organizationId,
      entryNumber: {
        startsWith: prefix,
      },
    },
    select: {
      entryNumber: true,
    },
  });

  const { entryNumber, nextNumber } = getNextJournalSequence(
    settings,
    existingEntries.map((entry: { entryNumber: string }) => entry.entryNumber),
  );

  const journalEntry = await tx.journalEntry.create({
    data: {
      entryNumber,
      organizationId,
      date: input.date,
      description: input.description,
      reference: input.reference || null,
      currency: input.currency || settings.baseCurrency || "PKR",
      exchangeRate: input.exchangeRate ?? 1,
      ...(input.linkData || {}),
      rows: {
        create: input.rows.map((row) => ({
          organizationId,
          accountId: row.accountId,
          debit: normalizeNumber(row.debit),
          credit: normalizeNumber(row.credit),
          foreignDebit: normalizeNumber(row.foreignDebit ?? row.debit),
          foreignCredit: normalizeNumber(row.foreignCredit ?? row.credit),
          description: row.description || null,
        })),
      },
    },
  });

  await tx.companySettings.update({
    where: { id: settings.id },
    data: { journalCurrentNumber: nextNumber + 1 },
  });

  return journalEntry;
}

async function deleteLinkedJournal(
  tx: InventoryTx,
  input:
    | { model: "invoice"; recordId: string; field: "journalEntryId" | "inventoryJournalEntryId"; journalEntryId: string | null | undefined }
    | { model: "stockEntry"; recordId: string; field: "journalEntryId"; journalEntryId: string | null | undefined }
    | { model: "stockAdjustment"; recordId: string; field: "journalEntryId"; journalEntryId: string | null | undefined },
) {
  if (!input.journalEntryId) {
    return;
  }

  await tx[input.model].update({
    where: { id: input.recordId },
    data: { [input.field]: null },
  });

  await tx.journalEntry.delete({
    where: { id: input.journalEntryId },
  });
}

export async function syncStockEntryAccounting(tx: InventoryTx, organizationId: string, stockEntryId: string) {
  const stockEntry = await tx.stockEntry.findFirst({
    where: { id: stockEntryId, organizationId },
    include: {
      items: {
        select: {
          quantity: true,
          unitCost: true,
        },
      },
    },
  });

  if (!stockEntry) {
    throw new Error("Stock entry not found");
  }

  const totalValue = stockEntry.items.reduce(
    (sum: number, line: { quantity: number; unitCost: number }) =>
      sum + normalizeNumber(line.quantity) * normalizeNumber(line.unitCost),
    0,
  );

  await deleteLinkedJournal(tx, {
    model: "stockEntry",
    recordId: stockEntry.id,
    field: "journalEntryId",
    journalEntryId: stockEntry.journalEntryId,
  });

  if (totalValue <= 0) {
    return;
  }

  const settings = await getCompanySettings(tx, organizationId);
  const inventoryAssetAccount = await resolvePostingAccount(
    tx,
    organizationId,
    settings.defaultInventoryAssetAccount,
    "Default Inventory Asset Account",
  );
  const offsetAccount = await resolvePostingAccount(
    tx,
    organizationId,
    stockEntry.entryType === "OPENING" ? settings.defaultOpeningStockAccount : settings.defaultPurchaseAccount,
    stockEntry.entryType === "OPENING" ? "Default Opening Stock Account" : "Default Purchase Account",
  );

  await createSequencedJournalEntry(tx, organizationId, {
    date: stockEntry.date,
    description:
      stockEntry.entryType === "OPENING"
        ? `Opening stock entry ${stockEntry.entryNumber}`
        : `Stock receipt ${stockEntry.entryNumber}`,
    reference: stockEntry.entryNumber,
    currency: settings.baseCurrency,
    exchangeRate: 1,
    linkData: {
      stockEntry: {
        connect: { id: stockEntry.id },
      },
    },
    rows: [
      {
        accountId: inventoryAssetAccount.id,
        debit: totalValue,
        credit: 0,
        description: `Inventory value for ${stockEntry.entryNumber}`,
      },
      {
        accountId: offsetAccount.id,
        debit: 0,
        credit: totalValue,
        description:
          stockEntry.entryType === "OPENING"
            ? `Opening stock offset for ${stockEntry.entryNumber}`
            : `Stock receipt offset for ${stockEntry.entryNumber}`,
      },
    ],
  });
}

export async function syncStockAdjustmentAccounting(tx: InventoryTx, organizationId: string, stockAdjustmentId: string) {
  const stockAdjustment = await tx.stockAdjustment.findFirst({
    where: { id: stockAdjustmentId, organizationId },
    select: {
      id: true,
      adjustmentNumber: true,
      adjustmentType: true,
      date: true,
      journalEntryId: true,
    },
  });

  if (!stockAdjustment) {
    throw new Error("Stock adjustment not found");
  }

  const movements = await tx.stockMovement.findMany({
    where: {
      organizationId,
      sourceType: "STOCK_ADJUSTMENT",
      sourceId: stockAdjustment.id,
    },
    select: {
      totalCost: true,
    },
  });

  const totalValue = movements.reduce(
    (sum: number, movement: { totalCost: number }) => sum + normalizeNumber(movement.totalCost),
    0,
  );

  await deleteLinkedJournal(tx, {
    model: "stockAdjustment",
    recordId: stockAdjustment.id,
    field: "journalEntryId",
    journalEntryId: stockAdjustment.journalEntryId,
  });

  if (totalValue <= 0) {
    return;
  }

  const settings = await getCompanySettings(tx, organizationId);
  const inventoryAssetAccount = await resolvePostingAccount(
    tx,
    organizationId,
    settings.defaultInventoryAssetAccount,
    "Default Inventory Asset Account",
  );
  const offsetAccount = await resolvePostingAccount(
    tx,
    organizationId,
    stockAdjustment.adjustmentType === "IN"
      ? settings.defaultStockAdjustmentGainAccount
      : settings.defaultStockAdjustmentLossAccount,
    stockAdjustment.adjustmentType === "IN"
      ? "Default Stock Gain Account"
      : "Default Stock Loss Account",
  );

  const isIncrease = stockAdjustment.adjustmentType === "IN";
  await createSequencedJournalEntry(tx, organizationId, {
    date: stockAdjustment.date,
    description: `Stock adjustment ${stockAdjustment.adjustmentNumber}`,
    reference: stockAdjustment.adjustmentNumber,
    currency: settings.baseCurrency,
    exchangeRate: 1,
    linkData: {
      stockAdjustment: {
        connect: { id: stockAdjustment.id },
      },
    },
    rows: isIncrease
      ? [
          {
            accountId: inventoryAssetAccount.id,
            debit: totalValue,
            credit: 0,
            description: `Inventory increase for ${stockAdjustment.adjustmentNumber}`,
          },
          {
            accountId: offsetAccount.id,
            debit: 0,
            credit: totalValue,
            description: `Stock gain for ${stockAdjustment.adjustmentNumber}`,
          },
        ]
      : [
          {
            accountId: offsetAccount.id,
            debit: totalValue,
            credit: 0,
            description: `Stock loss for ${stockAdjustment.adjustmentNumber}`,
          },
          {
            accountId: inventoryAssetAccount.id,
            debit: 0,
            credit: totalValue,
            description: `Inventory decrease for ${stockAdjustment.adjustmentNumber}`,
          },
        ],
  });
}

export async function syncInvoiceCommercialJournal(tx: InventoryTx, organizationId: string, invoiceId: string) {
  const invoice = await tx.invoice.findFirst({
    where: { id: invoiceId, organizationId },
    select: {
      id: true,
      invoiceNumber: true,
      type: true,
      status: true,
      date: true,
      currency: true,
      exchangeRate: true,
      grandTotal: true,
      baseGrandTotal: true,
      journalEntryId: true,
    },
  });

  if (!invoice) {
    throw new Error("Invoice not found");
  }

  const settings = await getCompanySettings(tx, organizationId);
  const shouldPost =
    ["SENT", "PAID", "PARTIALLY_PAID", "OVERDUE"].includes(String(invoice.status || "").toUpperCase());

  await deleteLinkedJournal(tx, {
    model: "invoice",
    recordId: invoice.id,
    field: "journalEntryId",
    journalEntryId: invoice.journalEntryId,
  });

  if (!shouldPost) {
    return;
  }

  let debitAccountId: string | null = null;
  let creditAccountId: string | null = null;

  if (invoice.type === "SALE") {
    const arAccount = await resolvePostingAccount(
      tx,
      organizationId,
      settings.defaultReceivableAccount,
      "Default Receivable Account",
    );
    const salesAccount = await resolvePostingAccount(
      tx,
      organizationId,
      settings.defaultSalesAccount,
      "Default Sales Account",
    );
    debitAccountId = arAccount.id;
    creditAccountId = salesAccount.id;
  } else if (invoice.type === "PURCHASE") {
    const purchaseAccount = await resolvePostingAccount(
      tx,
      organizationId,
      settings.defaultPurchaseAccount,
      "Default Purchase Account",
    );
    const payableAccount = await resolvePostingAccount(
      tx,
      organizationId,
      settings.defaultPayableAccount,
      "Default Payable Account",
    );
    debitAccountId = purchaseAccount.id;
    creditAccountId = payableAccount.id;
  }

  if (!debitAccountId || !creditAccountId) {
    return;
  }

  await createSequencedJournalEntry(tx, organizationId, {
    date: invoice.date,
    description: `Invoice #${invoice.invoiceNumber}`,
    reference: invoice.invoiceNumber,
    currency: invoice.currency,
    exchangeRate: invoice.exchangeRate,
    linkData: {
      invoice: {
        connect: { id: invoice.id },
      },
    },
    rows: [
      {
        accountId: debitAccountId,
        debit: normalizeNumber(invoice.baseGrandTotal),
        credit: 0,
        foreignDebit: normalizeNumber(invoice.grandTotal),
        foreignCredit: 0,
        description: `Debit for ${invoice.invoiceNumber}`,
      },
      {
        accountId: creditAccountId,
        debit: 0,
        credit: normalizeNumber(invoice.baseGrandTotal),
        foreignDebit: 0,
        foreignCredit: normalizeNumber(invoice.grandTotal),
        description: `Credit for ${invoice.invoiceNumber}`,
      },
    ],
  });
}

export async function syncInvoiceInventoryAccounting(tx: InventoryTx, organizationId: string, invoiceId: string) {
  const invoice = await tx.invoice.findFirst({
    where: { id: invoiceId, organizationId },
    select: {
      id: true,
      invoiceNumber: true,
      type: true,
      status: true,
      date: true,
      inventoryJournalEntryId: true,
    },
  });

  if (!invoice) {
    throw new Error("Invoice not found");
  }

  await deleteLinkedJournal(tx, {
    model: "invoice",
    recordId: invoice.id,
    field: "inventoryJournalEntryId",
    journalEntryId: invoice.inventoryJournalEntryId,
  });

  const shouldPost =
    ["SENT", "PAID", "PARTIALLY_PAID", "OVERDUE"].includes(String(invoice.status || "").toUpperCase());

  if (!shouldPost) {
    return;
  }

  const movements = await tx.stockMovement.findMany({
    where: {
      organizationId,
      sourceType: "INVOICE",
      sourceId: invoice.id,
    },
    select: {
      totalCost: true,
    },
  });

  const totalValue = movements.reduce(
    (sum: number, movement: { totalCost: number }) => sum + normalizeNumber(movement.totalCost),
    0,
  );

  if (totalValue <= 0) {
    return;
  }

  const settings = await getCompanySettings(tx, organizationId);
  const inventoryAssetAccount = await resolvePostingAccount(
    tx,
    organizationId,
    settings.defaultInventoryAssetAccount,
    "Default Inventory Asset Account",
  );

  const offsetAccount =
    invoice.type === "SALE"
      ? await resolvePostingAccount(tx, organizationId, settings.defaultCogsAccount, "Default COGS Account")
      : await resolvePostingAccount(tx, organizationId, settings.defaultPurchaseAccount, "Default Purchase Account");

  const isSale = invoice.type === "SALE";
  await createSequencedJournalEntry(tx, organizationId, {
    date: invoice.date,
    description: isSale
      ? `Inventory issue for invoice ${invoice.invoiceNumber}`
      : `Inventory capitalization for invoice ${invoice.invoiceNumber}`,
    reference: invoice.invoiceNumber,
    currency: settings.baseCurrency,
    exchangeRate: 1,
    linkData: {
      inventoryInvoice: {
        connect: { id: invoice.id },
      },
    },
    rows: isSale
      ? [
          {
            accountId: offsetAccount.id,
            debit: totalValue,
            credit: 0,
            description: `COGS for ${invoice.invoiceNumber}`,
          },
          {
            accountId: inventoryAssetAccount.id,
            debit: 0,
            credit: totalValue,
            description: `Inventory relief for ${invoice.invoiceNumber}`,
          },
        ]
      : [
          {
            accountId: inventoryAssetAccount.id,
            debit: totalValue,
            credit: 0,
            description: `Inventory received for ${invoice.invoiceNumber}`,
          },
          {
            accountId: offsetAccount.id,
            debit: 0,
            credit: totalValue,
            description: `Purchase offset for ${invoice.invoiceNumber}`,
          },
        ],
  });
}
