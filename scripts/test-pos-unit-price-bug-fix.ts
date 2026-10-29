import { PrismaClient } from "@prisma/client";
import { getPOSListingItems, resolveBarcodeForPOS } from "../lib/pos-barcode";

const prisma = new PrismaClient();

async function runTests() {
  console.log("=================================================");
  console.log("TEST SUITE: POS COUNTER UNIT PRICE BUG FIX");
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
  const ledItemCode = `LED-CODE-${Date.now()}`;
  const ledBoxBarcode = `LED-BOX-${Date.now()}`;
  const solarItemCode = `SOLAR-CODE-${Date.now()}`;
  const solarPalletBarcode = `SOLAR-PAL-${Date.now()}`;

  try {
    // -------------------------------------------------------------------------
    // SETUP: Multi-tenant test fixtures
    // -------------------------------------------------------------------------
    console.log("1. Setting up test fixtures for POS Unit Price Bug...");
    await prisma.organization.createMany({
      data: [
        { id: testOrgAId, name: "Bugfix Test Org A", slug: `org-a-${Date.now()}` },
        { id: testOrgBId, name: "Bugfix Test Org B", slug: `org-b-${Date.now()}` },
      ],
    });

    await prisma.companySettings.createMany({
      data: [
        { organizationId: testOrgAId, companyName: "Bugfix Org A", baseCurrency: "PKR", allowNegativeStock: false },
        { organizationId: testOrgBId, companyName: "Bugfix Org B", baseCurrency: "PKR", allowNegativeStock: false },
      ],
    });

    // 1. Standard Price List in Org A
    const standardPriceList = await prisma.priceList.create({
      data: {
        organizationId: testOrgAId,
        name: "Standard Retail Price List",
        type: "SELLING",
        isActive: true,
        isSystemDefault: true,
      },
    });

    // 2. VIP Price List in Org A
    const vipPriceList = await prisma.priceList.create({
      data: {
        organizationId: testOrgAId,
        name: "VIP Wholesale Price List",
        type: "SELLING",
        isActive: true,
      },
    });

    // 3. Item 1: LED Bulb (Default Unit: Piece, Alternate Unit: Box (10))
    const ledBulb = await prisma.item.create({
      data: {
        organizationId: testOrgAId,
        name: "LED Bulb 12W",
        itemCode: ledItemCode,
        defaultUnit: "Piece",
        itemType: "INVENTORY",
        stockOnHand: 150,
        isActive: true,
        unitConversions: {
          create: [
            {
              organizationId: testOrgAId,
              unitName: "Box",
              conversionFactor: 10,
              barcode: ledBoxBarcode,
            },
          ],
        },
      },
    });

    // Prices for LED Bulb:
    // Standard: Piece = 200, Box = 2000
    // Note: We deliberately insert Box first, then Piece, to ensure iteration order cannot corrupt default unit price!
    await prisma.priceListItem.create({
      data: {
        organizationId: testOrgAId,
        priceListId: standardPriceList.id,
        itemId: ledBulb.id,
        unitName: "Box",
        price: 2000,
      },
    });
    await prisma.priceListItem.create({
      data: {
        organizationId: testOrgAId,
        priceListId: standardPriceList.id,
        itemId: ledBulb.id,
        unitName: "Piece",
        price: 200,
      },
    });

    // VIP Prices: Piece = 180, Box = 1800
    await prisma.priceListItem.createMany({
      data: [
        {
          organizationId: testOrgAId,
          priceListId: vipPriceList.id,
          itemId: ledBulb.id,
          unitName: "Box",
          price: 1800,
        },
        {
          organizationId: testOrgAId,
          priceListId: vipPriceList.id,
          itemId: ledBulb.id,
          unitName: "Piece",
          price: 180,
        },
      ],
    });

    // 4. Item 2: Solar Panel with MISSING default-unit price (only alternate unit Pallet has price)
    const solarPanel = await prisma.item.create({
      data: {
        organizationId: testOrgAId,
        name: "Solar Panel 400W",
        itemCode: solarItemCode,
        defaultUnit: "Piece",
        itemType: "INVENTORY",
        stockOnHand: 50,
        isActive: true,
        unitConversions: {
          create: [
            {
              organizationId: testOrgAId,
              unitName: "Pallet",
              conversionFactor: 25,
              barcode: solarPalletBarcode,
            },
          ],
        },
      },
    });

    // Only create Pallet price in standardPriceList (NO Piece price!)
    await prisma.priceListItem.create({
      data: {
        organizationId: testOrgAId,
        priceListId: standardPriceList.id,
        itemId: solarPanel.id,
        unitName: "Pallet",
        price: 50000,
      },
    });

    // POS Profile & Customers
    const counterA = await prisma.counterMaster.create({
      data: {
        organizationId: testOrgAId,
        name: "Counter Main",
        code: `CTR-${Date.now()}`,
      },
    });

    const walkinCustomer = await prisma.party.create({
      data: {
        organizationId: testOrgAId,
        name: "Walk-in Customer",
        type: "CUSTOMER",
      },
    });

    const vipCustomer = await prisma.party.create({
      data: {
        organizationId: testOrgAId,
        name: "VIP Wholesale Customer",
        type: "CUSTOMER",
        sellingPriceListId: vipPriceList.id,
      },
    });

    const cashAccountA = await prisma.account.create({
      data: {
        organizationId: testOrgAId,
        name: `Cash ${Date.now()}`,
        type: "ASSET",
      },
    });

    const bankAccountA = await prisma.account.create({
      data: {
        organizationId: testOrgAId,
        name: `Bank ${Date.now()}`,
        type: "ASSET",
      },
    });

    const posProfileA = await prisma.pOSProfile.create({
      data: {
        organizationId: testOrgAId,
        name: "Main POS Profile",
        posCounterId: counterA.id,
        walkinCustomerId: walkinCustomer.id,
        defaultCashAccountId: cashAccountA.id,
        defaultBankAccountId: bankAccountA.id,
        defaultPriceListId: standardPriceList.id,
      },
    });

    // Item in Org B (for tenant isolation check)
    await prisma.item.create({
      data: {
        organizationId: testOrgBId,
        name: "Org B Private Item",
        itemCode: "ORGB-PRIVATE",
        defaultUnit: "Piece",
        itemType: "INVENTORY",
        stockOnHand: 10,
      },
    });

    console.log("  Fixtures initialized successfully.\n");

    // -------------------------------------------------------------------------
    // TEST 1: POS Product Listing must display DEFAULT-UNIT price (Rs. 200, NOT Rs. 2000)
    // -------------------------------------------------------------------------
    console.log("2. Verifying POS Counter Product Listing Prices...");
    const standardListing = await getPOSListingItems(
      testOrgAId,
      {
        posProfileId: posProfileA.id,
        customerId: walkinCustomer.id,
      },
      prisma
    );

    const ledInStandard = standardListing.find((it: any) => it.id === ledBulb.id);
    assert(Boolean(ledInStandard), "LED Bulb appears in POS product listing");
    assert(ledInStandard?.unitName === "Piece", "Listing displays item's default unit: Piece");
    assert(
      ledInStandard?.unitPrice === 200,
      `Listing displays default-unit price of Rs. 200 (NOT alternate-unit price of Rs. 2000) [got Rs. ${ledInStandard?.unitPrice}]`
    );

    // -------------------------------------------------------------------------
    // TEST 2: Missing default-unit price behavior
    // -------------------------------------------------------------------------
    console.log("\n3. Verifying missing default-unit price behavior...");
    const solarInStandard = standardListing.find((it: any) => it.id === solarPanel.id);
    assert(Boolean(solarInStandard), "Solar Panel appears in POS product listing");
    assert(solarInStandard?.unitName === "Piece", "Solar Panel displays default unit: Piece");
    assert(
      solarInStandard?.unitPrice === 0,
      `Item with missing default-unit price displays Rs. 0 (does NOT silently substitute Pallet price of Rs. 50,000) [got Rs. ${solarInStandard?.unitPrice}]`
    );

    // -------------------------------------------------------------------------
    // TEST 3: Customer-specific pricing in POS product listing
    // -------------------------------------------------------------------------
    console.log("\n4. Verifying customer-specific pricing in POS product listing...");
    const vipListing = await getPOSListingItems(
      testOrgAId,
      {
        posProfileId: posProfileA.id,
        customerId: vipCustomer.id,
      },
      prisma
    );

    const ledInVip = vipListing.find((it: any) => it.id === ledBulb.id);
    assert(Boolean(ledInVip), "LED Bulb appears in VIP listing");
    assert(
      ledInVip?.unitPrice === 180,
      `VIP listing displays customer-specific default-unit price of Rs. 180 [got Rs. ${ledInVip?.unitPrice}]`
    );

    // -------------------------------------------------------------------------
    // TEST 4: Barcode scanning remains unit-aware
    // -------------------------------------------------------------------------
    console.log("\n5. Verifying barcode scanning unit-awareness...");
    // 4a: Scanning default unit Item Code -> Piece at Rs. 200
    const scanDefault = await resolveBarcodeForPOS(
      testOrgAId,
      ledItemCode,
      posProfileA.id,
      walkinCustomer.id,
      prisma
    );
    assert(Boolean(scanDefault.ok), "Scanning default Item Code succeeds");
    assert(scanDefault.item?.unitName === "Piece", "Scanned default unit is Piece");
    assert(scanDefault.item?.conversionFactor === 1, "Scanned default unit conversion factor is 1");
    assert(
      scanDefault.item?.unitPrice === 200,
      `Scanned default unit resolves to default-unit price of Rs. 200 [got Rs. ${scanDefault.item?.unitPrice}]`
    );
    assert(scanDefault.item?.isAlternateUnit === false, "isAlternateUnit is false for default Item Code");

    // 4b: Scanning alternate unit barcode -> Box at Rs. 2000
    const scanBox = await resolveBarcodeForPOS(
      testOrgAId,
      ledBoxBarcode,
      posProfileA.id,
      walkinCustomer.id,
      prisma
    );
    assert(Boolean(scanBox.ok), "Scanning alternate Box barcode succeeds");
    assert(scanBox.item?.unitName === "Box", "Scanned alternate unit is Box");
    assert(scanBox.item?.conversionFactor === 10, "Scanned alternate unit conversion factor is 10");
    assert(
      scanBox.item?.unitPrice === 2000,
      `Scanned alternate unit resolves to its own Box price of Rs. 2000 [got Rs. ${scanBox.item?.unitPrice}]`
    );
    assert(scanBox.item?.isAlternateUnit === true, "isAlternateUnit is true for alternate unit barcode");

    // 4c: Scanning with VIP customer selected
    const scanVipDefault = await resolveBarcodeForPOS(
      testOrgAId,
      ledItemCode,
      posProfileA.id,
      vipCustomer.id,
      prisma
    );
    assert(
      scanVipDefault.item?.unitPrice === 180,
      `Scanning default unit for VIP customer resolves to VIP price of Rs. 180 [got Rs. ${scanVipDefault.item?.unitPrice}]`
    );

    const scanVipBox = await resolveBarcodeForPOS(
      testOrgAId,
      ledBoxBarcode,
      posProfileA.id,
      vipCustomer.id,
      prisma
    );
    assert(
      scanVipBox.item?.unitPrice === 1800,
      `Scanning Box for VIP customer resolves to VIP Box price of Rs. 1800 [got Rs. ${scanVipBox.item?.unitPrice}]`
    );

    // -------------------------------------------------------------------------
    // TEST 5: Tenant isolation
    // -------------------------------------------------------------------------
    console.log("\n6. Verifying organization isolation...");
    const orgBListing = await getPOSListingItems(
      testOrgAId,
      {
        posProfileId: posProfileA.id,
        query: "ORGB-PRIVATE",
      },
      prisma
    );
    assert(orgBListing.length === 0, "Org B private items are never returned in Org A POS listing");

    const scanCrossOrg = await resolveBarcodeForPOS(
      testOrgAId,
      "ORGB-PRIVATE",
      posProfileA.id,
      walkinCustomer.id,
      prisma
    );
    assert(!scanCrossOrg.ok, "Scanning Org B item barcode in Org A returns not found");

  } catch (err) {
    console.error("Test execution error:", err);
    failed++;
  } finally {
    console.log("\n7. Cleaning up test data...");
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

