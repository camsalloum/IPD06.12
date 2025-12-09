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
    // Check pricing data for FP division
    const pricing = await pool.query(`
      SELECT DISTINCT product_group, year, asp_round, morm_round 
      FROM fp_pricing_rounding 
      WHERE UPPER(division) = 'FP'
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
    
    // Check draft table structure
    const draftCols = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'fp_sales_rep_budget_draft'
      ORDER BY ordinal_position
    `);
    console.log('\n=== Draft Table Columns ===');
    draftCols.rows.forEach(c => console.log('  ', c.column_name));
    
    // Check draft data
    const draftData = await pool.query(`
      SELECT * FROM fp_sales_rep_budget_draft
      LIMIT 5
    `);
    console.log('\n=== Draft Data (sample) ===');
    draftData.rows.forEach((row, i) => {
      console.log(`\nDraft Row ${i + 1}:`);
      Object.keys(row).forEach(k => console.log(`  ${k}: ${row[k]}`));
    });
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

check();
