const { Pool } = require('pg');

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'fp_database',
  user: 'postgres',
  password: '654883'
});

async function check() {
  // Check sales rep names in database
  const result = await pool.query(`
    SELECT DISTINCT salesrepname 
    FROM fp_data_excel 
    WHERE salesrepname ILIKE '%christopher%' OR salesrepname ILIKE '%narek%'
    ORDER BY salesrepname
  `);
  
  console.log('Sales rep names in fp_data_excel:');
  result.rows.forEach(row => console.log('  "' + row.salesrepname + '"'));
  
  // Check if there's a name mapping table
  const salesReps = await pool.query(`
    SELECT DISTINCT salesrepname 
    FROM fp_data_excel 
    ORDER BY salesrepname
    LIMIT 20
  `);
  
  console.log('\nFirst 20 sales reps in database:');
  salesReps.rows.forEach(row => console.log('  "' + row.salesrepname + '"'));
  
  await pool.end();
}

check().catch(console.error);
