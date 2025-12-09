const { Pool } = require('pg');
const pool = new Pool({ 
  user: 'postgres', 
  host: 'localhost', 
  database: 'fp_database', 
  password: '654883', 
  port: 5432 
});

async function checkUploadedData() {
  // Count total records
  const countQuery = "SELECT COUNT(*) FROM public.fp_data_excel WHERE division = 'FP' AND type = 'Actual';";
  const countResult = await pool.query(countQuery);
  console.log('\n=== TOTAL RECORDS ===');
  console.log(`Total FP Actual records: ${countResult.rows[0].count}`);
  
  // Check years
  const yearsQuery = "SELECT DISTINCT year FROM public.fp_data_excel WHERE division = 'FP' AND type = 'Actual' ORDER BY year;";
  const yearsResult = await pool.query(yearsQuery);
  console.log('\n=== YEARS IN DATABASE ===');
  console.log(yearsResult.rows.map(r => r.year).join(', '));
  
  // Sample data
  const sampleQuery = "SELECT * FROM public.fp_data_excel WHERE division = 'FP' AND type = 'Actual' LIMIT 5;";
  const sampleResult = await pool.query(sampleQuery);
  console.log('\n=== SAMPLE DATA (First 5 rows) ===');
  console.log(sampleResult.rows);
  
  pool.end();
}

checkUploadedData().catch(err => {
  console.error('Error:', err);
  pool.end();
});
