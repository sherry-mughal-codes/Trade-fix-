import http from "http";

function generate3UpTSPL() {
  const widthMm = 32;
  const heightMm = 25;
  const cols = 3;
  const gapX = 2;
  const gapY = 2;
  const marginLeft = 2;
  const marginTop = 1;
  const speed = 3;
  const density = 10;
  const totalRollWidthMm = (marginLeft * 2) + (widthMm * cols) + (gapX * (cols - 1)); // 104mm

  const commands: string[] = [];
  commands.push(`SIZE ${Math.round(totalRollWidthMm)} mm, ${Math.round(heightMm)} mm`);
  commands.push(`GAP ${gapY} mm, 0 mm`);
  commands.push(`SPEED ${speed}`);
  commands.push(`DENSITY ${density}`);
  commands.push(`DIRECTION 1`);
  commands.push(`REFERENCE 0, 0`);

  // We will print 2 rows of 3 stickers (6 stickers total)
  const testItems = [
    { name: "Aujla Store", item: "1 KG Aata", barcode: "34567897666", price: 120.0 },
    { name: "Aujla Store", item: "1 KG Aata", barcode: "34567897666", price: 120.0 },
    { name: "Aujla Store", item: "1 KG Aata", barcode: "34567897666", price: 120.0 },
    { name: "Aujla Store", item: "1 KG Aata", barcode: "34567897666", price: 120.0 },
    { name: "Aujla Store", item: "1 KG Aata", barcode: "34567897666", price: 120.0 },
    { name: "Aujla Store", item: "1 KG Aata", barcode: "34567897666", price: 120.0 },
  ];

  const totalRows = Math.ceil(testItems.length / cols);

  for (let r = 0; r < totalRows; r++) {
    commands.push(`CLS`);
    for (let c = 0; c < cols; c++) {
      const idx = r * cols + c;
      if (idx >= testItems.length) break;
      const it = testItems[idx];

      const colLeftMm = marginLeft + c * (widthMm + gapX);
      const colX = Math.round(colLeftMm * 8);
      const labelWidthDots = Math.round(widthMm * 8); // 256 dots

      // 1. Store Name (centered)
      const storeText = it.name.slice(0, 20);
      const storeW = storeText.length * 12;
      const storeX = colX + Math.max(4, Math.round((labelWidthDots - storeW) / 2));
      const storeY = 12;
      commands.push(`TEXT ${storeX},${storeY},"2",0,1,1,"${storeText}"`);

      // 2. Item Name (centered)
      const itemText = it.item.slice(0, 20);
      const itemW = itemText.length * 12;
      const itemX = colX + Math.max(4, Math.round((labelWidthDots - itemW) / 2));
      const itemY = 36;
      commands.push(`TEXT ${itemX},${itemY},"2",0,1,1,"${itemText}"`);

      // 3. Barcode (Code 128, centered)
      const isNumeric = /^\d+$/.test(it.barcode);
      const modules = 11 + (isNumeric ? Math.ceil(it.barcode.length / 2) : it.barcode.length) * 11 + 24;
      const narrow = modules * 2 > labelWidthDots - 20 ? 1 : 2;
      const barW = modules * narrow;
      const barX = colX + Math.max(6, Math.round((labelWidthDots - barW) / 2));
      const barY = 62;
      const barH = 42;
      commands.push(`BARCODE ${barX},${barY},"128",${barH},0,0,${narrow},${narrow},"${it.barcode}"`);

      // 4. Barcode number (centered)
      const codeW = it.barcode.length * 8;
      const codeX = colX + Math.max(4, Math.round((labelWidthDots - codeW) / 2));
      const codeY = 108;
      commands.push(`TEXT ${codeX},${codeY},"1",0,1,1,"${it.barcode}"`);

      // 5. Price (centered)
      const priceText = `Rs. ${it.price.toFixed(2)}`;
      const priceW = priceText.length * 12;
      const priceX = colX + Math.max(4, Math.round((labelWidthDots - priceW) / 2));
      const priceY = 132;
      commands.push(`TEXT ${priceX},${priceY},"2",0,1,1,"${priceText}"`);
    }
    commands.push(`PRINT 1, 1`);
  }

  return commands.join("\r\n") + "\r\n";
}

const tspl = generate3UpTSPL();
console.log("Generated TSPL for 3-UP calibration print:\n");
console.log(tspl);

// Dispatch to print bridge if active
const payload = JSON.stringify({
  printerName: "TSC TTP-244 Pro",
  tspl: tspl,
});

const req = http.request(
  {
    hostname: "127.0.0.1",
    port: 9190,
    path: "/print",
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Content-Length": Buffer.byteLength(payload),
    },
  },
  (res) => {
    let d = "";
    res.on("data", (c) => (d += c));
    res.on("end", () => console.log("Direct print result from bridge:", res.statusCode, d));
  }
);

req.on("error", (e) => console.log("Bridge not reachable directly:", e.message));
req.write(payload);
req.end();

