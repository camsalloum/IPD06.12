const { Pool } = require('pg');

const pool = new Pool({
  host: 'localhost',
  database: 'fp_database',
  user: 'postgres',
  password: '654883',
  port: 5432
});

async function checkColumns() {
  try {
    const result = await pool.query(
      `SELECT * 
       FROM fp_material_percentages 
       WHERE UPPER(TRIM(product_group)) = 'COMMERCIAL ITEMS PLAIN'`
    );
    
    console.log('Found rows:', result.rows.length);
    console.log('\nData:', JSON.stringify(result.rows, null, 2));
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkColumns();
