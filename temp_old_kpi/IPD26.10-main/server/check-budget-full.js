const { Pool } = require('pg');

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'fp_database',
  user: 'postgres',
  password: '654883'
});

async function check() {
  try {
    // Check all budget data
    const result = await pool.query('SELECT * FROM fp_sales_rep_budget LIMIT 5');
    console.log('=== fp_sales_rep_budget sample data ===');
    result.rows.forEach((row, i) => {
      console.log(`\nRow ${i + 1}:`);
      console.log('  salesrepname:', row.salesrepname);
      console.log('  customername:', row.customername);
      console.log('  productgroup:', row.productgroup);
      console.log('  values_type:', row.values_type);
      console.log('  values:', row.values);
      console.log('  material:', row.material);
      console.log('  process:', row.process);
      console.log('  month:', row.month);
    });
    
    // Check counts by values_type
    const counts = await pool.query('SELECT values_type, COUNT(*) as cnt FROM fp_sales_rep_budget GROUP BY values_type');
    console.log('\n=== Counts by values_type ===');
    counts.rows.forEach(r => console.log(`  ${r.values_type}: ${r.cnt} records`));
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

check();
