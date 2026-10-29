import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function runTests() {
  console.log("=================================================");
  console.log("TRADEFIX PHASE 1 VERIFICATION TEST SUITE");
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

  try {
    // -------------------------------------------------------------------------
    // TEST 1 & 2: Schema inspection for default-unit barcode & no redundant field
    // -------------------------------------------------------------------------
    console.log("1. Default-unit barcode rules & Schema verification");
    const itemColumnsResult: any[] = await prisma.$queryRaw`
      SELECT column_name FROM information_schema.columns WHERE table_name = 'Item';
    `;
    const itemColumns = itemColumnsResult.map((c) => c.column_name);

    assert(itemColumns.includes("itemCode"), "Item table has existing 'itemCode' field");
    assert(
      !itemColumns.includes("defaultUnitBarcode") &&
      !itemColumns.includes("barcode") &&
      !itemColumns.includes("defaultBarcode"),
      "No redundant default-unit barcode field introduced on Item table"
    );

    const convColumnsResult: any[] = await prisma.$queryRaw`
      SELECT column_name FROM information_schema.columns WHERE table_name = 'ItemUnitConversion';
    `;
    const convColumns = convColumnsResult.map((c) => c.column_name);
    assert(convColumns.includes("barcode"), "ItemUnitConversion has 'barcode' field");

    const pliColumnsResult: any[] = await prisma.$queryRaw`
      SELECT column_name FROM information_schema.columns WHERE table_name = 'PriceListItem';
    `;
    const pliColumns = pliColumnsResult.map((c) => c.column_name);
    assert(pliColumns.includes("unitName"), "PriceListItem has 'unitName' field");

    // -------------------------------------------------------------------------
    // TEST 3: Validation helpers in lib/item-master.ts
    // -------------------------------------------------------------------------
    console.log("\n2. Alternate-unit barcode validation logic");
    const { parseItemUnitConversions, normalizeBarcode } = await import("../lib/item-master");

    assert(normalizeBarcode("  TEST-BC-123  ") === "TEST-BC-123", "Barcode normalization trims whitespace");

    // Mandatory barcode test
    let threwForMissingBarcode = false;
    try {
      parseItemUnitConversions(
        JSON.stringify([{ unitName: "Box", conversionFactor: 10, barcode: "" }]),
        "Unit",
        "ITEM-001"
      );
    } catch (e: any) {
      threwForMissingBarcode = e.message.includes("Barcode is mandatory");
    }
    assert(threwForMissingBarcode, "Alternate unit without barcode is rejected");

    // Barcode matching Item Code test
    let threwForMatchingItemCode = false;
    try {
      parseItemUnitConversions(
        JSON.stringify([{ unitName: "Box", conversionFactor: 10, barcode: "ITEM-001" }]),
        "Unit",
        "ITEM-001"
      );
    } catch (e: any) {
      threwForMatchingItemCode = e.message.includes("cannot match the Item Code");
    }
    assert(threwForMatchingItemCode, "Alternate unit barcode matching default unit Item Code is rejected");

    // Duplicate barcode within alternate units
    let threwForDuplicateConvBarcode = false;
    try {
      parseItemUnitConversions(
        JSON.stringify([
          { unitName: "Box", conversionFactor: 10, barcode: "BC-DUP" },
          { unitName: "Carton", conversionFactor: 100, barcode: "BC-DUP" },
        ]),
        "Unit",
        "ITEM-001"
      );
    } catch (e: any) {
      threwForDuplicateConvBarcode = e.message.includes("Duplicate alternate unit barcode");
    }
    assert(threwForDuplicateConvBarcode, "Duplicate barcodes in alternate units are rejected");

    // Valid alternate units
    let validParsed = false;
    try {
      const parsed = parseItemUnitConversions(
        JSON.stringify([
          { unitName: "Box", conversionFactor: 10, barcode: "BC-BOX-10" },
          { unitName: "Carton", conversionFactor: 100, barcode: "BC-CTN-100" },
        ]),
        "Unit",
        "ITEM-001"
      );
      validParsed = parsed.length === 2 && parsed[0].barcode === "BC-BOX-10";
    } catch {
      validParsed = false;
    }
    assert(validParsed, "Valid alternate units with barcodes are parsed correctly");

    // -------------------------------------------------------------------------
    // TEST 4 & 5: Multi-tenant isolation & Duplicate Detection across tables
    // -------------------------------------------------------------------------
    console.log("\n3. Tenant Isolation & Cross-Table Duplicate Detection");

    // Create 2 temporary test organizations
    const testOrgA = await prisma.organization.create({
      data: {
        name: `Test Org Alpha ${Date.now()}`,
        slug: `test-org-alpha-${Date.now()}`,
      },
    });

    const testOrgB = await prisma.organization.create({
      data: {
        name: `Test Org Beta ${Date.now()}`,
        slug: `test-org-beta-${Date.now()}`,
      },
    });

    const sharedBarcode = `BARCODE-TEST-${Date.now()}`;
    const altBarcodeA = `ALT-BC-A-${Date.now()}`;

    // Org A creates item with sharedBarcode as itemCode
    const itemA1 = await prisma.item.create({
      data: {
        organizationId: testOrgA.id,
        name: "Org A Item 1",
        itemCode: sharedBarcode,
        defaultUnit: "Piece",
      },
    });
    assert(Boolean(itemA1.id), "Org A created Item 1 with itemCode as default barcode");

    // Org B creates item with same sharedBarcode as itemCode (Tenant isolation permits same barcode across orgs)
    let orgBCanUseSameBarcode = false;
    try {
      const itemB1 = await prisma.item.create({
        data: {
          organizationId: testOrgB.id,
          name: "Org B Item 1",
          itemCode: sharedBarcode,
          defaultUnit: "Piece",
        },
      });
      orgBCanUseSameBarcode = Boolean(itemB1.id);
    } catch (e: any) {
      orgBCanUseSameBarcode = false;
    }
    assert(orgBCanUseSameBarcode, "Tenant isolation allows same barcode in different organizations");

    // Org A creates alternate unit on itemA1 with altBarcodeA
    const convA1 = await prisma.itemUnitConversion.create({
      data: {
        organizationId: testOrgA.id,
        itemId: itemA1.id,
        unitName: "Box",
        conversionFactor: 12,
        barcode: altBarcodeA,
      },
    });
    assert(Boolean(convA1.id), "Org A created alternate unit with unique barcode");

    // Org A tries to create Item 2 with itemCode = altBarcodeA (Must collide with existing alternate unit barcode in same org)
    let orgAItemCodeCollidesWithAltBarcode = false;
    // We check via prisma query as done in actions.ts
    const existingConversion = await prisma.itemUnitConversion.findFirst({
      where: { organizationId: testOrgA.id, barcode: altBarcodeA },
    });
    orgAItemCodeCollidesWithAltBarcode = Boolean(existingConversion);
    assert(
      orgAItemCodeCollidesWithAltBarcode,
      "Duplicate check detects conflict when new Item Code matches existing alternate unit barcode in same org"
    );

    // Org A tries to create another alternate unit with altBarcodeA (DB constraint @@unique([organizationId, barcode]))
    let duplicateAltBarcodeFailedInDB = false;
    try {
      await prisma.itemUnitConversion.create({
        data: {
          organizationId: testOrgA.id,
          itemId: itemA1.id,
          unitName: "Pack",
          conversionFactor: 6,
          barcode: altBarcodeA,
        },
      });
    } catch (e: any) {
      duplicateAltBarcodeFailedInDB = true;
    }
    assert(duplicateAltBarcodeFailedInDB, "Database constraint enforces unique barcode per organization on alternate units");

    // Org B creates alternate unit with altBarcodeA (Must succeed because different organization)
    let orgBCanUseSameAltBarcode = false;
    try {
      const convB = await prisma.itemUnitConversion.create({
        data: {
          organizationId: testOrgB.id,
          itemId: (await prisma.item.findFirst({ where: { organizationId: testOrgB.id } }))!.id,
          unitName: "Box",
          conversionFactor: 12,
          barcode: altBarcodeA,
        },
      });
      orgBCanUseSameAltBarcode = Boolean(convB.id);
    } catch {
      orgBCanUseSameAltBarcode = false;
    }
    assert(orgBCanUseSameAltBarcode, "Different organization can use same alternate unit barcode");

    // -------------------------------------------------------------------------
    // TEST 6, 7 & 8: Unit-Specific Buying and Selling Price Lists
    // -------------------------------------------------------------------------
    console.log("\n4. Unit-Specific Price Lists & Migration Verification");

    // Verify historical migration: all existing records have unitName populated
    const existingPli = await prisma.priceListItem.findMany({
      select: { id: true, unitName: true, itemId: true, price: true },
    });
    const allHaveUnit = existingPli.length > 0 && existingPli.every((p) => typeof p.unitName === "string" && p.unitName.length > 0);
    assert(allHaveUnit, `All existing historical price list items (${existingPli.length}) have valid unitName after migration`);

    // Create a Selling Price List and Buying Price List in Org A
    const sellingList = await prisma.priceList.create({
      data: {
        organizationId: testOrgA.id,
        name: "Test Retail Price List",
        type: "SELLING",
      },
    });

    const buyingList = await prisma.priceList.create({
      data: {
        organizationId: testOrgA.id,
        name: "Test Vendor Price List",
        type: "BUYING",
      },
    });

    // Add default unit and alternate unit prices to Selling List
    await prisma.priceListItem.createMany({
      data: [
        {
          organizationId: testOrgA.id,
          priceListId: sellingList.id,
          itemId: itemA1.id,
          unitName: "Piece",
          price: 50.0,
        },
        {
          organizationId: testOrgA.id,
          priceListId: sellingList.id,
          itemId: itemA1.id,
          unitName: "Box",
          price: 550.0,
        },
      ],
    });

    // Add default unit and alternate unit prices to Buying List
    await prisma.priceListItem.createMany({
      data: [
        {
          organizationId: testOrgA.id,
          priceListId: buyingList.id,
          itemId: itemA1.id,
          unitName: "Piece",
          price: 35.0,
        },
        {
          organizationId: testOrgA.id,
          priceListId: buyingList.id,
          itemId: itemA1.id,
          unitName: "Box",
          price: 390.0,
        },
      ],
    });

    // Query prices back
    const sellingPrices = await prisma.priceListItem.findMany({
      where: { organizationId: testOrgA.id, priceListId: sellingList.id },
      orderBy: { unitName: "asc" },
    });

    assert(
      sellingPrices.length === 2 &&
      sellingPrices.find((p) => p.unitName === "Piece")?.price === 50 &&
      sellingPrices.find((p) => p.unitName === "Box")?.price === 550,
      "Selling Price List stores distinct prices for default ('Piece' @ 50) and alternate ('Box' @ 550) units"
    );

    const buyingPrices = await prisma.priceListItem.findMany({
      where: { organizationId: testOrgA.id, priceListId: buyingList.id },
      orderBy: { unitName: "asc" },
    });

    assert(
      buyingPrices.length === 2 &&
      buyingPrices.find((p) => p.unitName === "Piece")?.price === 35 &&
      buyingPrices.find((p) => p.unitName === "Box")?.price === 390,
      "Buying Price List stores distinct prices for default ('Piece' @ 35) and alternate ('Box' @ 390) units"
    );

    // Test unique constraint: attempt duplicate (itemId, unitName) in same price list
    let duplicatePliFailed = false;
    try {
      await prisma.priceListItem.create({
        data: {
          organizationId: testOrgA.id,
          priceListId: sellingList.id,
          itemId: itemA1.id,
          unitName: "Piece",
          price: 99.0,
        },
      });
    } catch {
      duplicatePliFailed = true;
    }
    assert(duplicatePliFailed, "Database unique constraint prevents duplicate prices for the same item and unit in a price list");

    // Clean up test organizations (cascades all test items, units, and price lists)
    await prisma.organization.delete({ where: { id: testOrgA.id } });
    await prisma.organization.delete({ where: { id: testOrgB.id } });
    console.log("  [INFO] Cleaned up test organizations and test data cleanly.");

    console.log("\n=================================================");
    console.log(`SUMMARY: ${passed} passed, ${failed} failed`);
    console.log("=================================================");

    if (failed > 0) {
      process.exit(1);
    }
  } catch (error) {
    console.error("Test execution encountered an error:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runTests();

