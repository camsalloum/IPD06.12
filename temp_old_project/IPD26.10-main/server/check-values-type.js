const { Pool } = require('pg');

const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'fp_database',
  password: '654883',
  port: 5432
});

async function checkValuesType() {
  try {
    console.log('\n🔍 Checking values_type column for Narek...\n');
    
    const result = await pool.query(`
      SELECT values_type, COUNT(*) as count, SUM(values) as total
      FROM sales_rep_budget
      WHERE UPPER(salesrepname) = UPPER('Narek Koroukian')
      AND budget_year = 2026
      GROUP BY values_type
      ORDER BY values_type
    `);
    
    console.log('Values Type Data:');
    console.table(result.rows);
    
    console.log('\n📊 Testing the recap query exactly as the API uses it...\n');
    
    const recapResult = await pool.query(`
      SELECT 
        values_type,
        SUM(values) as total_values,
        COUNT(*) as record_count
      FROM sales_rep_budget
      WHERE UPPER(division) = UPPER('FP')
        AND budget_year = 2026
        AND UPPER(TRIM(salesrepname)) = UPPER(TRIM('Narek Koroukian'))
        AND UPPER(type) = 'BUDGET'
        AND values_type IN ('AMOUNT', 'KGS', 'MORM')
      GROUP BY values_type
      ORDER BY 
        CASE values_type
          WHEN 'AMOUNT' THEN 1
          WHEN 'KGS' THEN 2
          WHEN 'MORM' THEN 3
        END
    `);
    
    console.log('Recap Query Result:');
    console.table(recapResult.rows);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkValuesType();
