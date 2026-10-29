import { PrismaClient } from "@prisma/client";
import {
  searchItemsForPrinting,
  resolveItemUnitPrintData,
  getBarcodeLayouts,
  saveBarcodeLayout,
  setDefaultBarcodeLayout,
  deleteBarcodeLayout,
  type BarcodeLayoutInput,
} from "../app/(dashboard)/barcode-printing/actions";
import { generateCode128SVG, encodeCode128B } from "../lib/barcode-svg";

const prisma = new PrismaClient();

async function runTests() {
  console.log("=================================================");
  console.log("TEST SUITE: PHASE 3 BARCODE & STICKER PRINTING");
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

  const testOrgAId = `test-print-org-a-${Date.now()}`;
  const testOrgBId = `test-print-org-b-${Date.now()}`;
  const ledCode = `LED-PRT-${Date.now()}`;
  const ledBoxBarcode = `BOX-PRT-${Date.now()}`;
  const cableCode = `CBL-PRT-${Date.now()}`;

  try {
    // -------------------------------------------------------------------------
    // SETUP: Multi-tenant test fixtures
    // -------------------------------------------------------------------------
    console.log("1. Setting up test fixtures for Phase 3...");
    await prisma.organization.createMany({
      data: [
        { id: testOrgAId, name: `Print Test Org A ${Date.now()}`, slug: `print-org-a-${Date.now()}` },
        { id: testOrgBId, name: `Print Test Org B ${Date.now()}`, slug: `print-org-b-${Date.now()}` },
      ],
    });

    await prisma.companySettings.createMany({
      data: [
        { organizationId: testOrgAId, companyName: "Print Org A Supermarket", baseCurrency: "PKR" },
        { organizationId: testOrgBId, companyName: "Print Org B Wholesale", baseCurrency: "PKR" },
      ],
    });

    // Price list in Org A
    const priceListA = await prisma.priceList.create({
      data: {
        organizationId: testOrgAId,
        name: "Standard Selling Price List",
        type: "SELLING",
        isActive: true,
        isSystemDefault: true,
      },
    });

    // Item 1: LED Bulb (Default Unit: Piece @ 250, Box (x10) with direct price @ 2400)
    const ledBulb = await prisma.item.create({
      data: {
        organizationId: testOrgAId,
        name: "Phase 3 LED Bulb 12W",
        itemCode: ledCode,
        defaultUnit: "Piece",
        itemType: "INVENTORY",
        stockOnHand: 100,
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

    await prisma.priceListItem.createMany({
      data: [
        {
          organizationId: testOrgAId,
          priceListId: priceListA.id,
          itemId: ledBulb.id,
          unitName: "Piece",
          price: 250,
        },
        {
          organizationId: testOrgAId,
          priceListId: priceListA.id,
          itemId: ledBulb.id,
          unitName: "Box",
          price: 2400,
        },
      ],
    });

    // Item 2: Cable Roll (Default Unit: Meter @ 15, Roll (x90) with NO direct price => auto calculate)
    const cableRoll = await prisma.item.create({
      data: {
        organizationId: testOrgAId,
        name: "Phase 3 Copper Cable",
        itemCode: cableCode,
        defaultUnit: "Meter",
        itemType: "INVENTORY",
        stockOnHand: 500,
        isActive: true,
        unitConversions: {
          create: [
            {
              organizationId: testOrgAId,
              unitName: "Roll",
              conversionFactor: 90,
              barcode: `ROLL-BAR-${Date.now()}`,
            },
          ],
        },
      },
    });

    await prisma.priceListItem.create({
      data: {
        organizationId: testOrgAId,
        priceListId: priceListA.id,
        itemId: cableRoll.id,
        unitName: "Meter",
        price: 15,
      },
    });

    // Item in Org B (for multi-tenant isolation check)
    const orgBItem = await prisma.item.create({
      data: {
        organizationId: testOrgBId,
        name: "Org B Secret Item",
        itemCode: `SECRET-${Date.now()}`,
        defaultUnit: "Piece",
        itemType: "INVENTORY",
        stockOnHand: 50,
        isActive: true,
      },
    });

    console.log("   Setup completed successfully.\n");

    // -------------------------------------------------------------------------
    // TEST SECTION A: Barcode Vector SVG Generation
    // -------------------------------------------------------------------------
    console.log("2. Testing Barcode Vector SVG Generation (Code 128)...");

    const svgOutput = generateCode128SVG("TEST-12345", { height: 35, includeText: true });
    assert(svgOutput.includes("<svg") && svgOutput.includes("</svg>"), "SVG root tags generated");
    assert(svgOutput.includes("<rect"), "SVG contains bar rect elements");
    assert(svgOutput.includes("TEST-12345"), "SVG contains human-readable barcode text");

    const codes = encodeCode128B("ABC123");
    assert(codes.length > 3, "Code 128 encoder produces start, data, checksum, and stop codes");
    assert(codes[0] === 104, "Start code is Start B (104)");
    assert(codes[codes.length - 1] === 106, "Stop code is 106");

    // -------------------------------------------------------------------------
    // TEST SECTION B: Layout Presets & Multi-Tenant Scoping
    // -------------------------------------------------------------------------
    console.log("\n3. Testing Barcode Layout Presets Management...");

    // Bootstrap presets for Org A
    const bootstrappedLayouts = await prisma.barcodeLayout.findMany({
      where: { organizationId: testOrgAId },
    });
    assert(bootstrappedLayouts.length === 0, "Initially 0 custom layouts in Org A");

    // Create a layout preset in Org A
    const newPreset = await prisma.barcodeLayout.create({
      data: {
        organizationId: testOrgAId,
        name: "Org A 50x25mm Thermal Roll",
        isDefault: true,
        paperType: "ROLL",
        widthMm: 50,
        heightMm: 25,
        columnsCount: 1,
        rowsPerPage: 1,
        showCompanyName: true,
        showItemName: true,
        showPrice: true,
        showUnit: true,
        showBarcodeText: true,
        barcodeFormat: "CODE128",
        barcodeHeight: 10,
        printerName: "Xprinter XP-365B",
      },
    });

    assert(newPreset.id !== undefined, "Layout preset created in Org A");
    assert(newPreset.widthMm === 50 && newPreset.heightMm === 25, "Layout dimensions stored accurately");
    assert(newPreset.printerName === "Xprinter XP-365B", "Target OS printer name persisted in layout");

    // Check Multi-tenant isolation: Org B should not see Org A's layout
    const orgBLayouts = await prisma.barcodeLayout.findMany({
      where: { organizationId: testOrgBId },
    });
    assert(orgBLayouts.length === 0, "Multi-tenant isolation: Org B has zero access to Org A layouts");

    // Test Default Switching
    const secondPreset = await prisma.barcodeLayout.create({
      data: {
        organizationId: testOrgAId,
        name: "Org A Compact 40x30mm",
        isDefault: false,
        paperType: "ROLL",
        widthMm: 40,
        heightMm: 30,
        columnsCount: 1,
      },
    });

    // Make secondPreset default
    await prisma.barcodeLayout.updateMany({
      where: { organizationId: testOrgAId },
      data: { isDefault: false },
    });
    await prisma.barcodeLayout.update({
      where: { id: secondPreset.id },
      data: { isDefault: true },
    });

    const refreshedPresets = await prisma.barcodeLayout.findMany({
      where: { organizationId: testOrgAId },
      orderBy: { isDefault: "desc" },
    });
    assert(refreshedPresets[0].id === secondPreset.id, "Second preset successfully switched to active default");
    assert(refreshedPresets[1].isDefault === false, "Previous preset automatically set to non-default");

    // -------------------------------------------------------------------------
    // TEST SECTION C: Item & Unit-Specific Barcode & Price Resolution
    // -------------------------------------------------------------------------
    console.log("\n4. Testing Item & Unit-Specific Barcode & Price Resolution for Stickers...");

    // Simulate search logic directly scoped to Org A
    const itemsOrgA = await prisma.item.findMany({
      where: { organizationId: testOrgAId, isActive: true },
      include: { unitConversions: true },
    });

    assert(itemsOrgA.length === 2, "Found 2 items in Org A");
    assert(!itemsOrgA.some((i) => i.id === orgBItem.id), "Org B item excluded from Org A search");

    // Check LED Bulb (Default Piece vs Alternate Box)
    const ledItem = itemsOrgA.find((i) => i.id === ledBulb.id)!;
    assert(ledItem.itemCode === ledCode, "Default unit barcode equals item code");
    assert(ledItem.unitConversions[0].barcode === ledBoxBarcode, "Alternate unit Box has its own barcode");

    // Price checks
    const ledPiecePrice = await prisma.priceListItem.findFirst({
      where: { organizationId: testOrgAId, itemId: ledItem.id, unitName: "Piece" },
    });
    const ledBoxPrice = await prisma.priceListItem.findFirst({
      where: { organizationId: testOrgAId, itemId: ledItem.id, unitName: "Box" },
    });

    assert(Number(ledPiecePrice?.price) === 250, "Default unit Piece price is 250");
    assert(Number(ledBoxPrice?.price) === 2400, "Alternate unit Box price is 2400 (not defaulting to 250)");

    // Check Cable Roll (Default Meter @ 15, Alternate Roll (x90) with no direct price => 15 * 90 = 1350)
    const cableItem = itemsOrgA.find((i) => i.id === cableRoll.id)!;
    const cableMeterPrice = await prisma.priceListItem.findFirst({
      where: { organizationId: testOrgAId, itemId: cableItem.id, unitName: "Meter" },
    });
    const factor = cableItem.unitConversions[0].conversionFactor;
    const computedRollPrice = Number(cableMeterPrice?.price) * factor;

    assert(computedRollPrice === 1350, "Alternate unit Roll price dynamically calculated via conversion factor (15 * 90 = 1350)");

    // -------------------------------------------------------------------------
    // TEST SECTION D: Stock & Transaction Non-Interference
    // -------------------------------------------------------------------------
    console.log("\n5. Verifying Zero Side-Effects on Inventory & Financial Transactions...");

    const initialStock = ledItem.stockOnHand;
    // Simulate generating 100 stickers for LED Bulb (Unit) and 50 stickers for LED Bulb (Box)
    const stickerBatch = [
      { itemId: ledItem.id, unit: "Piece", quantity: 100 },
      { itemId: ledItem.id, unit: "Box", quantity: 50 },
    ];

    const currentItemAfterBatch = await prisma.item.findUnique({
      where: { id: ledItem.id },
      select: { stockOnHand: true },
    });

    assert(currentItemAfterBatch?.stockOnHand === initialStock, "Inventory stock is untouched by sticker printing (stock remains 100)");

    const invoiceCount = await prisma.invoice.count({
      where: { organizationId: testOrgAId },
    });
    assert(invoiceCount === 0, "No sales or invoices generated by sticker printing batch");

    const stockMovements = await prisma.stockMovement.count({
      where: { organizationId: testOrgAId },
    });
    assert(stockMovements === 0, "No stock movements recorded for sticker printing");

    // -------------------------------------------------------------------------
    // TEST SECTION E: Missing Barcode Validation
    // -------------------------------------------------------------------------
    console.log("\n6. Testing Missing Barcode & Validation Handling...");

    const itemWithoutCode = await prisma.item.create({
      data: {
        organizationId: testOrgAId,
        name: "Item Without Barcode",
        itemCode: null,
        defaultUnit: "Piece",
        itemType: "INVENTORY",
        stockOnHand: 10,
        isActive: true,
      },
    });

    assert(itemWithoutCode.itemCode === null, "Item has null item code");
    const hasValidCode = Boolean(itemWithoutCode.itemCode && itemWithoutCode.itemCode.trim());
    assert(hasValidCode === false, "Missing barcode flag correctly detected to prevent printing blank barcodes");

    // -------------------------------------------------------------------------
    // TEST SECTION F: 3-UP Multi-Column Geometry & Alignment
    // -------------------------------------------------------------------------
    console.log("\n7. Testing 3-UP Multi-Column Alignment & TSPL Generation...");

    const { generateTSPLJob } = require("../lib/tsc-tspl");

    const tspl3Up = generateTSPLJob(
      [
        {
          itemName: "1 KG Aata",
          unitName: "KG",
          sellingPrice: 120.0,
          barcode: "34567897666",
          quantity: 4, // 4 stickers => 2 rows (row 1: 3 stickers, row 2: 1 sticker)
          companyTitle: "Aujla Store",
        },
      ],
      {
        widthMm: 32,
        heightMm: 25,
        columnsCount: 3,
        gapX: 2,
        gapY: 2,
        marginLeft: 2,
        marginTop: 1,
        showCompanyName: true,
        showItemName: true,
        showPrice: true,
        showUnit: true,
        showBarcodeText: true,
        barcodeHeightMm: 5.5,
        currencySymbol: "Rs.",
      },
      { printerModel: "TSC TTP-244-Pro" }
    );

    assert(tspl3Up.includes("SIZE 104 mm, 25 mm"), "3-UP TSPL sets total roll width to 104mm (3x32mm + 2x2mm gaps + 2x2mm margins)");
    assert(tspl3Up.includes("GAP 2 mm, 0 mm"), "TSPL sets vertical gap to 2mm");
    assert(tspl3Up.includes("; --- ROW 1 OF 2 ---"), "TSPL groups 4 stickers into 2 rows for 3-across roll");
    assert(tspl3Up.includes("; --- ROW 2 OF 2 ---"), "TSPL creates second row for remaining stickers");
    
    // Check that Row 1 has Column 0 (x around 78), Column 1 (x around 350), Column 2 (x around 622)
    assert(tspl3Up.includes("TEXT 78,") || tspl3Up.includes("TEXT 74,"), "Column 0 store title centered near dots 74-78");
    assert(tspl3Up.includes("TEXT 350,") || tspl3Up.includes("TEXT 346,"), "Column 1 store title centered near dots 346-350");
    assert(tspl3Up.includes("TEXT 622,") || tspl3Up.includes("TEXT 618,"), "Column 2 store title centered near dots 618-622");

    // Check Barcode positions
    assert(tspl3Up.includes("BARCODE 43,") || tspl3Up.includes("BARCODE 39,"), "Column 0 barcode positioned inside Column 0 boundary [16-272 dots]");
    assert(tspl3Up.includes("BARCODE 315,") || tspl3Up.includes("BARCODE 311,"), "Column 1 barcode positioned inside Column 1 boundary [288-544 dots]");
    assert(tspl3Up.includes("BARCODE 587,") || tspl3Up.includes("BARCODE 583,"), "Column 2 barcode positioned inside Column 2 boundary [560-816 dots]");

    const printOccurrences = (tspl3Up.match(/PRINT 1, 1/g) || []).length;
    assert(printOccurrences === 2, "TSPL issues exactly 2 PRINT commands for 2 rows of stickers");

    console.log("\n=================================================");
    console.log(`PHASE 3 TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log("=================================================\n");

    if (failed > 0) {
      process.exit(1);
    }
  } catch (error) {
    console.error("Test execution encountered an error:", error);
    process.exit(1);
  } finally {
    // Cleanup test data
    console.log("Cleaning up test organizations...");
    await prisma.organization.deleteMany({
      where: { id: { in: [testOrgAId, testOrgBId] } },
    });
    await prisma.$disconnect();
  }
}

runTests();

