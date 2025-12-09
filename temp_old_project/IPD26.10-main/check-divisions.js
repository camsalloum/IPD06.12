const { Pool } = require('pg');

async function checkDivisions() {
  const databases = ['fp_database', 'hc_database', 'tf_database', 'sb_database', 'hcm_database'];
  
  for (const dbName of databases) {
    console.log(`\n${'='.repeat(50)}`);
    console.log(`📁 Checking database: ${dbName}`);
    console.log('='.repeat(50));
    
    const pool = new Pool({
      host: 'localhost',
      port: 5432,
      database: dbName,
      user: 'postgres',
      password: '654883'
    });
    
    try {
      const tablesResult = await pool.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        ORDER BY table_name
      `);
      
      if (tablesResult.rows.length === 0) {
        console.log('  (empty database)');
      } else {
        console.log(`  Tables (${tablesResult.rows.length}):`);
        tablesResult.rows.forEach(r => console.log('    -', r.table_name));
      }
      
    } catch (error) {
      if (error.message.includes('does not exist')) {
        console.log('  ❌ Database does not exist');
      } else {
        console.log('  ❌ Error:', error.message);
      }
    } finally {
      try { await pool.end(); } catch(e) {}
    }
  }
}

checkDivisions();
