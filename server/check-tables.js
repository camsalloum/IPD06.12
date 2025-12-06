const { Pool } = require('pg');

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'fp_database',
  user: 'postgres',
  password: '654883'
});

async function check() {
  // Check sales rep budget table structure
  const cols = await pool.query(
    "SELECT column_name FROM information_schema.columns WHERE table_name='fp_sales_rep_budget' ORDER BY ordinal_position"
  );
  console.log('fp_sales_rep_budget columns:');
  cols.rows.forEach(c => console.log('  ', c.column_name));
  
  // Check bulk import table
  const bulkCols = await pool.query(
    "SELECT column_name FROM information_schema.columns WHERE table_name='fp_budget_bulk_import' ORDER BY ordinal_position"
  );
  console.log('\nfp_budget_bulk_import columns:');
  bulkCols.rows.forEach(c => console.log('  ', c.column_name));
  
  // Check current batch data
  const batches = await pool.query("SELECT DISTINCT batch_id, status, COUNT(*) as cnt FROM fp_budget_bulk_import GROUP BY batch_id, status");
  console.log('\nBatches in database:');
  batches.rows.forEach(b => console.log('  ', b.batch_id, '-', b.status, '-', b.cnt, 'records'));
  
  await pool.end();
}

check().catch(console.error);
