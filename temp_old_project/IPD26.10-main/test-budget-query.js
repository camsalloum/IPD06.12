const { Pool } = require('pg');

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'fp_database',
  user: 'postgres',
  password: '654883'
});

async function testQuery() {
  try {
    console.log('\n=== Testing budget query ===\n');
    
    // This is the exact query used by html-budget-customers-all
    const budgetQuery = `
      SELECT 
        TRIM(salesrepname) as salesrep,
        TRIM(customername) as customer,
        TRIM(countryname) as country,
        TRIM(productgroup) as productgroup,
        month,
        SUM(values) / 1000.0 as mt_value
      FROM fp_sales_rep_budget
      WHERE UPPER(division) = UPPER($1)
        AND budget_year = $2
        AND UPPER(type) = 'BUDGET'
        AND UPPER(values_type) = 'KGS'
      GROUP BY TRIM(salesrepname), TRIM(customername), TRIM(countryname), TRIM(productgroup), month
      ORDER BY TRIM(salesrepname), TRIM(customername), TRIM(countryname), TRIM(productgroup), month
    `;
    
    const result = await pool.query(budgetQuery, ['FP', 2026]);
    console.log('Query result count:', result.rows.length);
    console.table(result.rows);
    
    // Also check raw data
    console.log('\n=== Raw data in fp_sales_rep_budget ===\n');
    const rawData = await pool.query('SELECT * FROM fp_sales_rep_budget');
    console.table(rawData.rows);
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

testQuery();
