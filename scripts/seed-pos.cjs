"use strict";
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const POS_PERMISSIONS = [
  { key: "pos.access", label: "POS: Open POS module", group: "POS", order: 10 },
  { key: "pos.counter.open", label: "POS: Open register / start shift", group: "POS", order: 20 },
  { key: "pos.profile.manage", label: "POS: Manage POS profiles and counters", group: "POS", order: 30 },
  { key: "pos.sale.create", label: "POS: Add items to cart", group: "POS", order: 40 },
  { key: "pos.sale.saveOrder", label: "POS: Save order / hold", group: "POS", order: 50 },
  { key: "pos.sale.checkout", label: "POS: Complete checkout", group: "POS", order: 60 },
  { key: "pos.sale.discount", label: "POS: Apply discount", group: "POS", order: 70 },
  { key: "pos.sale.discountOverride", label: "POS: Bypass max discount (supervisor)", group: "POS", order: 80 },
  { key: "pos.sale.priceOverride", label: "POS: Change line unit price", group: "POS", order: 90 },
  { key: "pos.sale.voidLine", label: "POS: Remove cart line", group: "POS", order: 100 },
  { key: "pos.sale.clearCart", label: "POS: Clear cart", group: "POS", order: 110 },
  { key: "pos.sale.creditCheckout", label: "POS: Sell on credit", group: "POS", order: 120 },
  { key: "pos.customer.quickCreate", label: "POS: Add new customer inline", group: "POS", order: 130 },
  { key: "pos.shift.openSelf", label: "POS: Open own cashier shift", group: "POS", order: 140 },
  { key: "pos.shift.closeSelf", label: "POS: Close own shift", group: "POS", order: 150 },
  { key: "pos.shift.reconcile", label: "POS: Reconcile shifts (supervisor)", group: "POS", order: 160 },
  { key: "pos.shift.viewAll", label: "POS: View all shifts", group: "POS", order: 170 },
  { key: "pos.refund.do", label: "POS: Cancel / refund bill", group: "POS", order: 180 },
  { key: "pos.report.xReport", label: "POS: X report (mid shift)", group: "POS", order: 190 },
  { key: "pos.report.zReport", label: "POS: Z report (end of day)", group: "POS", order: 200 },
  { key: "pos.report.counterSales", label: "POS: Counter-wise sales report", group: "POS", order: 210 },
];

const CASHIER_ALLOWED_KEYS = [
  "dashboard.access",
  "pos.access",
  "pos.counter.open",
  "pos.sale.create",
  "pos.sale.saveOrder",
  "pos.sale.checkout",
  "pos.sale.discount",
  "pos.sale.voidLine",
  "pos.sale.clearCart",
  "pos.shift.openSelf",
  "pos.shift.closeSelf",
  "pos.report.xReport",
  "customers.access",
  "customers.list",
  "invoices.access",
  "invoices.list",
  "invoices.action.view",
  "payments.access",
  "payments.list",
  "inventory.access",
  "inventory.batches.view",
  "reports.access",
];

const SUPERVISOR_ALLOWED_KEYS_EXTRA = [
  "pos.profile.manage",
  "pos.sale.discountOverride",
  "pos.sale.priceOverride",
  "pos.sale.creditCheckout",
  "pos.customer.quickCreate",
  "pos.shift.reconcile",
  "pos.shift.viewAll",
  "pos.refund.do",
  "pos.report.zReport",
  "pos.report.counterSales",
];

const DEFAULT_ENABLED_MODULES = ["customers", "invoices", "payments", "inventory", "journal", "reports", "hr", "pos"];

async function upsertRoleWithPermissions(prisma, roleSeed, organizationId, allPerms) {
  const role = await prisma.role.upsert({
    where: { organizationId_name: { organizationId, name: roleSeed.name } },
    update: { isSystem: roleSeed.isSystem },
    create: { organizationId, name: roleSeed.name, isSystem: roleSeed.isSystem },
  });
  const allowed = new Set(roleSeed.allowedKeys);
  const toLink = allPerms.filter((p) => allowed.has(p.key));
  for (const p of toLink) {
    await prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: { roleId: role.id, permissionId: p.id },
      },
      update: {},
      create: { roleId: role.id, permissionId: p.id },
    });
  }
  return role;
}

