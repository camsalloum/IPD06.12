const { Pool } = require('pg');

const pool = new Pool({
  host: 'localhost',
  database: 'fp_database',
  user: 'postgres',
  password: '654883',
  port: 5432
});

async function checkProductGroupCase() {
  try {
    // Check pricing table
    const pricingResult = await pool.query(
      `SELECT DISTINCT product_group 
       FROM product_group_pricing_rounding 
       WHERE product_group ILIKE '%commercial%items%plain%'`
    );
    
    console.log('Product groups in PRICING table:');
    pricingResult.rows.forEach(row => {
      console.log(`  "${row.product_group}"`);
    });
    
    // Check material percentages table
    const materialResult = await pool.query(
      `SELECT DISTINCT product_group, material, process 
       FROM fp_material_percentages 
       WHERE product_group ILIKE '%commercial%items%plain%'`
    );
    
    console.log('\nProduct groups in MATERIAL PERCENTAGES table:');
    materialResult.rows.forEach(row => {
      console.log(`  "${row.product_group}" - Material: "${row.material}", Process: "${row.process}"`);
    });
    
    // Check budget table
    const budgetResult = await pool.query(
      `SELECT DISTINCT product_group 
       FROM sales_rep_budget 
       WHERE product_group ILIKE '%commercial%items%plain%'`
    );
    
    console.log('\nProduct groups in BUDGET table:');
    budgetResult.rows.forEach(row => {
      console.log(`  "${row.product_group}"`);
    });
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkProductGroupCase();
