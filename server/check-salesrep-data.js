const { Pool } = require('pg');
const pool = new Pool({ 
  user: 'postgres', 
  host: 'localhost', 
  database: 'fp_database', 
  password: '654883', 
  port: 5432 
});

async function checkData() {
  // Check all unique sales reps
  const reps = await pool.query("SELECT DISTINCT UPPER(TRIM(salesrepname)) as salesrepname FROM public.fp_data_excel WHERE division = 'FP' AND type = 'Actual' ORDER BY salesrepname");
  console.log('\n=== SALES REPS (NORMALIZED) ===');
  console.log(reps.rows);
  
  // Check data for one specific sales rep
  const testRep = 'ARA BAYRAMIAN';
  const testQuery = `
    SELECT 
      TRIM(UPPER(salesrepname)) as salesrepname,
      year,
      month,
      type,
      SUM(CASE WHEN UPPER(values_type) = 'AMOUNT' THEN values ELSE 0 END) as total_value 
    FROM public.fp_data_excel
    WHERE TRIM(UPPER(salesrepname)) = $1 
    AND type = 'Actual'
    AND division = 'FP'
    GROUP BY TRIM(UPPER(salesrepname)), year, month, type
    ORDER BY year, month
  `;
  
  const testResult = await pool.query(testQuery, [testRep]);
  console.log('\n=== DATA FOR', testRep, '===');
  console.log(testResult.rows);
  
  pool.end();
}

checkData().catch(err => {
  console.error('Error:', err);
  pool.end();
});
