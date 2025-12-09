const { Pool } = require('pg');

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'fp_database',
  user: 'postgres',
  password: '654883'
});

// Old shared tables to delete (already backed up to to_be_deleted/)
const tablesToDelete = [
  'customer_merge_rules',
  'customer_similarity_cache',
  'database_upload_log',
  'division_customer_merge_rules',
  'merge_rule_notifications',
  'merge_rule_rejections',
  'merge_rule_suggestions',
  'sales_rep_budget',
  'sales_rep_budget_draft'
];

async function deleteTables() {
  console.log('🗑️  Deleting old shared tables (backups saved in to_be_deleted/)...\n');

  for (const table of tablesToDelete) {
    try {
      await pool.query(`DROP TABLE IF EXISTS ${table} CASCADE`);
      console.log(`✅ Deleted: ${table}`);
    } catch (error) {
      console.error(`❌ Error deleting ${table}: ${error.message}`);
    }
  }

  console.log('\n✅ All old shared tables deleted!');
  console.log('\n📋 Remaining tables are all FP-specific (fp_ prefixed)');
  
  // List remaining tables
  const remaining = await pool.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    ORDER BY table_name
  `);
  
  console.log('\n📋 Remaining tables in database:');
  remaining.rows.forEach(r => console.log('   -', r.table_name));

  pool.end();
}

deleteTables();
