const { Pool } = require('pg');

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'fp_database',
  user: 'postgres',
  password: '654883'
});

async function migrateAllTables() {
  console.log('🚀 Starting FIXED table migration to division-specific tables...\n');
  
  try {
    // ============================================
    // 1. customer_merge_rules → fp_customer_merge_rules
    // ============================================
    console.log('1️⃣  customer_merge_rules → fp_customer_merge_rules');
    
    // Check if fp_ table exists
    const fpMergeRulesExists = await pool.query(`
      SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'fp_customer_merge_rules')
    `);
    
    if (!fpMergeRulesExists.rows[0].exists) {
      // Create with SAME structure as common table
      await pool.query(`
        CREATE TABLE fp_customer_merge_rules (
          id SERIAL PRIMARY KEY,
          sales_rep VARCHAR(255),
          division VARCHAR(50),
          merged_customer_name VARCHAR(255),
          original_customers JSONB,
          is_active BOOLEAN DEFAULT true,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          migrated_to_division BOOLEAN DEFAULT false,
          UNIQUE(sales_rep, division, merged_customer_name)
        )
      `);
      console.log('   ✅ Created fp_customer_merge_rules table');
    } else {
      console.log('   ⏭️  fp_customer_merge_rules already exists');
    }
    
    // Migrate FP data with correct columns
    const mergeRulesResult = await pool.query(`
      INSERT INTO fp_customer_merge_rules (sales_rep, division, merged_customer_name, original_customers, is_active, created_at, updated_at, migrated_to_division)
      SELECT sales_rep, division, merged_customer_name, original_customers, is_active, created_at, updated_at, true
      FROM customer_merge_rules 
      WHERE division = 'FP'
      ON CONFLICT (sales_rep, division, merged_customer_name) DO NOTHING
    `);
    console.log(`   ✅ Migrated ${mergeRulesResult.rowCount} rows to fp_customer_merge_rules\n`);

    // ============================================
    // 2. merge_rule_suggestions → fp_merge_rule_suggestions
    // ============================================
    console.log('2️⃣  merge_rule_suggestions → fp_merge_rule_suggestions');
    
    const fpSuggestionsExists = await pool.query(`
      SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'fp_merge_rule_suggestions')
    `);
    
    if (!fpSuggestionsExists.rows[0].exists) {
      await pool.query(`
        CREATE TABLE fp_merge_rule_suggestions (
          id SERIAL PRIMARY KEY,
          division VARCHAR(50),
          suggested_merge_name VARCHAR(255),
          customer_group JSONB,
          confidence_score NUMERIC,
          matching_algorithm VARCHAR(100),
          match_details JSONB,
          admin_action VARCHAR(50),
          suggested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          reviewed_at TIMESTAMP,
          reviewed_by VARCHAR(255),
          feedback_notes TEXT,
          was_correct BOOLEAN,
          created_rule_id INTEGER
        )
      `);
      console.log('   ✅ Created fp_merge_rule_suggestions table');
    } else {
      console.log('   ⏭️  fp_merge_rule_suggestions already exists');
    }
    
    const suggestionsResult = await pool.query(`
      INSERT INTO fp_merge_rule_suggestions (division, suggested_merge_name, customer_group, confidence_score, matching_algorithm, match_details, admin_action, suggested_at, reviewed_at, reviewed_by, feedback_notes, was_correct, created_rule_id)
      SELECT division, suggested_merge_name, customer_group, confidence_score, matching_algorithm, match_details, admin_action, suggested_at, reviewed_at, reviewed_by, feedback_notes, was_correct, created_rule_id
      FROM merge_rule_suggestions 
      WHERE division = 'FP'
      ON CONFLICT DO NOTHING
    `);
    console.log(`   ✅ Migrated ${suggestionsResult.rowCount} rows to fp_merge_rule_suggestions\n`);

    // ============================================
    // 3. Create empty fp_ tables for tables with no data
    // ============================================
    console.log('3️⃣  Creating empty fp_ prefixed tables...');
    
    // Check and create fp_merge_rule_notifications
    const fpNotificationsExists = await pool.query(`
      SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'fp_merge_rule_notifications')
    `);
    if (!fpNotificationsExists.rows[0].exists) {
      await pool.query(`
        CREATE TABLE fp_merge_rule_notifications (
          id SERIAL PRIMARY KEY,
          division VARCHAR(50),
          notification_type VARCHAR(100),
          message TEXT,
          is_read BOOLEAN DEFAULT false,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          read_at TIMESTAMP
        )
      `);
      console.log('   ✅ Created fp_merge_rule_notifications');
    } else {
      console.log('   ⏭️  fp_merge_rule_notifications already exists');
    }

    // Check and create fp_merge_rule_rejections
    const fpRejectionsExists = await pool.query(`
      SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'fp_merge_rule_rejections')
    `);
    if (!fpRejectionsExists.rows[0].exists) {
      await pool.query(`
        CREATE TABLE fp_merge_rule_rejections (
          id SERIAL PRIMARY KEY,
          division VARCHAR(50),
          suggestion_id INTEGER,
          rejection_reason TEXT,
          rejected_by VARCHAR(255),
          rejected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      console.log('   ✅ Created fp_merge_rule_rejections');
    } else {
      console.log('   ⏭️  fp_merge_rule_rejections already exists');
    }

    // Check and create fp_database_upload_log
    const fpUploadLogExists = await pool.query(`
      SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'fp_database_upload_log')
    `);
    if (!fpUploadLogExists.rows[0].exists) {
      await pool.query(`
        CREATE TABLE fp_database_upload_log (
          id SERIAL PRIMARY KEY,
          division VARCHAR(50),
          upload_type VARCHAR(100),
          file_name VARCHAR(255),
          uploaded_by VARCHAR(255),
          uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          status VARCHAR(50),
          error_message TEXT,
          records_count INTEGER
        )
      `);
      console.log('   ✅ Created fp_database_upload_log');
    } else {
      console.log('   ⏭️  fp_database_upload_log already exists');
    }

    // Check and create fp_customer_similarity_cache
    const fpSimilarityCacheExists = await pool.query(`
      SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'fp_customer_similarity_cache')
    `);
    if (!fpSimilarityCacheExists.rows[0].exists) {
      await pool.query(`
        CREATE TABLE fp_customer_similarity_cache (
          id SERIAL PRIMARY KEY,
          division VARCHAR(50),
          customer1 VARCHAR(255),
          customer2 VARCHAR(255),
          similarity_score NUMERIC,
          algorithm VARCHAR(100),
          cached_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      console.log('   ✅ Created fp_customer_similarity_cache');
    } else {
      console.log('   ⏭️  fp_customer_similarity_cache already exists');
    }

    console.log('\n✅ All tables migrated/created successfully!');
    
    // ============================================
    // 4. Show final counts
    // ============================================
    console.log('\n📊 Final table counts:');
    
    const fpMergeCount = await pool.query('SELECT COUNT(*) FROM fp_customer_merge_rules');
    console.log(`   fp_customer_merge_rules: ${fpMergeCount.rows[0].count} rows`);
    
    const fpSuggestCount = await pool.query('SELECT COUNT(*) FROM fp_merge_rule_suggestions');
    console.log(`   fp_merge_rule_suggestions: ${fpSuggestCount.rows[0].count} rows`);

    // ============================================
    // 5. Ask about deleting old tables
    // ============================================
    console.log('\n⚠️  OLD TABLES TO DELETE (after verification):');
    console.log('   - customer_merge_rules');
    console.log('   - merge_rule_suggestions');
    console.log('   - merge_rule_notifications');
    console.log('   - merge_rule_rejections');
    console.log('   - database_upload_log');
    console.log('   - customer_similarity_cache');
    console.log('\nRun DELETE script after verifying the migrations are correct.');
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error(error);
  } finally {
    pool.end();
  }
}

migrateAllTables();
