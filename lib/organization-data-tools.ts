import { ensureDefaultAccountsForOrganization, seedOrganizationDefaults } from "@/lib/organization-bootstrap";
import { ensureStandardPriceLists } from "@/lib/price-lists";

type DbLike = any;

const DEMO_CUSTOMERS = [
  { name: "Alpha Traders", email: "alpha@example.com", phone: "0300-1111111", creditLimit: 500000, creditDays: 30 },
  { name: "Blue Mart", email: "blue@example.com", phone: "0300-2222222", creditLimit: 350000, creditDays: 21 },
  { name: "City Stores", email: "city@example.com", phone: "0300-3333333", creditLimit: 250000, creditDays: 14 },
] as const;

const DEMO_SUPPLIERS = [
  { name: "Prime Supplies", email: "prime@example.com", phone: "0300-4444444" },
  { name: "National Distributors", email: "national@example.com", phone: "0300-5555555" },
] as const;

const DEMO_ITEMS = [
  { name: "Premium Cement Bag", itemCode: "ITM-DEMO-001", category: "Construction", unitCost: 1150, sellingPrice: 1325, openingQty: 220 },
  { name: "Steel Rod 10mm", itemCode: "ITM-DEMO-002", category: "Construction", unitCost: 820, sellingPrice: 970, openingQty: 160 },
  { name: "Electrical Cable 90m", itemCode: "ITM-DEMO-003", category: "Electrical", unitCost: 5400, sellingPrice: 6200, openingQty: 45 },
] as const;

