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
    // Check what pricing tables exist
    const tablesResult = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_name LIKE '%pricing%' 
      ORDER BY table_name
    `);
    console.log('Pricing tables found:', tablesResult.rows.map(x => x.table_name));
    
    // Check if fp_product_group_pricing_rounding exists
    const fpTableResult = await pool.query(`
      SELECT COUNT(*) as count 
      FROM information_schema.tables 
      WHERE table_name = 'fp_product_group_pricing_rounding'
    `);
    console.log('\nfp_product_group_pricing_rounding exists:', parseInt(fpTableResult.rows[0].count) > 0);
    
    // Check the old common table
    const commonTableResult = await pool.query(`
      SELECT COUNT(*) as count 
      FROM information_schema.tables 
      WHERE table_name = 'product_group_pricing_rounding'
    `);
    console.log('product_group_pricing_rounding (common) exists:', parseInt(commonTableResult.rows[0].count) > 0);
    
    // If the division-specific table exists, check its data
    if (parseInt(fpTableResult.rows[0].count) > 0) {
      const dataResult = await pool.query(`
        SELECT division, year, COUNT(*) as count 
        FROM fp_product_group_pricing_rounding 
        GROUP BY division, year
        ORDER BY year DESC
      `);
      console.log('\nfp_product_group_pricing_rounding data:');
      console.log(dataResult.rows);
    }
    
    // If the common table exists, check its data
    if (parseInt(commonTableResult.rows[0].count) > 0) {
      const commonDataResult = await pool.query(`
        SELECT division, year, COUNT(*) as count 
        FROM product_group_pricing_rounding 
        GROUP BY division, year
        ORDER BY year DESC
      `);
      console.log('\nproduct_group_pricing_rounding (common) data:');
      console.log(commonDataResult.rows);
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    pool.end();
  }
})();
