const { Pool } = require('pg');
const pool = new Pool({ 
  user: 'postgres', 
  host: 'localhost', 
  database: 'fp_database', 
  password: '654883', 
  port: 5432 
});

async function checkSalesReps() {
  // Query without division filter (what the API does)
  const query1 = `
    SELECT DISTINCT salesrepname
    FROM public.fp_data_excel
    WHERE salesrepname IS NOT NULL 
    ORDER BY salesrepname
  `;
  
  const result1 = await pool.query(query1);
  console.log('\n=== Query WITHOUT division filter (current API) ===');
  console.log('Results:', result1.rows);
  console.log('Total:', result1.rows.length);
  
  // Query WITH division filter (what it should do)
  const query2 = `
    SELECT DISTINCT salesrepname
    FROM public.fp_data_excel
    WHERE salesrepname IS NOT NULL 
    AND division = 'FP'
    ORDER BY salesrepname
  `;
  
  const result2 = await pool.query(query2);
  console.log('\n=== Query WITH division filter (what we need) ===');
  console.log('Results:', result2.rows);
  console.log('Total:', result2.rows.length);
  
  pool.end();
}

checkSalesReps().catch(err => {
  console.error('Error:', err);
  pool.end();
});
