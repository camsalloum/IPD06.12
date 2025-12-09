const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://postgres:654883@localhost:5432/fp_database' });

(async () => {
  try {
    // Clear existing test budget data
    await pool.query(`DELETE FROM fp_sales_rep_budget WHERE budget_year >= 2025`);
    await pool.query(`DELETE FROM fp_budget_bulk_import WHERE budget_year >= 2025`);
    console.log('✅ Cleared existing test data');
    
    // Show pricing data availability
    const pricing = await pool.query(
      `SELECT COUNT(*) as cnt FROM fp_product_group_pricing_rounding WHERE year = 2025`
    );
    console.log('📊 Pricing records for 2025:', pricing.rows[0].cnt);
    
    await pool.end();
  } catch (err) {
    console.error('❌ Error:', err.message);
  }
})();
