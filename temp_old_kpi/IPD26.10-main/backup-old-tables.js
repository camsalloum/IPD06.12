const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'fp_database',
  user: 'postgres',
  password: '654883'
});

// Tables to backup (old shared tables)
const tablesToBackup = [
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

async function backupTables() {
  const backupDir = path.join(__dirname, 'to_be_deleted');
  
  // Create backup directory
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
    console.log('📁 Created backup directory: to_be_deleted/\n');
  }

  console.log('🔄 Backing up old shared tables...\n');

  for (const table of tablesToBackup) {
    try {
      // Check if table exists
      const exists = await pool.query(`
        SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = $1)
      `, [table]);

      if (!exists.rows[0].exists) {
        console.log(`⏭️  ${table}: table does not exist, skipping`);
        continue;
      }

      // Get row count
      const countResult = await pool.query(`SELECT COUNT(*) FROM ${table}`);
      const rowCount = parseInt(countResult.rows[0].count);

      // Get all data
      const dataResult = await pool.query(`SELECT * FROM ${table}`);
      
      // Get column info
      const columnsResult = await pool.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = $1 
        ORDER BY ordinal_position
      `, [table]);

      // Create backup object
      const backup = {
        table_name: table,
        backed_up_at: new Date().toISOString(),
        row_count: rowCount,
        columns: columnsResult.rows,
        data: dataResult.rows
      };

      // Write to JSON file
      const filename = path.join(backupDir, `${table}_backup.json`);
      fs.writeFileSync(filename, JSON.stringify(backup, null, 2));

      console.log(`✅ ${table}: ${rowCount} rows backed up to ${table}_backup.json`);

    } catch (error) {
      console.error(`❌ ${table}: Error - ${error.message}`);
    }
  }

  // Create summary file
  const summary = {
    backup_date: new Date().toISOString(),
    tables_backed_up: tablesToBackup,
    purpose: 'Old shared tables replaced by division-specific fp_ prefixed tables',
    note: 'These tables can be deleted after verifying the fp_ tables work correctly',
    deletion_command: `
-- Run this SQL to delete old shared tables after verification:
${tablesToBackup.map(t => `DROP TABLE IF EXISTS ${t} CASCADE;`).join('\n')}
    `
  };
  
  fs.writeFileSync(
    path.join(backupDir, 'BACKUP_SUMMARY.json'), 
    JSON.stringify(summary, null, 2)
  );

  console.log('\n📋 Created BACKUP_SUMMARY.json with deletion instructions');
  console.log('\n✅ Backup complete! Files saved to: to_be_deleted/');
  console.log('\n⚠️  After verifying everything works, you can delete the old tables.');

  pool.end();
}

backupTables();
