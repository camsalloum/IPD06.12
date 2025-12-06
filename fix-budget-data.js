const { Pool } = require('pg');

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'fp_database',
  user: 'postgres',
  password: '654883'
});

async function fixData() {
  try {
    // Fix type and values_type to match expected format
    const result = await pool.query(`
      UPDATE fp_sales_rep_budget 
      SET type = 'BUDGET', values_type = 'KGS' 
      WHERE LOWER(type) = 'budget' AND LOWER(values_type) = 'kg'
    `);
    console.log('Updated rows:', result.rowCount);
    
    // Verify
    const check = await pool.query('SELECT DISTINCT type, values_type FROM fp_sales_rep_budget');
    console.log('Current values:');
    console.table(check.rows);
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

fixData();
