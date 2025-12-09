const { Pool } = require('pg');

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'fp_database',
  user: 'postgres',
  password: '654883'
});

async function checkAllTables() {
  try {
    console.log('═'.repeat(70));
    console.log('📊 CHECKING ALL TABLES FOR MIGRATION NEEDS');
    console.log('═'.repeat(70));
    
    // Get all tables
    const tablesResult = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);
    
    const allTables = tablesResult.rows.map(r => r.table_name);
    
    // Tables that should be division-specific (based on getTableNames function)
    const divisionSpecificPatterns = [
      'data_excel',
      'material_percentages',
      'divisional_budget',
      'sales_rep_budget',
      'sales_rep_budget_draft',
      'product_group_pricing_rounding',
      'customer_merge_rules',
      'merge_rule_suggestions',
      'merge_rule_notifications',
      'merge_rule_rejections',
      'database_upload_log',
      'customer_similarity_cache'
    ];
    
    console.log('\n📋 Division-Specific Tables (should have fp_ prefix):');
    console.log('─'.repeat(70));
    
    for (const pattern of divisionSpecificPatterns) {
      const commonTable = pattern;
      const fpTable = `fp_${pattern}`;
      
      const commonExists = allTables.includes(commonTable);
      const fpExists = allTables.includes(fpTable);
      
      let commonCount = 0;
      let fpCount = 0;
      
      if (commonExists) {
        const result = await pool.query(`SELECT COUNT(*) as count FROM ${commonTable}`);
        commonCount = parseInt(result.rows[0].count);
      }
      
      if (fpExists) {
        const result = await pool.query(`SELECT COUNT(*) as count FROM ${fpTable}`);
        fpCount = parseInt(result.rows[0].count);
      }
      
      // Determine status
      let status = '';
      if (commonExists && commonCount > 0 && fpCount === 0) {
        status = '⚠️  NEEDS MIGRATION';
      } else if (commonExists && commonCount > 0 && fpCount > 0) {
        status = '⚠️  BOTH HAVE DATA';
      } else if (!commonExists && fpExists && fpCount > 0) {
        status = '✅ OK (division-specific only)';
      } else if (fpExists && fpCount === 0 && !commonExists) {
        status = '⚠️  EMPTY (no common table)';
      } else if (fpExists && fpCount === 0 && commonExists && commonCount === 0) {
        status = '⚠️  BOTH EMPTY';
      } else if (!fpExists && commonExists) {
        status = '❌ NO FP TABLE (common only)';
      } else {
        status = '❓ Unknown';
      }
      
      console.log(`\n${pattern}:`);
      console.log(`   Common (${commonTable}): ${commonExists ? `EXISTS (${commonCount} rows)` : 'NOT EXISTS'}`);
      console.log(`   FP (${fpTable}): ${fpExists ? `EXISTS (${fpCount} rows)` : 'NOT EXISTS'}`);
      console.log(`   Status: ${status}`);
    }
    
    // Also check for any other common tables that might need attention
    console.log('\n\n📋 Other Tables (not division-specific):');
    console.log('─'.repeat(70));
    
    const otherTables = allTables.filter(t => 
      !t.startsWith('fp_') && 
      !t.startsWith('pp_') &&
      !divisionSpecificPatterns.includes(t)
    );
    
    for (const table of otherTables) {
      const result = await pool.query(`SELECT COUNT(*) as count FROM ${table}`);
      const count = parseInt(result.rows[0].count);
      console.log(`   ${table}: ${count} rows`);
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    pool.end();
  }
}

checkAllTables();
