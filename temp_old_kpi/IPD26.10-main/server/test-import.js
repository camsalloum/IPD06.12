const fs = require('fs');
const { Pool } = require('pg');

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'fp_database',
  user: 'postgres',
  password: '654883'
});

async function test() {
  // Check table structure
  const cols = await pool.query(
    "SELECT column_name FROM information_schema.columns WHERE table_name='fp_budget_bulk_import' ORDER BY ordinal_position"
  );
  console.log('Table columns:', cols.rows.map(c => c.column_name).join(', '));
  
  const files = [
    { name: 'FINAL_FP_CHRISTOPHER_DELA_CRUZ_2026_20251201_104722.html', salesRep: 'CHRISTOPHER DELA CRUZ' },
    { name: 'FINAL_FP_Narek_Koroukian_2026_20251201_104538.html', salesRep: 'Narek Koroukian' }
  ];
  
  for (const file of files) {
    const content = fs.readFileSync('D:/Projects/IPD26.10/' + file.name, 'utf8');
    const match = content.match(/const savedBudget\s*=\s*(\[[\s\S]*?\]);/);
    if (!match) { console.log(file.name, '- NO DATA'); continue; }
    
    const data = JSON.parse(match[1]);
    console.log('\n' + file.name, '-', data.length, 'records');
    
    // Group and insert
    const grouped = {};
    for (const r of data) {
      const key = r.customer + '|' + r.country + '|' + r.productGroup;
      if (!grouped[key]) grouped[key] = { customer: r.customer, country: r.country, productGroup: r.productGroup, months: {} };
      grouped[key].months[r.month] = r.value;
    }
    
    for (const g of Object.values(grouped)) {
      let total = 0;
      for (let m = 1; m <= 12; m++) total += (g.months[m] || 0);
      
      await pool.query(
        `INSERT INTO fp_budget_bulk_import 
         (batch_id, division, sales_rep, budget_year, customer, country, product_group, 
          month_1, month_2, month_3, month_4, month_5, month_6, 
          month_7, month_8, month_9, month_10, month_11, month_12, 
          total_kg, total_amount, total_morm, status, source_file, imported_at) 
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25)`,
        ['TEST_BATCH', 'FP', file.salesRep, 2026, g.customer, g.country, g.productGroup,
          g.months[1] || 0, g.months[2] || 0, g.months[3] || 0, g.months[4] || 0, g.months[5] || 0, g.months[6] || 0,
          g.months[7] || 0, g.months[8] || 0, g.months[9] || 0, g.months[10] || 0, g.months[11] || 0, g.months[12] || 0,
          total, 0, 0, 'final', file.name, new Date()]
      );
      console.log('  Inserted:', g.customer.substring(0, 30), '| M1:', g.months[1] || 0, '| Total:', total);
    }
  }
  
  // Verify
  const result = await pool.query('SELECT customer, month_1, total_kg FROM fp_budget_bulk_import');
  console.log('\n=== Database Records ===');
  result.rows.forEach(r => console.log(r.customer.substring(0, 30), '| M1:', r.month_1, '| Total:', r.total_kg));
  
  await pool.end();
}

test().catch(e => { console.error(e); process.exit(1); });
