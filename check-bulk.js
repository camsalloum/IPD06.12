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
    // Check for bulk tables
    const tablesResult = await pool.query(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema='public' AND table_name LIKE '%bulk%'
    `);
    console.log('Bulk tables in database:');
    tablesResult.rows.forEach(row => console.log('  ', row.table_name));
    
    if (tablesResult.rows.length === 0) {
      console.log('  (none found)');
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

check();
