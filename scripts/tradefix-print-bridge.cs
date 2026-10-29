using System;
using System.IO;
using System.Net;
using System.Text;
using System.Runtime.InteropServices;
using System.Drawing.Printing;

namespace TradeFixPrintBridge
{
    public class RawPrinterHelper
    {
        [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Ansi)]
        public class DOCINFOA
        {
            [MarshalAs(UnmanagedType.LPStr)] public string pDocName;
            [MarshalAs(UnmanagedType.LPStr)] public string pOutputFile;
            [MarshalAs(UnmanagedType.LPStr)] public string pDataType;
        }

        [DllImport("winspool.Drv", EntryPoint = "OpenPrinterA", SetLastError = true, CharSet = CharSet.Ansi, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
        public static extern bool OpenPrinter([MarshalAs(UnmanagedType.LPStr)] string szPrinter, out IntPtr hPrinter, IntPtr pd);

        [DllImport("winspool.Drv", EntryPoint = "ClosePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
        public static extern bool ClosePrinter(IntPtr hPrinter);

        [DllImport("winspool.Drv", EntryPoint = "StartDocPrinterA", SetLastError = true, CharSet = CharSet.Ansi, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
        public static extern bool StartDocPrinter(IntPtr hPrinter, Int32 level, [In, MarshalAs(UnmanagedType.LPStruct)] DOCINFOA di);

        [DllImport("winspool.Drv", EntryPoint = "EndDocPrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
        public static extern bool EndDocPrinter(IntPtr hPrinter);

        [DllImport("winspool.Drv", EntryPoint = "StartPagePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
        public static extern bool StartPagePrinter(IntPtr hPrinter);

        [DllImport("winspool.Drv", EntryPoint = "EndPagePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
        public static extern bool EndPagePrinter(IntPtr hPrinter);

        [DllImport("winspool.Drv", EntryPoint = "WritePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
        public static extern bool WritePrinter(IntPtr hPrinter, IntPtr pBytes, Int32 dwCount, out Int32 dwWritten);

        public static bool SendStringToPrinter(string szPrinterName, string szString, out int bytesWritten, out string errorMessage)
        {
            bytesWritten = 0;
            errorMessage = null;
            byte[] bytes = Encoding.UTF8.GetBytes(szString);
            IntPtr pUnmanagedBytes = Marshal.AllocCoTaskMem(bytes.Length);
            Marshal.Copy(bytes, 0, pUnmanagedBytes, bytes.Length);
            bool success = SendBytesToPrinter(szPrinterName, pUnmanagedBytes, bytes.Length, out bytesWritten, out errorMessage);
            Marshal.FreeCoTaskMem(pUnmanagedBytes);
            return success;
        }

        public static bool SendBytesToPrinter(string szPrinterName, IntPtr pBytes, Int32 dwCount, out int bytesWritten, out string errorMessage)
        {
            bytesWritten = 0;
            errorMessage = null;
            IntPtr hPrinter = new IntPtr(0);
            DOCINFOA di = new DOCINFOA();
            bool bSuccess = false;

            di.pDocName = "TradeFix Sticker Job";
            di.pDataType = "RAW";

            if (OpenPrinter(szPrinterName.Normalize(), out hPrinter, IntPtr.Zero))
            {
                if (StartDocPrinter(hPrinter, 1, di))
                {
                    if (StartPagePrinter(hPrinter))
                    {
                        bSuccess = WritePrinter(hPrinter, pBytes, dwCount, out bytesWritten);
                        EndPagePrinter(hPrinter);
                    }
                    else
                    {
                        errorMessage = "StartPagePrinter failed, error: " + Marshal.GetLastWin32Error();
                    }
                    EndDocPrinter(hPrinter);
                }
                else
                {
                    errorMessage = "StartDocPrinter failed, error: " + Marshal.GetLastWin32Error();
                }
                ClosePrinter(hPrinter);
            }
            else
            {
                errorMessage = "OpenPrinter failed for '" + szPrinterName + "', error: " + Marshal.GetLastWin32Error();
            }

            return bSuccess;
        }
    }

    class Program
    {
        private const int Port = 9190;
        private const string DefaultPrinter = "TSC TTP-244 Pro";

        static void Main(string[] args)
        {
            Console.WriteLine("==================================================");
            Console.WriteLine(" TradeFix Direct Print Bridge for TSC TTP-244-Pro");
            Console.WriteLine("==================================================");

            if (args.Length > 0 && args[0] == "--test")
            {
                string p = args.Length > 1 ? args[1] : DefaultPrinter;
                RunTestPrint(p);
                return;
            }

            StartHttpServer();
        }

        static string Get3UpTestTSPL(string storeName, string itemName, string barcode, double price)
        {
            if (string.IsNullOrEmpty(storeName)) storeName = "Aujla Store";
            if (string.IsNullOrEmpty(itemName)) itemName = "1 KG Aata";
            if (string.IsNullOrEmpty(barcode)) barcode = "34567897666";
            if (price <= 0) price = 120.00;

            storeName = storeName.Replace("\"", "").Trim();
            if (storeName.Length > 20) storeName = storeName.Substring(0, 20);

            itemName = itemName.Replace("\"", "").Trim();
            if (itemName.Length > 18) itemName = itemName.Substring(0, 18);

            StringBuilder sb = new StringBuilder();
            sb.AppendLine("SIZE 104 mm, 18 mm");
            sb.AppendLine("GAP 3 mm, 0 mm");
            sb.AppendLine("SPEED 3");
            sb.AppendLine("DENSITY 10");
            sb.AppendLine("DIRECTION 1");
            sb.AppendLine("REFERENCE 0, 0");
            sb.AppendLine("CLS");

            int[] colX = new int[] { 16, 288, 560 }; // Columns 0, 1, 2 on 104mm roll (8 dots/mm)
            int labelW = 256; // 32mm * 8 = 256 dots

            for (int c = 0; c < 3; c++)
            {
                int x0 = colX[c];

                // 1. Store Name (centered, font "2", Y = 16)
                int sW = storeName.Length * 12;
                int sX = x0 + Math.Max(4, (labelW - sW) / 2);
                sb.AppendLine(string.Format("TEXT {0},16,\"2\",0,1,1,\"{1}\"", sX, storeName));

                // 2. Item Name & Unit (centered, Y = 40)
                bool useFont1 = itemName.Length > 13;
                string fontCode = useFont1 ? "1" : "2";
                int charW = useFont1 ? 8 : 12;
                int iW = itemName.Length * charW;
                int iX = x0 + Math.Max(4, (labelW - iW) / 2);
                sb.AppendLine(string.Format("TEXT {0},40,\"{1}\",0,1,1,\"{2}\"", iX, fontCode, itemName));

                // 3. Barcode (Code 128, height 28 dots = 3.5mm, Y = 64)
                int modules = 11 + (barcode.Length * 11) + 24;
                int narrow = (modules * 2 > 200 || barcode.Length > 9) ? 1 : 2;
                int bW = modules * narrow;
                int bX = x0 + Math.Max(4, (labelW - bW) / 2);
                sb.AppendLine(string.Format("BARCODE {0},64,\"128\",28,0,0,{1},{1},\"{2}\"", bX, narrow, barcode));

                // 4. Barcode number (centered, font "1", Y = 96)
                int cW = barcode.Length * 8;
                int cX = x0 + Math.Max(4, (labelW - cW) / 2);
                sb.AppendLine(string.Format("TEXT {0},96,\"1\",0,1,1,\"{1}\"", cX, barcode));

                // 5. Price (centered, font "2", Y = 114)
                string pStr = string.Format("Rs. {0:0.00}", price);
                int pW = pStr.Length * 12;
                int pX = x0 + Math.Max(4, (labelW - pW) / 2);
                sb.AppendLine(string.Format("TEXT {0},114,\"2\",0,1,1,\"{1}\"", pX, pStr));
            }

            sb.AppendLine("PRINT 1, 1");
            return sb.ToString();
        }

        static void RunTestPrint(string printerName)
        {
            Console.WriteLine("Running 3-UP calibration test print to: " + printerName);
            string tspl = Get3UpTestTSPL("Aujla Store", "1 KG Aata", "34567897666", 120.00);

            int written;
            string err;
            bool ok = RawPrinterHelper.SendStringToPrinter(printerName, tspl, out written, out err);
            if (ok)
            {
                Console.WriteLine("SUCCESS: 3-UP Test label sent (" + written + " bytes written).");
            }
            else
            {
                Console.WriteLine("FAILED: " + err);
            }
        }

        static void StartHttpServer()
        {
            HttpListener listener = new HttpListener();
            listener.Prefixes.Add("http://127.0.0.1:" + Port + "/");
            listener.Prefixes.Add("http://localhost:" + Port + "/");

            try
            {
                listener.Start();
                Console.WriteLine("Bridge HTTP Server listening on port " + Port + "...");
                Console.WriteLine("Endpoints:");
                Console.WriteLine("  GET  /status  - Check printer connectivity");
                Console.WriteLine("  POST /print   - Print raw TSPL commands");
                Console.WriteLine("  POST /test    - Print test sticker");
            }
            catch (Exception ex)
            {
                Console.WriteLine("Error starting HTTP server: " + ex.Message);
                return;
            }

            while (true)
            {
                try
                {
                    HttpListenerContext context = listener.GetContext();
                    HandleRequest(context);
                }
                catch (Exception ex)
                {
                    Console.WriteLine("Request error: " + ex.Message);
                }
            }
        }

        static void HandleRequest(HttpListenerContext context)
        {
            HttpListenerRequest req = context.Request;
            HttpListenerResponse res = context.Response;

            // CORS headers
            res.Headers.Add("Access-Control-Allow-Origin", "*");
            res.Headers.Add("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
            res.Headers.Add("Access-Control-Allow-Headers", "Content-Type, Authorization");

            if (req.HttpMethod == "OPTIONS")
            {
                res.StatusCode = 200;
                res.Close();
                return;
            }

            string path = req.Url.AbsolutePath.ToLowerInvariant();

            if (path == "/status" && req.HttpMethod == "GET")
            {
                var printerList = new System.Collections.Generic.List<string>();
                string detected = "";
                foreach (string printer in PrinterSettings.InstalledPrinters)
                {
                    printerList.Add(printer);
                    if (string.IsNullOrEmpty(detected) && (
                        printer.IndexOf("TSC", StringComparison.OrdinalIgnoreCase) >= 0 ||
                        printer.IndexOf("TTP", StringComparison.OrdinalIgnoreCase) >= 0 ||
                        printer.IndexOf("Label", StringComparison.OrdinalIgnoreCase) >= 0 ||
                        printer.IndexOf("Barcode", StringComparison.OrdinalIgnoreCase) >= 0 ||
                        printer.IndexOf("4B", StringComparison.OrdinalIgnoreCase) >= 0 ||
                        printer.IndexOf("Xprinter", StringComparison.OrdinalIgnoreCase) >= 0 ||
                        printer.IndexOf("Zebra", StringComparison.OrdinalIgnoreCase) >= 0))
                    {
                        detected = printer;
                    }
                }
                if (string.IsNullOrEmpty(detected) && printerList.Count > 0)
                {
                    detected = printerList[0];
                }
                if (string.IsNullOrEmpty(detected))
                {
                    detected = DefaultPrinter;
                }

                StringBuilder sb = new StringBuilder();
                sb.Append("{\"online\":true,\"printerName\":\"").Append(EscapeJson(detected)).Append("\",");
                sb.Append("\"installedPrinters\":[");
                for (int i = 0; i < printerList.Count; i++)
                {
                    if (i > 0) sb.Append(",");
                    sb.Append("\"").Append(EscapeJson(printerList[i])).Append("\"");
                }
                sb.Append("],\"foundInWindows\":").Append(printerList.Count > 0 ? "true" : "false").Append(",");
                sb.Append("\"port\":\"USB002\",\"bridgeVersion\":\"1.1.0\"}");
                SendJsonResponse(res, 200, sb.ToString());
                return;
            }

            if (path == "/calibrate" && req.HttpMethod == "POST")
            {
                string printerName = DefaultPrinter;
                string tspl = "SIZE 104 mm, 18 mm\r\nGAP 3 mm, 0 mm\r\nGAPDETECT\r\n";

                int written;
                string err;
                bool ok = RawPrinterHelper.SendStringToPrinter(printerName, tspl, out written, out err);
                if (ok)
                {
                    SendJsonResponse(res, 200, "{\"success\":true,\"message\":\"Gap sensor calibration command dispatched to " + printerName + "\",\"bytesWritten\":" + written + "}");
                }
                else
                {
                    SendJsonResponse(res, 500, "{\"success\":false,\"error\":\"" + EscapeJson(err) + "\"}");
                }
                return;
            }

            if (path == "/test" && req.HttpMethod == "POST")
            {
                string printerName = DefaultPrinter;
                string tspl = Get3UpTestTSPL("Aujla Store", "1 KG Aata", "34567897666", 120.00);

                int written;
                string err;
                bool ok = RawPrinterHelper.SendStringToPrinter(printerName, tspl, out written, out err);
                if (ok)
                {
                    SendJsonResponse(res, 200, "{\"success\":true,\"message\":\"Test sticker sent to " + printerName + "\",\"bytesWritten\":" + written + "}");
                }
                else
                {
                    SendJsonResponse(res, 500, "{\"success\":false,\"error\":\"" + EscapeJson(err) + "\"}");
                }
                return;
            }

            if (path == "/print" && req.HttpMethod == "POST")
            {
                string body;
                using (var reader = new StreamReader(req.InputStream, req.ContentEncoding))
                {
                    body = reader.ReadToEnd();
                }

                string printerName = DefaultPrinter;
                string tspl = "";

                // Parse simple JSON or use body as TSPL
                if (body.TrimStart().StartsWith("{"))
                {
                    // extract tspl field
                    int tsplIdx = body.IndexOf("\"tspl\"");
                    if (tsplIdx >= 0)
                    {
                        int colonIdx = body.IndexOf(":", tsplIdx);
                        int firstQuote = body.IndexOf("\"", colonIdx);
                        if (firstQuote >= 0)
                        {
                            // find end quote respecting escapes
                            StringBuilder sb = new StringBuilder();
                            bool escaped = false;
                            for (int i = firstQuote + 1; i < body.Length; i++)
                            {
                                char c = body[i];
                                if (escaped)
                                {
                                    if (c == 'n') sb.Append('\n');
                                    else if (c == 'r') sb.Append('\r');
                                    else if (c == 't') sb.Append('\t');
                                    else sb.Append(c);
                                    escaped = false;
                                }
                                else if (c == '\\')
                                {
                                    escaped = true;
                                }
                                else if (c == '\"')
                                {
                                    break;
                                }
                                else
                                {
                                    sb.Append(c);
                                }
                            }
                            tspl = sb.ToString();
                        }
                    }

                    // extract printerName field if provided
                    int pIdx = body.IndexOf("\"printerName\"");
                    if (pIdx >= 0)
                    {
                        int colonIdx = body.IndexOf(":", pIdx);
                        int firstQuote = body.IndexOf("\"", colonIdx);
                        int endQuote = body.IndexOf("\"", firstQuote + 1);
                        if (firstQuote >= 0 && endQuote > firstQuote)
                        {
                            string customP = body.Substring(firstQuote + 1, endQuote - firstQuote - 1).Trim();
                            if (!string.IsNullOrEmpty(customP))
                            {
                                printerName = customP;
                            }
                        }
                    }
                }
                else
                {
                    tspl = body;
                }

                if (string.IsNullOrEmpty(tspl))
                {
                    SendJsonResponse(res, 400, "{\"success\":false,\"error\":\"TSPL command stream is empty\"}");
                    return;
                }

                int written;
                string err;
                bool ok = RawPrinterHelper.SendStringToPrinter(printerName, tspl, out written, out err);
                if (ok)
                {
                    Console.WriteLine("Direct print dispatched: " + written + " bytes to " + printerName);
                    SendJsonResponse(res, 200, "{\"success\":true,\"printer\":\"" + printerName + "\",\"bytesWritten\":" + written + "}");
                }
                else
                {
                    Console.WriteLine("Direct print failed: " + err);
                    SendJsonResponse(res, 500, "{\"success\":false,\"error\":\"" + EscapeJson(err) + "\"}");
                }
                return;
            }

            SendJsonResponse(res, 404, "{\"error\":\"Not found\"}");
        }

        static void SendJsonResponse(HttpListenerResponse res, int statusCode, string json)
        {
            res.StatusCode = statusCode;
            res.ContentType = "application/json";
            byte[] bytes = Encoding.UTF8.GetBytes(json);
            res.ContentLength64 = bytes.Length;
            res.OutputStream.Write(bytes, 0, bytes.Length);
            res.Close();
        }

        static string EscapeJson(string s)
        {
            if (s == null) return "";
            return s.Replace("\\", "\\\\").Replace("\"", "\\\"").Replace("\r", "\\r").Replace("\n", "\\n");
        }
    }
}

