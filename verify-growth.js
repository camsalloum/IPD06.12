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
    // Get 2025 Estimate data
    const estimate = await pool.query(`
      SELECT productgroup, SUM(CAST(amount AS DECIMAL)) as total 
      FROM fp_data_excel 
      WHERE year = 2025 AND type = 'Estimate' 
      GROUP BY productgroup 
      ORDER BY total DESC 
      LIMIT 10
    `);
    
    console.log('=== 2025 FY ESTIMATE (Current Period) ===');
    estimate.rows.forEach(r => {
      console.log(`${r.productgroup}: $${parseFloat(r.total).toLocaleString()}`);
    });
    
    // Get 2025 Actual data
    const actual = await pool.query(`
      SELECT productgroup, SUM(CAST(amount AS DECIMAL)) as total 
      FROM fp_data_excel 
      WHERE year = 2025 AND type = 'Actual' 
      GROUP BY productgroup 
      ORDER BY total DESC 
      LIMIT 10
    `);
    
    console.log('\n=== 2025 FY ACTUAL (Comparison Period) ===');
    actual.rows.forEach(r => {
      console.log(`${r.productgroup}: $${parseFloat(r.total).toLocaleString()}`);
    });
    
    // Calculate growth
    console.log('\n=== GROWTH CALCULATION ===');
    estimate.rows.forEach(est => {
      const act = actual.rows.find(a => a.productgroup === est.productgroup);
      if (act) {
        const growth = ((parseFloat(est.total) - parseFloat(act.total)) / parseFloat(act.total)) * 100;
        console.log(`${est.productgroup}: ${growth.toFixed(1)}% growth`);
        console.log(`  Estimate: $${parseFloat(est.total).toLocaleString()}`);
        console.log(`  Actual: $${parseFloat(act.total).toLocaleString()}`);
      } else {
        console.log(`${est.productgroup}: No actual data for comparison`);
      }
    });
    
    await pool.end();
  } catch(e) {
    console.error('Error:', e.message);
    process.exit(1);
  }
})();
