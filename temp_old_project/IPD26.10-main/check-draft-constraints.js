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
    console.log('Checking fp_sales_rep_budget_draft constraints...\n');
    
    const res = await pool.query(`
      SELECT
        con.conname AS constraint_name,
        con.contype AS constraint_type,
        CASE con.contype
          WHEN 'p' THEN 'PRIMARY KEY'
          WHEN 'u' THEN 'UNIQUE'
          WHEN 'f' THEN 'FOREIGN KEY'
          WHEN 'c' THEN 'CHECK'
          ELSE con.contype::text
        END AS constraint_description,
        pg_get_constraintdef(con.oid) AS constraint_definition
      FROM pg_constraint con
      JOIN pg_class rel ON rel.oid = con.conrelid
      WHERE rel.relname = 'fp_sales_rep_budget_draft'
      ORDER BY con.conname
    `);
    
    if (res.rows.length === 0) {
      console.log('❌ No constraints found on fp_sales_rep_budget_draft table!');
    } else {
      console.log('✅ Constraints:');
      console.table(res.rows);
    }
  } catch (e) {
    console.error('❌ Error:', e.message);
  } finally {
    await pool.end();
  }
}

check();
