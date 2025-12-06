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
    console.log('\n📊 === MATERIAL/PROCESS MAPPINGS ===\n');
    
    const result = await pool.query(`
      SELECT DISTINCT product_group, material, process 
      FROM fp_material_percentages 
      ORDER BY product_group
    `);
    
    console.log('Product Group -> Material/Process:');
    result.rows.forEach(row => {
      console.log(`  "${row.product_group}": material="${row.material || '(empty)'}", process="${row.process || '(empty)'}"`);
    });
    
    console.log(`\nTotal: ${result.rows.length} product groups`);
    
    // Check if "Others" exists
    const othersCheck = await pool.query(`
      SELECT * FROM fp_material_percentages 
      WHERE LOWER(product_group) = 'others'
    `);
    
    console.log(`\n"Others" entries: ${othersCheck.rows.length}`);
    
    // Check current budget data
    console.log('\n📊 === CURRENT BUDGET DATA ===\n');
    const budgetData = await pool.query(`
      SELECT salesrepname, customername, productgroup, values_type, material, process, values
      FROM fp_sales_rep_budget
      ORDER BY salesrepname, customername, productgroup, values_type
      LIMIT 20
    `);
    
    budgetData.rows.forEach(row => {
      console.log(`${row.salesrepname} | ${row.customername} | ${row.productgroup} | ${row.values_type} | mat="${row.material || ''}" | proc="${row.process || ''}" | ${row.values}`);
    });
    
    await pool.end();
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
})();
