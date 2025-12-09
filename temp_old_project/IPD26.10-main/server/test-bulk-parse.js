const { Pool } = require('pg');
const fs = require('fs');

const pool = new Pool({ 
  host: 'localhost', 
  port: 5432, 
  database: 'fp_database', 
  user: 'postgres', 
  password: '654883' 
});

async function test() {
  const htmlContent = fs.readFileSync('D:/Projects/IPD26.10/FINAL_FP_CHRISTOPHER_DELA_CRUZ_2026_20251130_203244.html', 'utf8');
  
  // Extract budget data from HTML - exact same regex as server
  const budgetDataMatch = htmlContent.match(/const savedBudget\s*=\s*(\[[\s\S]*?\]);/);
  if (!budgetDataMatch) {
    console.log('No budget data found');
    return;
  }
  
  const budgetData = JSON.parse(budgetDataMatch[1]);
  console.log('Parsed', budgetData.length, 'records from savedBudget');
  
  // Group by customer/country/productGroup
  const groupedData = {};
  for (const record of budgetData) {
    const key = record.customer + '|||' + record.country + '|||' + record.productGroup;
    if (!groupedData[key]) {
      groupedData[key] = { customer: record.customer, country: record.country, productGroup: record.productGroup, months: {} };
    }
    groupedData[key].months[record.month] = record.value;
  }
  
  console.log('Grouped into', Object.keys(groupedData).length, 'rows');
  for (const key of Object.keys(groupedData)) {
    const r = groupedData[key];
    let totalKg = 0;
    for (let m = 1; m <= 12; m++) totalKg += (r.months[m] || 0);
    console.log('Customer:', r.customer?.substring(0,40));
    console.log('  M1:', r.months[1] || 0, 'Total:', totalKg);
  }
  
  await pool.end();
}

test().catch(console.error);
