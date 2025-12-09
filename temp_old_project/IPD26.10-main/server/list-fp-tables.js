const { Pool } = require('pg');

const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'fp_database',
  password: process.env.DB_PASSWORD || '654883',
  port: 5432,
});

async function listTables() {
  try {
    const res = await pool.query(`
      SELECT tablename 
      FROM pg_tables 
      WHERE schemaname = 'public' 
      ORDER BY tablename
    `);
    
    console.log('All tables in fp_database:');
    res.rows.forEach(row => console.log(`- ${row.tablename}`));
    
    const fpTables = res.rows.filter(r => r.tablename.startsWith('fp_'));
    console.log(`\nTables starting with 'fp_': ${fpTables.length}`);
    
    const otherTables = res.rows.filter(r => !r.tablename.startsWith('fp_'));
    console.log(`Tables NOT starting with 'fp_': ${otherTables.length}`);
    otherTables.forEach(row => console.log(`  * ${row.tablename}`));
    
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

listTables();
