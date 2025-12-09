const { Pool } = require('pg');

const pool = new Pool({
  host: 'localhost',
  database: 'fp_database',
  user: 'postgres',
  password: '654883',
  port: 5432
});

async function checkKGSValues() {
  try {
    const result = await pool.query(
      `SELECT productgroup, values_type, values 
       FROM sales_rep_budget 
       WHERE UPPER(salesrepname) = 'NAREK KOROUKIAN' 
         AND budget_year = 2026 
         AND UPPER(type) = 'BUDGET' 
         AND values_type = 'KGS' 
         AND productgroup ILIKE '%commercial%plain%'`
    );
    
    console.log('Database KGS values:');
    console.log(JSON.stringify(result.rows, null, 2));
    
    if (result.rows.length > 0) {
      const kgsValue = result.rows[0].values;
      console.log('\nStored value:', kgsValue);
      console.log('After * 1000:', kgsValue * 1000);
      console.log('Is this correct? 1 MT = 1000 KG, so if stored as 1 MT, result should be 1000 KG');
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkKGSValues();
