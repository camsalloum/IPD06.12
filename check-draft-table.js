const { Pool } = require('pg');
const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'fp_database',
  password: '654883',
  port: 5432,
});

async function check() {
  try {
    console.log('Checking fp_sales_rep_budget_draft table structure...\n');
    
    const res = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'fp_sales_rep_budget_draft'
      ORDER BY ordinal_position
    `);
    
    if (res.rows.length === 0) {
      console.log('❌ Table fp_sales_rep_budget_draft does not exist!');
    } else {
      console.log('✅ Table columns:');
      console.table(res.rows);
    }
  } catch (e) {
    console.error('❌ Error:', e.message);
  } finally {
    await pool.end();
  }
}

check();
