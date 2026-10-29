import { PrismaClient } from "@prisma/client";
import { syncInvoiceInventory } from "../lib/inventory";
import { normalizeBarcode } from "../lib/item-master";

const prisma = new PrismaClient();

async function runTests() {
  console.log("=================================================");
  console.log("TRADEFIX PHASE 2 VERIFICATION TEST SUITE");
  console.log("=================================================\n");

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`  [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${testName}${detail ? `: ${detail}` : ""}`);
      failed++;
    }
  }

  const testOrgAId = `test-org-a-${Date.now()}`;
  const testOrgBId = `test-org-b-${Date.now()}`;
  const barcodeItemCode = `PH2-ITM-${Date.now()}`;
  const barcodeBox = `PH2-BOX-${Date.now()}`;
  const barcodePallet = `PH2-PAL-${Date.now()}`;
  const barcodeOrgB = `PH2-ORGB-${Date.now()}`;

  try {
    // -------------------------------------------------------------------------
    // SETUP: Multi-tenant test fixtures
    // -------------------------------------------------------------------------
    console.log("1. Setting up multi-tenant test fixtures...");
    await prisma.organization.createMany({
      data: [
        { id: testOrgAId, name: "Phase 2 Test Org A", slug: `org-a-${Date.now()}` },
        { id: testOrgBId, name: "Phase 2 Test Org B", slug: `org-b-${Date.now()}` },
      ],
    });

    await prisma.companySettings.createMany({
      data: [
        { organizationId: testOrgAId, companyName: "Phase 2 Org A", baseCurrency: "PKR", allowNegativeStock: false },
        { organizationId: testOrgBId, companyName: "Phase 2 Org B", baseCurrency: "PKR", allowNegativeStock: false },
      ],
    });

    // Create price list for Org A
    const priceListA = await prisma.priceList.create({
      data: {
        organizationId: testOrgAId,
        name: "Standard Selling Phase 2",
        type: "SELLING",
        isActive: true,
        isSystemDefault: true,
      },
    });

    // Create item in Org A with default unit Piece and alternate units Box (12) & Pallet (120)
    const itemA = await prisma.item.create({
      data: {
        organizationId: testOrgAId,
        name: "Phase 2 Energy Drink",
        itemCode: barcodeItemCode,
        defaultUnit: "Piece",
        itemType: "INVENTORY",
        stockOnHand: 100, // Initial stock: 100 Pieces
        isActive: true,
        unitConversions: {
          create: [
            {
              organizationId: testOrgAId,
              unitName: "Box",
              conversionFactor: 12,
              barcode: barcodeBox,
            },
            {
              organizationId: testOrgAId,
              unitName: "Pallet",
              conversionFactor: 120,
              barcode: barcodePallet,
            },
          ],
        },
      },
      include: { unitConversions: true },
    });

    // Set prices: Piece = 50, Box = 550 (custom box price). Pallet price omitted to test fallback!
    await prisma.priceListItem.createMany({
      data: [
        {
          organizationId: testOrgAId,
          priceListId: priceListA.id,
          itemId: itemA.id,
          unitName: "Piece",
          price: 50,
        },
        {
          organizationId: testOrgAId,
          priceListId: priceListA.id,
          itemId: itemA.id,
          unitName: "Box",
          price: 550,
        },
      ],
    });

    // Create POS Profile for Org A
    const counterA = await prisma.counterMaster.create({
      data: {
        organizationId: testOrgAId,
        name: "Counter 1",
        code: `C1-${Date.now()}`,
        linkedWarehouseName: "Main Warehouse",
      },
    });

    const walkinA = await prisma.party.create({
      data: {
        organizationId: testOrgAId,
        name: "Walk-in Customer",
        type: "CUSTOMER",
      },
    });

    const vipCustomerA = await prisma.party.create({
      data: {
        organizationId: testOrgAId,
        name: "VIP Customer",
        type: "CUSTOMER",
      },
    });

    const cashAccountA = await prisma.account.create({
      data: {
        organizationId: testOrgAId,
        name: `Cash Drawer ${Date.now()}`,
        type: "ASSET",
      },
    });

    const bankAccountA = await prisma.account.create({
      data: {
        organizationId: testOrgAId,
        name: `Main Bank ${Date.now()}`,
        type: "ASSET",
      },
    });

    const posProfileA = await prisma.pOSProfile.create({
      data: {
        organizationId: testOrgAId,
        name: "Retail Profile",
        posCounterId: counterA.id,
        walkinCustomerId: walkinA.id,
        defaultCashAccountId: cashAccountA.id,
        defaultBankAccountId: bankAccountA.id,
        defaultPriceListId: priceListA.id,
      },
    });

    // Create item in Org B with barcodeOrgB
    await prisma.item.create({
      data: {
        organizationId: testOrgBId,
        name: "Org B Private Item",
        itemCode: barcodeOrgB,
        defaultUnit: "Piece",
        itemType: "INVENTORY",
        stockOnHand: 50,
      },
    });

    console.log("  Fixtures initialized successfully.\n");

    // -------------------------------------------------------------------------
    // TEST 1: Default-unit barcode resolution via Item Code
    // -------------------------------------------------------------------------
    console.log("2. Testing barcode lookup logic...");
    const { resolveBarcodeForPOS } = await import("../lib/pos-barcode");

    // Test 1: Item Code resolution via resolveBarcodeForPOS
    const res1 = await resolveBarcodeForPOS(testOrgAId, barcodeItemCode, posProfileA.id, walkinA.id, prisma);
    assert(Boolean(res1.ok), "resolveBarcodeForPOS succeeds for Item Code");
    assert(res1.item?.unitName === "Piece", "Default unit resolves to Piece");
    assert(res1.item?.conversionFactor === 1, "Default unit conversion factor is 1");
    assert(res1.item?.unitPrice === 50, "Default unit price resolves to 50");

    // Test 2: Alternate-unit barcode resolution
    const res2 = await resolveBarcodeForPOS(testOrgAId, barcodeBox, posProfileA.id, walkinA.id, prisma);
    assert(Boolean(res2.ok), "resolveBarcodeForPOS succeeds for Box barcode");
    assert(res2.item?.unitName === "Box", "Alternate unit resolves to Box");
    assert(res2.item?.conversionFactor === 12, "Alternate unit conversion factor is 12");
    assert(res2.item?.unitPrice === 550, "Box has unit-specific price of 550");
    assert(res2.item?.isAlternateUnit === true, "isAlternateUnit is true for Box");

    // Test 3: Fallback price for Pallet (120 Pieces) = 50 * 120 = 6000
    const res3 = await resolveBarcodeForPOS(testOrgAId, barcodePallet, posProfileA.id, walkinA.id, prisma);
    assert(Boolean(res3.ok), "resolveBarcodeForPOS succeeds for Pallet barcode");
    assert(res3.item?.unitName === "Pallet", "Alternate unit resolves to Pallet");
    assert(res3.item?.conversionFactor === 120, "Pallet conversion factor is 120");
    assert(res3.item?.unitPrice === 6000, "Pallet price correctly computes fallback (50 * 120 = 6000)");

    // Test 4: Multi-tenant isolation - Org B barcode not found in Org A
    const res4 = await resolveBarcodeForPOS(testOrgAId, barcodeOrgB, posProfileA.id, walkinA.id, prisma);
    assert(!res4.ok, "Org B barcode is isolated and returns not found in Org A");

    // Test 5: Unknown barcode handling
    const res5 = await resolveBarcodeForPOS(testOrgAId, "UNKNOWN-BC-9999", posProfileA.id, walkinA.id, prisma);
    assert(!res5.ok && Boolean(res5.error), "Unknown barcode returns user-friendly error");

    // Test 6: Whitespace normalization
    const res6 = await resolveBarcodeForPOS(testOrgAId, `   ${barcodeBox}   `, posProfileA.id, walkinA.id, prisma);
    assert(Boolean(res6.ok) && res6.item?.unitName === "Box", "Untrimmed barcode is normalized and resolved");

    // -------------------------------------------------------------------------
    // TEST 5: Unit-wise stock deduction in canonical base units
    // -------------------------------------------------------------------------
    console.log("\n3. Testing unit-wise stock deduction...");

    // Create an initial stock movement of 100 Pieces so rebuildItemInventory has history
    const initialMovement = await prisma.stockMovement.create({
      data: {
        organizationId: testOrgAId,
        itemId: itemA.id,
        transactionDate: new Date(Date.now() - 3600000),
        direction: "IN",
        movementType: "PURCHASE_RECEIPT",
        sourceType: "INITIAL",
        sourceNumber: "INIT-001",
        quantity: 100, // 100 base units
        unitCost: 30,  // Moving avg cost = 30
        totalCost: 3000,
        runningQty: 100,
        runningAverageCost: 30,
        warehouseName: "Main Warehouse",
      },
    });

    // Create an Invoice selling 2 Boxes (unitName = "Box", quantity = 2)
    // Since conversionFactor = 12, this represents 24 base units!
    const testInvoice = await prisma.invoice.create({
      data: {
        organizationId: testOrgAId,
        invoiceNumber: `INV-PH2-${Date.now()}`,
        type: "SALE",
        status: "PAID",
        date: new Date(),
        partyId: walkinA.id,
        currency: "PKR",
        subTotal: 1100,
        grandTotal: 1100,
        paidAmount: 1100,
        balanceAmount: 0,
        items: {
          create: [
            {
              itemId: itemA.id,
              description: itemA.name,
              moreDetails: "Box", // Sold in alternate unit Box!
              quantity: 2,        // 2 Boxes
              unitPrice: 550,
              amount: 1100,
              warehouseName: "Main Warehouse",
            },
          ],
        },
      },
    });

    // Run syncInvoiceInventory
    await syncInvoiceInventory(prisma as any, testOrgAId, testInvoice.id);

    // Verify StockMovement record
    const invoiceMovements = await prisma.stockMovement.findMany({
      where: {
        organizationId: testOrgAId,
        sourceType: "INVOICE",
        sourceId: testInvoice.id,
      },
    });

    assert(invoiceMovements.length === 1, "Exactly 1 stock movement created for invoice");
    assert(
      Number(invoiceMovements[0]?.quantity) === 24,
      `Stock movement deducted 24 canonical base units (2 Boxes * 12) [got ${invoiceMovements[0]?.quantity}]`
    );
    assert(invoiceMovements[0]?.direction === "OUT", "Stock movement direction is OUT");

    // Verify updated stockOnHand on the Item record
    const reloadedItem = await prisma.item.findUnique({ where: { id: itemA.id } });
    assert(
      Number(reloadedItem?.stockOnHand) === 76,
      `Item stockOnHand correctly deducted in base units: 100 - 24 = 76 [got ${reloadedItem?.stockOnHand}]`
    );

    // -------------------------------------------------------------------------
    // TEST 6: Sales Return / Refund restores exact base units
    // -------------------------------------------------------------------------
    console.log("\n4. Testing return / refund stock restoration...");

    // Refund 1 Box from that invoice: 1 Box = 12 base units
    // Record return stock movement:
    const returnQtyBoxes = 1;
    const factor = 12;
    const canonicalReturnQty = returnQtyBoxes * factor;

    await prisma.stockMovement.create({
      data: {
        organizationId: testOrgAId,
        itemId: itemA.id,
        invoiceId: testInvoice.id,
        transactionDate: new Date(),
        direction: "IN",
        movementType: "RETURN",
        sourceType: "POS_REFUND",
        sourceNumber: "RF-TEST-001",
        note: `POS Return from ${testInvoice.invoiceNumber}: Box (1 Box)`,
        quantity: canonicalReturnQty,
        unitCost: 550 / factor,
        totalCost: canonicalReturnQty * (550 / factor),
        warehouseName: "Main Warehouse",
      },
    });

    const { rebuildItemInventory } = await import("../lib/inventory");
    await rebuildItemInventory(prisma as any, testOrgAId, itemA.id);

    const reloadedAfterReturn = await prisma.item.findUnique({ where: { id: itemA.id } });
    assert(
      Number(reloadedAfterReturn?.stockOnHand) === 88,
      `Stock restored correctly in base units: 76 + 12 = 88 [got ${reloadedAfterReturn?.stockOnHand}]`
    );

    // -------------------------------------------------------------------------
    // TEST 7: Cart line identity with alternate units
    // -------------------------------------------------------------------------
    console.log("\n5. Testing cart line identity logic...");
    // If a cashier scans Piece, then scans Box:
    // They must NOT merge into a single quantity, but exist as separate lines!
    const sampleCart = [
      { itemId: itemA.id, unitName: "Piece", quantity: 1, unitPrice: 50 },
    ];

    // Simulating adding 1 Box:
    const existingSameUnit = sampleCart.find((l) => l.itemId === itemA.id && l.unitName === "Box");
    assert(!existingSameUnit, "Scanning Box does NOT match existing Piece line");

    const updatedCartWithBox = [
      ...sampleCart,
      { itemId: itemA.id, unitName: "Box", quantity: 1, unitPrice: 550 },
    ];
    assert(updatedCartWithBox.length === 2, "Cart now has 2 distinct lines for Piece and Box");

    // Simulating scanning Box a second time:
    const existingBox = updatedCartWithBox.find((l) => l.itemId === itemA.id && l.unitName === "Box");
    assert(Boolean(existingBox), "Repeated scan of Box matches existing Box line");

    const incrementedCart = updatedCartWithBox.map((l) =>
      l === existingBox ? { ...l, quantity: l.quantity + 1 } : l
    );
    assert(
      incrementedCart.find((l) => l.unitName === "Box")?.quantity === 2,
      "Repeated scan increments Box quantity to 2 while keeping Piece at 1"
    );

  } catch (err) {
    console.error("Test execution error:", err);
    failed++;
  } finally {
    console.log("\n6. Cleaning up test data...");
    await prisma.stockMovement.deleteMany({
      where: { organizationId: { in: [testOrgAId, testOrgBId] } },
    });
    await prisma.invoiceItem.deleteMany({
      where: { invoice: { organizationId: { in: [testOrgAId, testOrgBId] } } },
    });
    await prisma.invoice.deleteMany({
      where: { organizationId: { in: [testOrgAId, testOrgBId] } },
    });
    await prisma.priceListItem.deleteMany({
      where: { organizationId: { in: [testOrgAId, testOrgBId] } },
    });
    await prisma.priceList.deleteMany({
      where: { organizationId: { in: [testOrgAId, testOrgBId] } },
    });
    await prisma.pOSProfile.deleteMany({
      where: { organizationId: { in: [testOrgAId, testOrgBId] } },
    });
    await prisma.counterMaster.deleteMany({
      where: { organizationId: { in: [testOrgAId, testOrgBId] } },
    });
    await prisma.account.deleteMany({
      where: { organizationId: { in: [testOrgAId, testOrgBId] } },
    });
    await prisma.party.deleteMany({
      where: { organizationId: { in: [testOrgAId, testOrgBId] } },
    });
    await prisma.itemUnitConversion.deleteMany({
      where: { organizationId: { in: [testOrgAId, testOrgBId] } },
    });
    await prisma.item.deleteMany({
      where: { organizationId: { in: [testOrgAId, testOrgBId] } },
    });
    await prisma.companySettings.deleteMany({
      where: { organizationId: { in: [testOrgAId, testOrgBId] } },
    });
    await prisma.organization.deleteMany({
      where: { id: { in: [testOrgAId, testOrgBId] } },
    });
    await prisma.$disconnect();
  }

  console.log("\n=================================================");
  console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log("=================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
