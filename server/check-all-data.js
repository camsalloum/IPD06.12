const { Pool } = require('pg');

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'fp_database',
  user: 'postgres',
  password: '654883'
});

async function check() {
  try {
    // Check pricing data
    const pricing = await pool.query(`
      SELECT DISTINCT product_group, year, asp_round, morm_round 
      FROM fp_product_group_pricing_rounding 
      ORDER BY year DESC, product_group
      LIMIT 20
    `);
    console.log('=== FP Pricing Data ===');
    pricing.rows.forEach(r => console.log(`  ${r.year} - ${r.product_group}: ASP=${r.asp_round}, MoRM=${r.morm_round}`));
    
    // Check material percentages
    const materials = await pool.query(`
      SELECT product_group, material, process 
      FROM fp_material_percentages
      LIMIT 10
    `);
    console.log('\n=== FP Material Percentages ===');
    materials.rows.forEach(r => console.log(`  ${r.product_group}: Material=${r.material}, Process=${r.process}`));
    
    // Check draft data
    const draftData = await pool.query(`
      SELECT salesrepname, customername, productgroup, month, values 
      FROM fp_sales_rep_budget_draft
      LIMIT 10
    `);
    console.log('\n=== Draft Data ===');
    draftData.rows.forEach((row, i) => {
      console.log(`  ${row.salesrepname} | ${row.customername} | ${row.productgroup} | Month ${row.month}: ${row.values}`);
    });
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

check();