const DEMO_EMPLOYEES = [
  { name: "Ahmed Finance", email: "ahmed.finance@example.com", ctc: 95000 },
  { name: "Sara Collections", email: "sara.collections@example.com", ctc: 78000 },
  { name: "Usman Warehouse", email: "usman.warehouse@example.com", ctc: 68000 },
] as const;

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function formatMonthLabel(date: Date) {
  return `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function resolveInvoiceStatus(balanceAmount: number, dueDate: Date, today: Date) {
  if (balanceAmount <= 0) {
    return "PAID";
  }

  if (balanceAmount > 0 && dueDate < today) {
    return "OVERDUE";
  }

  return "SENT";
}

async function getTransactionCounts(prisma: DbLike, organizationId: string) {
  const [
    invoices,
    payments,
    journalEntries,
    stockEntries,
    stockAdjustments,
    salarySlips,
    salaryPayments,
    stockMovements,
  ] = await Promise.all([
    prisma.invoice.count({ where: { organizationId } }),
    prisma.payment.count({ where: { organizationId } }),
    prisma.journalEntry.count({ where: { organizationId } }),
    prisma.stockEntry.count({ where: { organizationId } }),
    prisma.stockAdjustment.count({ where: { organizationId } }),
    prisma.salarySlip.count({ where: { organizationId } }),
    prisma.salaryPayment.count({ where: { organizationId } }),
    prisma.stockMovement.count({ where: { organizationId } }),
  ]);

  return { invoices, payments, journalEntries, stockEntries, stockAdjustments, salarySlips, salaryPayments, stockMovements };
}

export async function clearOrganizationTransactionalData(prisma: DbLike, organizationId: string) {
  return prisma.$transaction(async (tx: DbLike) => {
    await tx.paymentPromise.deleteMany({ where: { organizationId } });
    await tx.stockMovement.deleteMany({ where: { organizationId } });
    await tx.itemBatch.deleteMany({ where: { organizationId } });

    await tx.salaryPayment.deleteMany({ where: { organizationId } });
    await tx.salarySlip.deleteMany({ where: { organizationId } });
    await tx.payment.deleteMany({ where: { organizationId } });
    await tx.invoice.deleteMany({ where: { organizationId } });
    await tx.stockAdjustment.deleteMany({ where: { organizationId } });
    await tx.stockEntry.deleteMany({ where: { organizationId } });
    await tx.journalEntry.deleteMany({ where: { organizationId } });

    await tx.item.updateMany({
      where: { organizationId },
      data: {
        stockOnHand: 0,
        movingAverageCost: 0,
      },
    });

    const settings = await tx.companySettings.findUnique({
      where: { organizationId },
      select: {
        invoiceStartNumber: true,
        purchaseInvoiceStartNumber: true,
        journalStartNumber: true,
        paymentStartNumber: true,
      },
    });

    if (settings) {
      await tx.companySettings.update({
        where: { organizationId },
        data: {
          invoiceCurrentNumber: settings.invoiceStartNumber,
          purchaseInvoiceCurrentNumber: settings.purchaseInvoiceStartNumber,
          journalCurrentNumber: settings.journalStartNumber,
          paymentCurrentNumber: settings.paymentStartNumber,
        },
      });
    }

    return getTransactionCounts(tx, organizationId);
  });
}

export async function seedOrganizationDemoData(prisma: DbLike, organizationId: string) {
  const existing = await getTransactionCounts(prisma, organizationId);
  const hasTransactions = Object.values(existing).some((count) => Number(count) > 0);
  if (hasTransactions) {
    throw new Error("This org already has transactional data. Clear transactions first, then load demo data.");
  }

  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { id: true, name: true, enabledModules: true },
  });

  if (!organization) {
    throw new Error("Organization not found.");
  }

  await seedOrganizationDefaults(prisma, {
    organizationId,
    companyName: organization.name,
    enabledModules: Array.isArray(organization.enabledModules) ? organization.enabledModules : undefined,
  });
  await ensureStandardPriceLists(organizationId);

  return prisma.$transaction(async (tx: DbLike) => {
    await ensureDefaultAccountsForOrganization(tx, organizationId, {
      firstBankAccount: { name: "Demo Bank", code: "1201" },
    });

    const cashAccount = await tx.account.findFirst({ where: { organizationId, name: "Cash in Hand" }, select: { id: true, name: true } });
    const receivableAccount = await tx.account.findFirst({ where: { organizationId, name: "Accounts Receivable" }, select: { id: true, name: true } });
    const salesAccount = await tx.account.findFirst({ where: { organizationId, name: "Sales Income" }, select: { id: true, name: true } });
    const purchaseAccount = await tx.account.findFirst({ where: { organizationId, name: "Cost of Goods Sold" }, select: { id: true, name: true } });
    const inventoryAccount = await tx.account.findFirst({ where: { organizationId, name: "Inventory" }, select: { id: true, name: true } });
    const openingStockAccount = await tx.account.findFirst({ where: { organizationId, name: "Temporary Opening" }, select: { id: true, name: true } });
    const payableAccount = await tx.account.findFirst({ where: { organizationId, name: "Accounts Payable" }, select: { id: true, name: true } });
    const salaryExpenseAccount = await tx.account.findFirst({ where: { organizationId, name: "Salary Expense" }, select: { id: true, name: true } });
    const salaryPayableAccount = await tx.account.findFirst({ where: { organizationId, name: "Salary Payable" }, select: { id: true, name: true } });

    if (
      !cashAccount ||
      !receivableAccount ||
      !salesAccount ||
      !purchaseAccount ||
      !inventoryAccount ||
      !openingStockAccount ||
      !payableAccount ||
      !salaryExpenseAccount ||
      !salaryPayableAccount
    ) {
      throw new Error("Required default accounts are missing for this org.");
    }

    const unit = await tx.itemUnit.upsert({
      where: { organizationId_name: { organizationId, name: "Unit" } },
      update: { isActive: true },
      create: { organizationId, name: "Unit", isActive: true },
    });

    for (const categoryName of Array.from(new Set(DEMO_ITEMS.map((item) => item.category)))) {
      await tx.itemCategory.upsert({
        where: { organizationId_name: { organizationId, name: categoryName } },
        update: { isActive: true },
        create: { organizationId, name: categoryName, isActive: true },
      });
    }

    await tx.inventoryWarehouse.upsert({
      where: { organizationId_name: { organizationId, name: "Main Warehouse" } },
      update: { isActive: true },
      create: { organizationId, name: "Main Warehouse", isActive: true },
    });

    const customers = [];
    for (const seed of DEMO_CUSTOMERS) {
      customers.push(
        await tx.party.upsert({
          where: { organizationId_name: { organizationId, name: seed.name } },
          update: {
            type: "CUSTOMER",
            email: seed.email,
            phone: seed.phone,
            currency: "PKR",
            creditLimit: seed.creditLimit,
            creditDays: seed.creditDays,
            isActive: true,
          },
          create: {
            organizationId,
            name: seed.name,
            type: "CUSTOMER",
            email: seed.email,
            phone: seed.phone,
            currency: "PKR",
            creditLimit: seed.creditLimit,
            creditDays: seed.creditDays,
            isActive: true,
          },
        }),
      );
    }

    for (const seed of DEMO_SUPPLIERS) {
      await tx.party.upsert({
        where: { organizationId_name: { organizationId, name: seed.name } },
        update: {
          type: "SUPPLIER",
          email: seed.email,
          phone: seed.phone,
          currency: "PKR",
          isActive: true,
        },
        create: {
          organizationId,
          name: seed.name,
          type: "SUPPLIER",
          email: seed.email,
          phone: seed.phone,
          currency: "PKR",
          isActive: true,
        },
      });
    }

    const items = [];
    for (const seed of DEMO_ITEMS) {
      items.push(
        await tx.item.upsert({
          where: { organizationId_name: { organizationId, name: seed.name } },
          update: {
            itemCode: seed.itemCode,
            category: seed.category,
            defaultUnit: unit.name,
            itemType: "INVENTORY",
            isActive: true,
            movingAverageCost: seed.unitCost,
            stockOnHand: seed.openingQty,
          },
          create: {
            organizationId,
            name: seed.name,
            itemCode: seed.itemCode,
            category: seed.category,
            defaultUnit: unit.name,
            itemType: "INVENTORY",
            isActive: true,
            movingAverageCost: seed.unitCost,
            stockOnHand: seed.openingQty,
          },
        }),
      );
    }

    const sellingPriceList = await tx.priceList.findFirst({
      where: { organizationId, name: "Standard Selling Price List" },
      select: { id: true },
    });

    if (sellingPriceList) {
      for (const seed of DEMO_ITEMS) {
        const item = items.find((entry: any) => entry.name === seed.name);
        if (!item) continue;
        const defaultUnit = item.defaultUnit || "Unit";
        await tx.priceListItem.upsert({
          where: {
            priceListId_itemId_unitName: {
              priceListId: sellingPriceList.id,
              itemId: item.id,
              unitName: defaultUnit,
            },
          },
          update: { price: seed.sellingPrice },
          create: {
            organizationId,
            priceListId: sellingPriceList.id,
            itemId: item.id,
            unitName: defaultUnit,
            price: seed.sellingPrice,
          },
        });
      }
    }

    const openingDate = new Date();
    openingDate.setMonth(openingDate.getMonth() - 12);
    openingDate.setDate(1);

    const stockJournal = await tx.journalEntry.create({
      data: {
        organizationId,
        entryNumber: "JRN-DEMO-OPENING",
        date: openingDate,
        description: "Demo opening stock",
        currency: "PKR",
        exchangeRate: 1,
        rows: {
          create: [
            {
              organizationId,
              accountId: inventoryAccount.id,
              debit: DEMO_ITEMS.reduce((sum, item) => sum + item.unitCost * item.openingQty, 0),
              credit: 0,
              foreignDebit: DEMO_ITEMS.reduce((sum, item) => sum + item.unitCost * item.openingQty, 0),
              foreignCredit: 0,
              description: "Opening stock",
            },
            {
              organizationId,
              accountId: openingStockAccount.id,
              debit: 0,
              credit: DEMO_ITEMS.reduce((sum, item) => sum + item.unitCost * item.openingQty, 0),
              foreignDebit: 0,
              foreignCredit: DEMO_ITEMS.reduce((sum, item) => sum + item.unitCost * item.openingQty, 0),
              description: "Opening stock equity",
            },
          ],
        },
      },
    });

    const stockEntry = await tx.stockEntry.create({
      data: {
        organizationId,
        entryNumber: "STK-DEMO-OPENING",
        entryType: "OPENING",
        date: openingDate,
        note: "Demo opening stock",
        journalEntryId: stockJournal.id,
      },
    });

    for (const seed of DEMO_ITEMS) {
      const item = items.find((entry: any) => entry.name === seed.name);
      if (!item) continue;

      await tx.stockEntryItem.create({
        data: {
          organizationId,
          stockEntryId: stockEntry.id,
          itemId: item.id,
          warehouseName: "Main Warehouse",
          quantity: seed.openingQty,
          unitCost: seed.unitCost,
        },
      });

      await tx.itemBatch.create({
        data: {
          organizationId,
          itemId: item.id,
          sourceType: "STOCK_ENTRY",
          sourceId: stockEntry.id,
          sourceNumber: stockEntry.entryNumber,
          batchNumber: `BATCH-${seed.itemCode}`,
          warehouseName: "Main Warehouse",
          receivedDate: openingDate,
          originalQty: seed.openingQty,
          availableQty: seed.openingQty,
          unitCost: seed.unitCost,
          isActive: true,
        },
      });

      await tx.stockMovement.create({
        data: {
          organizationId,
          itemId: item.id,
          transactionDate: openingDate,
          direction: "IN",
          movementType: "OPENING",
          sourceType: "STOCK_ENTRY",
          sourceId: stockEntry.id,
          sourceNumber: stockEntry.entryNumber,
          quantity: seed.openingQty,
          unitCost: seed.unitCost,
          totalCost: seed.unitCost * seed.openingQty,
          runningQty: seed.openingQty,
          runningAverageCost: seed.unitCost,
          batchNumber: `BATCH-${seed.itemCode}`,
          warehouseName: "Main Warehouse",
          note: "Demo opening stock",
        },
      });
    }

    for (const seed of DEMO_EMPLOYEES) {
      const existingEmployee = await tx.employee.findFirst({
        where: { organizationId, email: seed.email },
        select: { id: true },
      });

      if (existingEmployee) {
        await tx.employee.update({
          where: { id: existingEmployee.id },
          data: {
            name: seed.name,
            ctc: seed.ctc,
            status: "ACTIVE",
          },
        });
      } else {
        await tx.employee.create({
          data: {
            organizationId,
            name: seed.name,
            email: seed.email,
            ctc: seed.ctc,
            status: "ACTIVE",
          },
        });
      }
    }

    const employees = await tx.employee.findMany({
      where: { organizationId, email: { in: DEMO_EMPLOYEES.map((item) => item.email) } },
      select: { id: true, name: true, ctc: true },
    });

    const salaryMonth = new Date();
    salaryMonth.setMonth(salaryMonth.getMonth() - 1);
    const salarySlipDate = startOfMonth(salaryMonth);

    let salaryIndex = 1;
    for (const employee of employees.slice(0, 2)) {
      const payableAmount = employee.ctc;
      const salaryJournal = await tx.journalEntry.create({
        data: {
          organizationId,
          entryNumber: `JRN-DEMO-SAL-${salaryIndex}`,
          date: salarySlipDate,
          description: `Demo salary accrual - ${employee.name}`,
          currency: "PKR",
          exchangeRate: 1,
          rows: {
            create: [
              {
                organizationId,
                accountId: salaryExpenseAccount.id,
                debit: payableAmount,
                credit: 0,
                foreignDebit: payableAmount,
                foreignCredit: 0,
                description: `Salary expense - ${employee.name}`,
              },
              {
                organizationId,
                accountId: salaryPayableAccount.id,
                debit: 0,
                credit: payableAmount,
                foreignDebit: 0,
                foreignCredit: payableAmount,
                description: `Salary payable - ${employee.name}`,
              },
            ],
          },
        },
      });

      const slip = await tx.salarySlip.create({
        data: {
          organizationId,
          employeeId: employee.id,
          month: salarySlipDate.getMonth() + 1,
          year: salarySlipDate.getFullYear(),
          ctcAmount: employee.ctc,
          payableAmount,
          finalPayableAmount: payableAmount,
          status: "POSTED",
          journalEntryId: salaryJournal.id,
        },
      });

      const paymentDate = new Date(salarySlipDate);
      paymentDate.setDate(28);

      const salaryPaymentJournal = await tx.journalEntry.create({
        data: {
          organizationId,
          entryNumber: `JRN-DEMO-SPAY-${salaryIndex}`,
          date: paymentDate,
          description: `Demo salary payment - ${employee.name}`,
          currency: "PKR",
          exchangeRate: 1,
          rows: {
            create: [
              {
                organizationId,
                accountId: salaryPayableAccount.id,
                debit: payableAmount,
                credit: 0,
                foreignDebit: payableAmount,
                foreignCredit: 0,
                description: `Salary payable cleared - ${employee.name}`,
              },
              {
                organizationId,
                accountId: cashAccount.id,
                debit: 0,
                credit: payableAmount,
                foreignDebit: 0,
                foreignCredit: payableAmount,
                description: `Cash salary payment - ${employee.name}`,
              },
            ],
          },
        },
      });

      await tx.salaryPayment.create({
        data: {
          organizationId,
          paymentNumber: `SALPAY-DEMO-${salaryIndex}`,
          employeeId: employee.id,
          date: paymentDate,
          amount: payableAmount,
          status: "POSTED",
          paymentMethod: "BANK",
          reference: slip.id,
          fromAccountId: cashAccount.id,
          journalEntryId: salaryPaymentJournal.id,
        },
      });

      salaryIndex += 1;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dueOffsets = [14, 10, 7, 5, 3, 2, 1, -1, -2, -3, 6, 9];
    let paymentIndex = 1;
    let payIndex = 1;

    for (let monthIndex = 0; monthIndex < 12; monthIndex += 1) {
      const monthDate = startOfMonth(new Date(today.getFullYear(), today.getMonth() - (11 - monthIndex), 1));
      const customer = customers[monthIndex % customers.length];
      const item = items[monthIndex % items.length];
      const quantity = 8 + monthIndex;
      const unitPrice = DEMO_ITEMS[monthIndex % DEMO_ITEMS.length].sellingPrice;
      const subTotal = quantity * unitPrice;
      const paidAmount = monthIndex >= 9 ? subTotal * 0.72 : monthIndex >= 6 ? subTotal * 0.45 : 0;
      const balanceAmount = subTotal - paidAmount;
      const dueDate = new Date(monthDate);
      dueDate.setDate(dueOffsets[monthIndex] > 0 ? dueOffsets[monthIndex] : 1);
      if (dueOffsets[monthIndex] < 0) {
        dueDate.setMonth(today.getMonth());
        dueDate.setFullYear(today.getFullYear());
        dueDate.setDate(today.getDate() + dueOffsets[monthIndex]);
      }
      dueDate.setHours(0, 0, 0, 0);

      const invoiceStatus =
        paidAmount > 0 && balanceAmount > 0
          ? dueDate < today
            ? "OVERDUE"
            : "PARTIALLY_PAID"
          : resolveInvoiceStatus(balanceAmount, dueDate, today);

      const invoiceJournal = await tx.journalEntry.create({
        data: {
          organizationId,
          entryNumber: `JRN-DEMO-SALE-${formatMonthLabel(monthDate)}`,
          date: monthDate,
          description: `Demo sales invoice - ${customer.name}`,
          currency: "PKR",
          exchangeRate: 1,
          rows: {
            create: [
              {
                organizationId,
                accountId: receivableAccount.id,
                debit: subTotal,
                credit: 0,
                foreignDebit: subTotal,
                foreignCredit: 0,
                description: `Invoice receivable - ${customer.name}`,
              },
              {
                organizationId,
                accountId: salesAccount.id,
                debit: 0,
                credit: subTotal,
                foreignDebit: 0,
                foreignCredit: subTotal,
                description: `Sales income - ${customer.name}`,
              },
            ],
          },
        },
      });

      const invoice = await tx.invoice.create({
        data: {
          organizationId,
          invoiceNumber: `INV-DEMO-${formatMonthLabel(monthDate)}`,
          type: "SALE",
          status: invoiceStatus,
          date: monthDate,
          dueDate,
          partyId: customer.id,
          currency: "PKR",
          exchangeRate: 1,
          subTotal,
          discountTotal: 0,
          grandTotal: subTotal,
          baseGrandTotal: subTotal,
          paidAmount,
          balanceAmount,
          journalEntryId: invoiceJournal.id,
          notes: "Demo invoice",
          items: {
            create: [
              {
                description: item.name,
                quantity,
                unitPrice,
                discount: 0,
                amount: subTotal,
                itemId: item.id,
                warehouseName: "Main Warehouse",
              },
            ],
          },
        },
      });

      if (balanceAmount > 0) {
        await tx.paymentPromise.create({
          data: {
            organizationId,
            invoiceId: invoice.id,
            promisedDate: dueDate,
            promisedAmount: Math.round(balanceAmount),
            remarks: "Demo follow-up promise",
            status: "ACTIVE",
          },
        });
      }

      if (paidAmount > 0) {
        const paymentDate = new Date(monthDate);
        paymentDate.setDate(Math.min(25, 8 + monthIndex));

        const paymentJournal = await tx.journalEntry.create({
          data: {
            organizationId,
            entryNumber: `JRN-DEMO-PAY-${formatMonthLabel(monthDate)}`,
            date: paymentDate,
            description: `Demo receipt - ${customer.name}`,
            currency: "PKR",
            exchangeRate: 1,
            rows: {
              create: [
                {
                  organizationId,
                  accountId: cashAccount.id,
                  debit: paidAmount,
                  credit: 0,
                  foreignDebit: paidAmount,
                  foreignCredit: 0,
                  description: `Cash received - ${customer.name}`,
                },
                {
                  organizationId,
                  accountId: receivableAccount.id,
                  debit: 0,
                  credit: paidAmount,
                  foreignDebit: 0,
                  foreignCredit: paidAmount,
                  description: `Receivable settled - ${customer.name}`,
                },
              ],
            },
          },
        });

        await tx.payment.create({
          data: {
            organizationId,
            paymentNumber: `PAY-DEMO-${String(paymentIndex).padStart(3, "0")}`,
            date: paymentDate,
            type: "RECEIVE",
            method: "BANK",
            partyId: customer.id,
            amount: paidAmount,
            currency: "PKR",
            exchangeRate: 1,
            invoiceId: invoice.id,
            journalEntryId: paymentJournal.id,
            notes: "Demo customer receipt",
          },
        });

        paymentIndex += 1;
      }
    }

    const suppliers = await tx.party.findMany({
      where: { organizationId, type: { in: ["SUPPLIER", "BOTH"] } },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
      take: 2,
    });

    for (let monthIndex = 0; monthIndex < 3; monthIndex += 1) {
      const supplier = suppliers[monthIndex % suppliers.length];
      const item = items[(monthIndex + 1) % items.length];
      const quantity = 18 + monthIndex * 6;
      const unitPrice = DEMO_ITEMS[(monthIndex + 1) % DEMO_ITEMS.length].unitCost;
      const totalAmount = quantity * unitPrice;
      const paidAmount = monthIndex === 0 ? totalAmount : monthIndex === 1 ? totalAmount * 0.55 : 0;
      const balanceAmount = totalAmount - paidAmount;
      const invoiceDate = startOfMonth(new Date(today.getFullYear(), today.getMonth() - monthIndex, 1));
      const dueDate = new Date(invoiceDate);
      dueDate.setDate(monthIndex === 2 ? today.getDate() - 4 : 12 + monthIndex * 3);
      dueDate.setHours(0, 0, 0, 0);

      const purchaseStatus =
        paidAmount > 0 && balanceAmount > 0
          ? dueDate < today
            ? "OVERDUE"
            : "PARTIALLY_PAID"
          : resolveInvoiceStatus(balanceAmount, dueDate, today);

      const purchaseJournal = await tx.journalEntry.create({
        data: {
          organizationId,
          entryNumber: `JRN-DEMO-PINV-${String(monthIndex + 1).padStart(3, "0")}`,
          date: invoiceDate,
          description: `Demo purchase invoice - ${supplier.name}`,
          currency: "PKR",
          exchangeRate: 1,
          rows: {
            create: [
              {
                organizationId,
                accountId: purchaseAccount.id,
                debit: totalAmount,
                credit: 0,
                foreignDebit: totalAmount,
                foreignCredit: 0,
                description: `Purchase expense - ${supplier.name}`,
              },
              {
                organizationId,
                accountId: payableAccount.id,
                debit: 0,
                credit: totalAmount,
                foreignDebit: 0,
                foreignCredit: totalAmount,
                description: `Accounts payable - ${supplier.name}`,
              },
            ],
          },
        },
      });

      const purchaseInvoice = await tx.invoice.create({
        data: {
          organizationId,
          invoiceNumber: `PINV-DEMO-${String(monthIndex + 1).padStart(3, "0")}`,
          type: "PURCHASE",
          status: purchaseStatus,
          date: invoiceDate,
          dueDate,
          partyId: supplier.id,
          currency: "PKR",
          exchangeRate: 1,
          subTotal: totalAmount,
          discountTotal: 0,
          grandTotal: totalAmount,
          baseGrandTotal: totalAmount,
          paidAmount,
          balanceAmount,
          journalEntryId: purchaseJournal.id,
          notes: "Demo purchase invoice",
          items: {
            create: [
              {
                description: item.name,
                quantity,
                unitPrice,
                discount: 0,
                amount: totalAmount,
                itemId: item.id,
                warehouseName: "Main Warehouse",
              },
            ],
          },
        },
      });

      if (paidAmount > 0) {
        const paymentDate = new Date(invoiceDate);
        paymentDate.setDate(18 + monthIndex);

        const payJournal = await tx.journalEntry.create({
          data: {
            organizationId,
            entryNumber: `JRN-DEMO-PAYOUT-${String(payIndex).padStart(3, "0")}`,
            date: paymentDate,
            description: `Demo supplier payment - ${supplier.name}`,
            currency: "PKR",
            exchangeRate: 1,
            rows: {
              create: [
                {
                  organizationId,
                  accountId: payableAccount.id,
                  debit: paidAmount,
                  credit: 0,
                  foreignDebit: paidAmount,
                  foreignCredit: 0,
                  description: `Payable settled - ${supplier.name}`,
                },
                {
                  organizationId,
                  accountId: cashAccount.id,
                  debit: 0,
                  credit: paidAmount,
                  foreignDebit: 0,
                  foreignCredit: paidAmount,
                  description: `Cash paid - ${supplier.name}`,
                },
              ],
            },
          },
        });

        await tx.payment.create({
          data: {
            organizationId,
            paymentNumber: `PAY-DEMO-OUT-${String(payIndex).padStart(3, "0")}`,
            date: paymentDate,
            type: "PAY",
            method: "BANK",
            partyId: supplier.id,
            amount: paidAmount,
            currency: "PKR",
            exchangeRate: 1,
            invoiceId: purchaseInvoice.id,
            journalEntryId: payJournal.id,
            notes: "Demo supplier payment",
          },
        });

        payIndex += 1;
      }
    }

    const manualJournalDate = new Date(today.getFullYear(), today.getMonth(), 5);
    await tx.journalEntry.create({
      data: {
        organizationId,
        entryNumber: "JRN-DEMO-MANUAL-001",
        date: manualJournalDate,
        description: "Demo month-end expense accrual",
        currency: "PKR",
        exchangeRate: 1,
        rows: {
          create: [
            {
              organizationId,
              accountId: salaryExpenseAccount.id,
              debit: 18000,
              credit: 0,
              foreignDebit: 18000,
              foreignCredit: 0,
              description: "Demo admin expense",
            },
            {
              organizationId,
              accountId: cashAccount.id,
              debit: 0,
              credit: 18000,
              foreignDebit: 0,
              foreignCredit: 18000,
              description: "Demo admin expense payment",
            },
          ],
        },
      },
    });

    return getTransactionCounts(tx, organizationId);
  });
}
