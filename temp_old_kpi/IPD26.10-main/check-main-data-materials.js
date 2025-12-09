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
    // Check distinct materials in the main data table
    console.log('=== DISTINCT MATERIALS IN fp_data_excel ===');
    const materials = await pool.query(`
      SELECT DISTINCT material, COUNT(*) as cnt 
      FROM fp_data_excel 
      WHERE material IS NOT NULL 
      GROUP BY material 
      ORDER BY material
    `);
    materials.rows.forEach(r => console.log(`  "${r.material || '(empty)'}": ${r.cnt} records`));
    
    console.log('\n=== DISTINCT PROCESSES IN fp_data_excel ===');
    const processes = await pool.query(`
      SELECT DISTINCT process, COUNT(*) as cnt 
      FROM fp_data_excel 
      WHERE process IS NOT NULL 
      GROUP BY process 
      ORDER BY process
    `);
    processes.rows.forEach(r => console.log(`  "${r.process || '(empty)'}": ${r.cnt} records`));
    
    // Check if Others product group has material/process
    console.log('\n=== OTHERS PRODUCT GROUP IN fp_data_excel ===');
    const others = await pool.query(`
      SELECT DISTINCT productgroup, material, process, COUNT(*) as cnt 
      FROM fp_data_excel 
      WHERE LOWER(productgroup) = 'others'
      GROUP BY productgroup, material, process
    `);
    if (others.rows.length === 0) {
      console.log('  No "Others" product group found in fp_data_excel');
    } else {
      others.rows.forEach(r => console.log(`  PG="${r.productgroup}" | material="${r.material}" | process="${r.process}" | ${r.cnt} records`));
    }
    
    await pool.end();
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
})();
