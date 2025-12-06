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
    // List all tables
    const tables = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);
    console.log('=== All Tables in fp_database ===');
    tables.rows.forEach(t => console.log('  ', t.table_name));
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

check();
