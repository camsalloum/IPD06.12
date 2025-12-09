const { Pool } = require('pg');

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'fp_database',
  user: 'postgres',
  password: '654883'
});

async function migrateAllTables() {
  const client = await pool.connect();
  
  try {
    console.log('═'.repeat(70));
    console.log('📊 COMPREHENSIVE TABLE MIGRATION');
    console.log('═'.repeat(70));
    console.log('Creating division-specific tables and migrating data...\n');
    
    await client.query('BEGIN');
    
    // 1. Customer Merge Rules
    console.log('─'.repeat(50));
    console.log('1️⃣  customer_merge_rules → fp_customer_merge_rules');
    
    // Check if fp table exists
    const fpMergeRulesExists = await client.query(`
      SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'fp_customer_merge_rules')
    `);
    
    if (!fpMergeRulesExists.rows[0].exists) {
      await client.query(`
        CREATE TABLE fp_customer_merge_rules (
          id SERIAL PRIMARY KEY,
          division VARCHAR(50),
          source_customer VARCHAR(500),
          target_customer VARCHAR(500),
          source_country VARCHAR(255),
          target_country VARCHAR(255),
          is_active BOOLEAN DEFAULT true,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          created_by VARCHAR(255),
          notes TEXT
        )
      `);
      console.log('   ✅ Created fp_customer_merge_rules table');
    }
    
    // Migrate data
    const mergeRulesResult = await client.query(`
      INSERT INTO fp_customer_merge_rules (division, source_customer, target_customer, source_country, target_country, is_active, created_at, updated_at, created_by, notes)
      SELECT division, source_customer, target_customer, source_country, target_country, is_active, created_at, updated_at, created_by, notes
      FROM customer_merge_rules
      WHERE UPPER(COALESCE(division, 'FP')) = 'FP' OR division IS NULL
      ON CONFLICT DO NOTHING
    `);
    console.log(`   ✅ Migrated ${mergeRulesResult.rowCount} rows`);
    
    // 2. Merge Rule Suggestions
    console.log('\n─'.repeat(50));
    console.log('2️⃣  merge_rule_suggestions → fp_merge_rule_suggestions');
    
    const fpSuggestionsExists = await client.query(`
      SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'fp_merge_rule_suggestions')
    `);
    
    if (!fpSuggestionsExists.rows[0].exists) {
      await client.query(`
        CREATE TABLE fp_merge_rule_suggestions (
          id SERIAL PRIMARY KEY,
          division VARCHAR(50),
          source_customer VARCHAR(500),
          target_customer VARCHAR(500),
          source_country VARCHAR(255),
          target_country VARCHAR(255),
          similarity_score NUMERIC(5,2),
          status VARCHAR(50) DEFAULT 'pending',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          reviewed_by VARCHAR(255),
          reviewed_at TIMESTAMP
        )
      `);
      console.log('   ✅ Created fp_merge_rule_suggestions table');
    }
    
    const suggestionsResult = await client.query(`
      INSERT INTO fp_merge_rule_suggestions (division, source_customer, target_customer, source_country, target_country, similarity_score, status, created_at, updated_at, reviewed_by, reviewed_at)
      SELECT division, source_customer, target_customer, source_country, target_country, similarity_score, status, created_at, updated_at, reviewed_by, reviewed_at
      FROM merge_rule_suggestions
      WHERE UPPER(COALESCE(division, 'FP')) = 'FP' OR division IS NULL
      ON CONFLICT DO NOTHING
    `);
    console.log(`   ✅ Migrated ${suggestionsResult.rowCount} rows`);
    
    // 3. Merge Rule Notifications (empty, just create)
    console.log('\n─'.repeat(50));
    console.log('3️⃣  Creating fp_merge_rule_notifications (empty)');
    
    const fpNotificationsExists = await client.query(`
      SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'fp_merge_rule_notifications')
    `);
    
    if (!fpNotificationsExists.rows[0].exists) {
      await client.query(`
        CREATE TABLE fp_merge_rule_notifications (
          id SERIAL PRIMARY KEY,
          division VARCHAR(50),
          rule_id INTEGER,
          notification_type VARCHAR(100),
          message TEXT,
          is_read BOOLEAN DEFAULT false,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      console.log('   ✅ Created fp_merge_rule_notifications table');
    } else {
      console.log('   ℹ️  Table already exists');
    }
    
    // 4. Merge Rule Rejections (empty, just create)
    console.log('\n─'.repeat(50));
    console.log('4️⃣  Creating fp_merge_rule_rejections (empty)');
    
    const fpRejectionsExists = await client.query(`
      SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'fp_merge_rule_rejections')
    `);
    
    if (!fpRejectionsExists.rows[0].exists) {
      await client.query(`
        CREATE TABLE fp_merge_rule_rejections (
          id SERIAL PRIMARY KEY,
          division VARCHAR(50),
          suggestion_id INTEGER,
          reason TEXT,
          rejected_by VARCHAR(255),
          rejected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      console.log('   ✅ Created fp_merge_rule_rejections table');
    } else {
      console.log('   ℹ️  Table already exists');
    }
    
    // 5. Sales Rep Budget (empty, just create)
    console.log('\n─'.repeat(50));
    console.log('5️⃣  Creating fp_sales_rep_budget (empty)');
    
    const fpSalesRepBudgetExists = await client.query(`
      SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'fp_sales_rep_budget')
    `);
    
    if (!fpSalesRepBudgetExists.rows[0].exists) {
      await client.query(`
        CREATE TABLE fp_sales_rep_budget (
          id SERIAL PRIMARY KEY,
          division VARCHAR(50),
          budget_year INTEGER,
          month INTEGER,
          type VARCHAR(50),
          salesrepname VARCHAR(255),
          customername VARCHAR(500),
          countryname VARCHAR(255),
          productgroup VARCHAR(255),
          values_type VARCHAR(50),
          values NUMERIC(20,4),
          material VARCHAR(255),
          process VARCHAR(255),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      console.log('   ✅ Created fp_sales_rep_budget table');
    } else {
      console.log('   ℹ️  Table already exists');
    }
    
    // 6. Sales Rep Budget Draft (empty, just create)
    console.log('\n─'.repeat(50));
    console.log('6️⃣  Creating fp_sales_rep_budget_draft (empty)');
    
    const fpSalesRepDraftExists = await client.query(`
      SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'fp_sales_rep_budget_draft')
    `);
    
    if (!fpSalesRepDraftExists.rows[0].exists) {
      await client.query(`
        CREATE TABLE fp_sales_rep_budget_draft (
          id SERIAL PRIMARY KEY,
          division VARCHAR(50),
          budget_year INTEGER,
          month INTEGER,
          salesrepname VARCHAR(255),
          customername VARCHAR(500),
          countryname VARCHAR(255),
          productgroup VARCHAR(255),
          values_type VARCHAR(50),
          values NUMERIC(20,4),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      console.log('   ✅ Created fp_sales_rep_budget_draft table');
    } else {
      console.log('   ℹ️  Table already exists');
    }
    
    // 7. Database Upload Log (empty, just create)
    console.log('\n─'.repeat(50));
    console.log('7️⃣  Creating fp_database_upload_log (empty)');
    
    const fpUploadLogExists = await client.query(`
      SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'fp_database_upload_log')
    `);
    
    if (!fpUploadLogExists.rows[0].exists) {
      await client.query(`
        CREATE TABLE fp_database_upload_log (
          id SERIAL PRIMARY KEY,
          division VARCHAR(50),
          upload_type VARCHAR(100),
          file_name VARCHAR(500),
          records_count INTEGER,
          status VARCHAR(50),
          uploaded_by VARCHAR(255),
          uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          error_message TEXT
        )
      `);
      console.log('   ✅ Created fp_database_upload_log table');
    } else {
      console.log('   ℹ️  Table already exists');
    }
    
    // 8. Customer Similarity Cache (empty, just create)
    console.log('\n─'.repeat(50));
    console.log('8️⃣  Creating fp_customer_similarity_cache (empty)');
    
    const fpSimilarityCacheExists = await client.query(`
      SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'fp_customer_similarity_cache')
    `);
    
    if (!fpSimilarityCacheExists.rows[0].exists) {
      await client.query(`
        CREATE TABLE fp_customer_similarity_cache (
          id SERIAL PRIMARY KEY,
          division VARCHAR(50),
          customer1 VARCHAR(500),
          customer2 VARCHAR(500),
          similarity_score NUMERIC(5,2),
          computed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      console.log('   ✅ Created fp_customer_similarity_cache table');
    } else {
      console.log('   ℹ️  Table already exists');
    }
    
    await client.query('COMMIT');
    
    console.log('\n' + '═'.repeat(70));
    console.log('✅ MIGRATION COMPLETE!');
    console.log('═'.repeat(70));
    
    // Verify final state
    console.log('\n📋 VERIFICATION:');
    const verifyTables = [
      'fp_customer_merge_rules',
      'fp_merge_rule_suggestions',
      'fp_merge_rule_notifications',
      'fp_merge_rule_rejections',
      'fp_sales_rep_budget',
      'fp_sales_rep_budget_draft',
      'fp_database_upload_log',
      'fp_customer_similarity_cache'
    ];
    
    for (const table of verifyTables) {
      const result = await client.query(`SELECT COUNT(*) as count FROM ${table}`);
      console.log(`   ${table}: ${result.rows[0].count} rows`);
    }
    
    console.log('\n⚠️  Old common tables still exist. Run cleanup after confirming migration.');
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('\n❌ Migration failed:', error.message);
    throw error;
  } finally {
    client.release();
    pool.end();
  }
}

migrateAllTables();
