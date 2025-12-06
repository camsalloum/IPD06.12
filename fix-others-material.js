const { Pool } = require('pg');
const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'fp_database',
  user: 'postgres',
  password: '654883'
});

(async () => {
  try {
    // Update Others records to have material='Others' and process='Others'
    const result = await pool.query(`
      UPDATE fp_sales_rep_budget 
      SET material = 'Others', process = 'Others' 
      WHERE LOWER(productgroup) = 'others' 
        AND (material IS NULL OR material = '' OR process IS NULL OR process = '')
    `);
    console.log(`✅ Updated ${result.rowCount} "Others" records with material/process = 'Others'`);
    
    // Verify the update
    const verify = await pool.query(`
      SELECT productgroup, material, process, COUNT(*) as cnt
      FROM fp_sales_rep_budget
      WHERE LOWER(productgroup) = 'others'
      GROUP BY productgroup, material, process
    `);
    
    console.log('\nVerification - Others records:');
    verify.rows.forEach(row => {
      console.log(`  ${row.productgroup}: material="${row.material}", process="${row.process}" (${row.cnt} records)`);
    });
    
    await pool.end();
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
})();
