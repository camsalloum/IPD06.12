const { Pool } = require('pg');

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'fp_database',
  user: 'postgres',
  password: '654883'
});

async function checkTableStructures() {
  try {
    // Check common table structure
    console.log('📋 Common table (product_group_pricing_rounding) columns:');
    const commonCols = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'product_group_pricing_rounding'
      ORDER BY ordinal_position
    `);
    commonCols.rows.forEach(col => console.log(`   - ${col.column_name}: ${col.data_type}`));
    
    console.log('\n📋 Division table (fp_product_group_pricing_rounding) columns:');
    const fpCols = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'fp_product_group_pricing_rounding'
      ORDER BY ordinal_position
    `);
    fpCols.rows.forEach(col => console.log(`   - ${col.column_name}: ${col.data_type}`));
    
    // Show sample data from common table
    console.log('\n📊 Sample data from common table:');
    const sampleData = await pool.query(`
      SELECT * FROM product_group_pricing_rounding LIMIT 2
    `);
    console.log(sampleData.rows);
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    pool.end();
  }
}

checkTableStructures();
