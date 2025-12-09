// Check division merge rules
const { Pool } = require('pg');

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'fp_database',
  user: 'postgres',
  password: '654883'
});

async function checkData() {
  try {
    console.log('=== Division customer merge rules (fp_division_customer_merge_rules) ===');
    const divRules = await pool.query(`
      SELECT * FROM fp_division_customer_merge_rules 
      WHERE UPPER(merged_customer_name) LIKE '%MASAFI%'
         OR UPPER(original_customers::text) LIKE '%MASAFI%'
    `);
    if (divRules.rows.length === 0) {
      console.log('No Masafi rules in fp_division_customer_merge_rules');
    } else {
      divRules.rows.forEach(row => {
        console.log(JSON.stringify(row, null, 2));
      });
    }
    
    // Check all division merge rules
    console.log('\n=== All active division merge rules ===');
    const allRules = await pool.query(`
      SELECT * FROM fp_division_customer_merge_rules 
      WHERE is_active = true
    `);
    if (allRules.rows.length === 0) {
      console.log('No active division merge rules');
    } else {
      allRules.rows.forEach(row => {
        console.log(`Merged: [${row.merged_customer_name}]`);
        console.log(`Original: ${JSON.stringify(row.original_customers)}`);
        console.log('');
      });
    }
    
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await pool.end();
  }
}

checkData();
