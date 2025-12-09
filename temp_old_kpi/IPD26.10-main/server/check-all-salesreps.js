const { Pool } = require('pg');
const pool = new Pool({ 
  user: 'postgres', 
  host: 'localhost', 
  database: 'fp_database', 
  password: '654883', 
  port: 5432 
});

async function checkData() {
  // Check sales reps in FP Actual data
  const actualReps = await pool.query(
    SELECT DISTINCT TRIM(salesrepname) as salesrepname 
    FROM public.fp_data_excel 
    WHERE division = 'FP' AND type = 'Actual'
    ORDER BY salesrepname
  );
  console.log('\n=== SALES REPS IN FP ACTUAL DATA ===');
  console.log(actualReps.rows);
  console.log('Total:', actualReps.rows.length);
  
  // Check ALL sales reps in fp_data_excel (any type)
  const allReps = await pool.query(
    SELECT DISTINCT TRIM(salesrepname) as salesrepname, type
    FROM public.fp_data_excel 
    WHERE division = 'FP'
    ORDER BY salesrepname, type
  );
  console.log('\n=== ALL SALES REPS IN FP DATA (ALL TYPES) ===');
  console.log(allReps.rows);
  console.log('Total unique reps:', new Set(allReps.rows.map(r => r.salesrepname)).size);
  
  // Check which types they appear in
  const byType = await pool.query(
    SELECT type, COUNT(DISTINCT salesrepname) as rep_count
    FROM public.fp_data_excel 
    WHERE division = 'FP'
    GROUP BY type
    ORDER BY type
  );
  console.log('\n=== SALES REPS BY TYPE ===');
  console.log(byType.rows);
  
  pool.end();
}

checkData().catch(err => {
  console.error('Error:', err);
  pool.end();
});
