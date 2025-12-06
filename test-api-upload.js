const fs = require('fs');
const http = require('http');

const filePath = 'D:\\Projects\\IPD26.10\\BUDGET_Divisional_FP_2026_20251129_124200.html';
const htmlContent = fs.readFileSync(filePath, 'utf8');

console.log('📄 File size:', htmlContent.length, 'characters');

const body = JSON.stringify({
  htmlContent: htmlContent,
  confirmReplace: true
});

console.log('📦 JSON body size:', body.length, 'characters');

const options = {
  hostname: 'localhost',
  port: 3001,
  path: '/api/aebf/import-divisional-budget-html',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body)
  }
};

console.log('🚀 Sending request to', options.hostname + ':' + options.port + options.path);

const req = http.request(options, (res) => {
  let data = '';
  
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    console.log('\n📬 Response status:', res.statusCode);
    try {
      const json = JSON.parse(data);
      console.log('📋 Response:', JSON.stringify(json, null, 2));
    } catch (e) {
      console.log('📋 Raw response:', data);
    }
  });
});

req.on('error', (e) => {
  console.error('❌ Request error:', e.message);
});

req.write(body);
req.end();
