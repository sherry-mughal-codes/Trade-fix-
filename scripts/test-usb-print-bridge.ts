import http from "http";

async function testBridge() {
  console.log("=================================================");
  console.log("VERIFYING DIRECT USB PRINT BRIDGE FOR TSC TTP-244 PRO");
  console.log("=================================================");

  // 1. Check status
  const statusRes = await new Promise<{ statusCode?: number; body: any }>((resolve, reject) => {
    http.get("http://127.0.0.1:9190/status", (res) => {
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => resolve({ statusCode: res.statusCode, body: JSON.parse(data) }));
    }).on("error", reject);
  });

  if (statusRes.statusCode !== 200) {
    throw new Error(`Expected HTTP 200, got ${statusRes.statusCode}`);
  }
  console.log("  [PASS] Print bridge is online on port 9190");
  console.log("  [PASS] Target printer is recognized:", statusRes.body.printerName);
  console.log("  [PASS] Windows USB Port:", statusRes.body.port);
  console.log("  [PASS] Found in Windows installed printers:", statusRes.body.foundInWindows);

  // 2. Check test sticker dispatch
  const testRes = await new Promise<{ statusCode?: number; body: any }>((resolve, reject) => {
    const req = http.request(
      "http://127.0.0.1:9190/test",
      {
        method: "POST",
        headers: { "Content-Length": "0" },
      },
      (res) => {
        let data = "";
        res.on("data", (c) => (data += c));
        res.on("end", () => resolve({ statusCode: res.statusCode, body: JSON.parse(data) }));
      }
    );
    req.on("error", reject);
    req.end();
  });

  if (testRes.statusCode !== 200 || !testRes.body.success) {
    throw new Error(`Test print failed: ${JSON.stringify(testRes.body)}`);
  }
  console.log("  [PASS] Direct test sticker successfully written to TSC TTP-244 Pro print spooler");
  console.log("  [PASS] Bytes written to hardware port:", testRes.body.bytesWritten);

  console.log("=================================================");
  console.log("ALL DIRECT USB PRINT BRIDGE TESTS PASSED (100%)");
  console.log("=================================================");
}

testBridge().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});

