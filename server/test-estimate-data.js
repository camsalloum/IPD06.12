const { Pool } = require('pg');

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'fp_database',
  user: 'postgres',
  password: '654883'
});

async function checkData() {
  try {
    console.log('Checking available Actual data for FP division...\n');
    
    const result = await pool.query(`
      SELECT year, month, COUNT(*) as count
      FROM public.fp_data_excel
      WHERE UPPER(division) = 'FP' AND UPPER(type) = 'ACTUAL'
      GROUP BY year, month
      ORDER BY year DESC, month DESC
      LIMIT 12
    `);
    
    console.log('Available months with Actual data:');
    result.rows.forEach(row => {
      console.log(`  📅 ${row.year}-${String(row.month).padStart(2, '0')}: ${row.count} records`);
    });
    
    console.log('\n✅ You can create estimates for months that are NOT in the above list');
    console.log('📊 Example: If you have Jan-Oct 2025, you can estimate Nov-Dec 2025');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkData();
