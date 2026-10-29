const http = require('http');

const payload = JSON.stringify({
  printerName: 'TSC TTP-244 Pro',
  tspl: 'SIZE 50 mm, 25 mm\r\nGAP 2 mm, 0 mm\r\nDIRECTION 1\r\nDENSITY 10\r\nSPEED 3\r\nCLS\r\nTEXT 30, 20, "2", 0, 1, 1, "HTTP BRIDGE TEST"\r\nBARCODE 30, 60, "128", 40, 1, 0, 2, 4, "TF-DIRECT-OK"\r\nPRINT 1, 1\r\n'
});

const req = http.request({
  hostname: '127.0.0.1',
  port: 9190,
  path: '/print',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload)
  }
}, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log('HTTP Status:', res.statusCode);
    console.log('Response:', data);
  });
});

req.on('error', (err) => {
  console.error('Request failed:', err);
});

req.write(payload);
req.end();