async function main() {
  console.log("Seeding POS module into existing orgs...");
  for (const p of POS_PERMISSIONS) {
    await prisma.permission.upsert({
      where: { key: p.key },
      update: { label: p.label, group: p.group, order: p.order },
      create: { key: p.key, label: p.label, group: p.group, order: p.order },
    });
  }
  console.log("Permissions OK");

  const orgs = await prisma.organization.findMany({
    select: { id: true, name: true, enabledModules: true },
  });

  const allPerms = await prisma.permission.findMany({ select: { id: true, key: true } });

  for (const org of orgs) {
    let modules = Array.isArray(org.enabledModules) ? org.enabledModules.slice() : [];
    for (const m of DEFAULT_ENABLED_MODULES) {
      if (!modules.includes(m)) modules.push(m);
    }
    modules = modules.filter((m) => DEFAULT_ENABLED_MODULES.includes(m));
    await prisma.organization.update({ where: { id: org.id }, data: { enabledModules: modules } });
    console.log(`Org ${org.name}: enabledModules = [${modules.join(", ")}]`);

    await upsertRoleWithPermissions(
      prisma,
      { name: "cashier", isSystem: true, allowedKeys: CASHIER_ALLOWED_KEYS },
      org.id,
      allPerms,
    );
    await upsertRoleWithPermissions(
      prisma,
      {
        name: "supervisor",
        isSystem: true,
        allowedKeys: CASHIER_ALLOWED_KEYS.concat(SUPERVISOR_ALLOWED_KEYS_EXTRA),
      },
      org.id,
      allPerms,
    );
    console.log(`Org ${org.name}: cashier + supervisor roles OK`);

    const settings = await prisma.companySettings.findUnique({ where: { organizationId: org.id } });
    if (settings) {
      const csUpdate = {};
      if (!settings.posInvoicePrefix) csUpdate.posInvoicePrefix = "POS-";
      if (settings.posCurrentNumber == null) csUpdate.posCurrentNumber = 1;
      if (settings.quickAmountRounding == null) csUpdate.quickAmountRounding = 50;
      if (!settings.defaultCurrencyNotes) {
        csUpdate.defaultCurrencyNotes = [5000, 1000, 500, 100, 50, 20, 10, 5, 1];
      }
      if (settings.silentPrintEnabled == null) csUpdate.silentPrintEnabled = true;
      if (Object.keys(csUpdate).length > 0) {
        await prisma.companySettings.update({ where: { organizationId: org.id }, data: csUpdate });
        console.log(`Org ${org.name}: CompanySettings defaults OK`);
      }
    }

    const warehouseName = "Default Warehouse";
    try {
      await prisma.inventoryWarehouse.upsert({
        where: { organizationId_name: { organizationId: org.id, name: warehouseName } },
        update: { isActive: true },
        create: { organizationId: org.id, name: warehouseName, isActive: true },
      });
    } catch (e) {
      console.warn("warehouse upsert:", e.message);
    }

    const counterName = "Counter-1";
    const counter = await prisma.counterMaster.upsert({
      where: { organizationId_name: { organizationId: org.id, name: counterName } },
      update: { isActive: true, linkedWarehouseName: warehouseName },
      create: {
        organizationId: org.id,
        name: counterName,
        code: "CT-001",
        isActive: true,
        linkedWarehouseName: warehouseName,
      },
    });

    const walkinCustomerName = "Walk-in Customer";
    const walkinCustomer = await prisma.party.upsert({
      where: { organizationId_name: { organizationId: org.id, name: walkinCustomerName } },
      update: { type: "CUSTOMER", isActive: true, creditLimit: 0 },
      create: {
        organizationId: org.id,
        name: walkinCustomerName,
        type: "CUSTOMER",
        currency: "PKR",
        creditLimit: 0,
        creditDays: 0,
        creditStatus: "ACTIVE",
        allowCreditOverride: false,
        isActive: true,
      },
    });

    const accounts = await prisma.account.findMany({
      where: { organizationId: org.id, isGroup: false },
      select: { id: true, name: true, subType: true, type: true },
    });
    const cashLeaf =
      accounts.find((a) => a.name === "Cash in Hand") ||
      accounts.find((a) => a.subType === "Cash") ||
      accounts.find((a) => a.type === "ASSET" && /cash/i.test(a.name));
    const bankLeaf =
      accounts.find((a) => a.subType === "Bank") ||
      accounts.find((a) => a.type === "ASSET" && /bank/i.test(a.name)) ||
      cashLeaf;

    if (cashLeaf && bankLeaf) {
      const profileName = "Default POS Profile";
      await prisma.pOSProfile.upsert({
        where: { organizationId_name: { organizationId: org.id, name: profileName } },
        update: {
          isActive: true,
          walkinCustomerId: walkinCustomer.id,
          posCounterId: counter.id,
          defaultPaymentMethod: "CASH",
          defaultCashAccountId: cashLeaf.id,
          defaultBankAccountId: bankLeaf.id,
        },
        create: {
          organizationId: org.id,
          name: profileName,
          code: "POS-DEFAULT",
          isActive: true,
          walkinCustomerId: walkinCustomer.id,
          posCounterId: counter.id,
          defaultPaymentMethod: "CASH",
          defaultCashAccountId: cashLeaf.id,
          defaultBankAccountId: bankLeaf.id,
          allowCreditCheckout: false,
          allowPriceOverride: false,
          allowDiscount: true,
          maxDiscountPct: 5,
          requireCustomerForCredit: true,
          customerQuickCreate: true,
          hideOutOfStockItems: true,
        },
      });
    }

    console.log(
      `Org ${org.name}: Counter=${counter.name} Walk-in=${walkinCustomer.name} CashLeaf=${cashLeaf?.name} BankLeaf=${bankLeaf?.name}`,
    );
  }

  console.log("Done.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
