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
    // First, check what months exist for each type
    console.log('=== CHECKING AVAILABLE MONTHS BY TYPE ===\n');
    
    const monthCheck = await pool.query(`
      SELECT type, year, month, COUNT(*) as record_count
      FROM fp_data_excel 
      WHERE year = 2025
      GROUP BY type, year, month
      ORDER BY type, year, month
    `);
    
    console.log('Available data by month:');
    let currentType = '';
    monthCheck.rows.forEach(r => {
      if (r.type !== currentType) {
        currentType = r.type;
        console.log(`\n${r.type}:`);
      }
      console.log(`  Month ${r.month}: ${r.record_count} records`);
    });
    
    // Get 2025 Estimate data (FY = all 12 months)
    const estimate = await pool.query(`
      SELECT productgroup, 
             SUM(CASE WHEN values_type = 'AMOUNT' THEN values ELSE 0 END) as total_sales,
             SUM(CASE WHEN values_type = 'KGS' THEN values ELSE 0 END) as total_kgs
      FROM fp_data_excel 
      WHERE year = 2025 
        AND UPPER(type) = 'ESTIMATE'
        AND productgroup IS NOT NULL
        AND TRIM(productgroup) != ''
      GROUP BY productgroup 
      ORDER BY total_sales DESC 
      LIMIT 10
    `);
    
    console.log('\n\n=== 2025 FY ESTIMATE (Current Period) ===');
    estimate.rows.forEach(r => {
      console.log(`${r.productgroup}: $${parseFloat(r.total_sales).toLocaleString()} (${parseFloat(r.total_kgs).toLocaleString()} kgs)`);
    });
    
    // Get 2025 Actual data
    const actual = await pool.query(`
      SELECT productgroup, 
             SUM(CASE WHEN values_type = 'AMOUNT' THEN values ELSE 0 END) as total_sales,
             SUM(CASE WHEN values_type = 'KGS' THEN values ELSE 0 END) as total_kgs
      FROM fp_data_excel 
      WHERE year = 2025 
        AND UPPER(type) = 'ACTUAL'
        AND productgroup IS NOT NULL
        AND TRIM(productgroup) != ''
      GROUP BY productgroup 
      ORDER BY total_sales DESC 
      LIMIT 10
    `);
    
    console.log('\n=== 2025 FY ACTUAL (Comparison Period) ===');
    actual.rows.forEach(r => {
      console.log(`${r.productgroup}: $${parseFloat(r.total_sales).toLocaleString()} (${parseFloat(r.total_kgs).toLocaleString()} kgs)`);
    });
    
    // Calculate growth for top 10 products by Estimate sales
    console.log('\n=== GROWTH CALCULATION (Estimate vs Actual) ===');
    console.log('NOTE: Negative values indicate DECLINE from Actual to Estimate\n');
    estimate.rows.forEach(est => {
      const act = actual.rows.find(a => a.productgroup === est.productgroup);
      if (act) {
        const growth = ((parseFloat(est.total_sales) - parseFloat(act.total_sales)) / parseFloat(act.total_sales)) * 100;
        console.log(`${est.productgroup}:`);
        console.log(`  Change: ${growth.toFixed(1)}% ${growth < 0 ? 'DECLINE' : 'GROWTH'}`);
        console.log(`  Estimate: $${parseFloat(est.total_sales).toLocaleString()}`);
        console.log(`  Actual:   $${parseFloat(act.total_sales).toLocaleString()}`);
      } else {
        console.log(`\n${est.productgroup}: No actual data for comparison`);
      }
    });
    
    await pool.end();
  } catch(e) {
    console.error('Error:', e.message);
    console.error('Stack:', e.stack);
    process.exit(1);
  }
})();
