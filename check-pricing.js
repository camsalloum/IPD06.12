const { pool } = require('./server/database/config');

(async () => {
  try {
    const r = await pool.query(`
      SELECT product_group, asp_round, morm_round 
      FROM product_group_pricing_rounding 
      WHERE UPPER(division) = 'FP' AND year = 2025 
      LIMIT 10
    `);
    console.log('Pricing data for FP 2025:');
    console.table(r.rows);
  } catch(e) { 
    console.error('Error:', e.message); 
  } finally { 
    await pool.end(); 
  }
})();
