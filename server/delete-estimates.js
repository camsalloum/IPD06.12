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
    console.log('🗑️  Deleting old estimate records...\n');
    
    const deleteQuery = `
      DELETE FROM public.fp_data_excel
      WHERE UPPER(type) = 'ESTIMATE'
    `;
    
    const result = await pool.query(deleteQuery);
    
    console.log(`✅ Deleted ${result.rowCount} estimate records`);
    console.log('\n💡 You can now create new estimates with the corrected calculation method.');
    
    await pool.end();
    
  } catch (err) {
    console.error('❌ Error:', err);
    await pool.end();
    process.exit(1);
  }
})();
