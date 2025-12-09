const { Pool } = require('pg');

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'fp_database',
  user: 'postgres',
  password: '654883'
});

async function migrateDivisionMergeRules() {
  console.log('🚀 Migrating division_customer_merge_rules → fp_division_customer_merge_rules\n');
  
  try {
    // Check if fp_division_customer_merge_rules exists
    const exists = await pool.query(`
      SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'fp_division_customer_merge_rules')
    `);
    
    if (!exists.rows[0].exists) {
      // Create with same structure as division_customer_merge_rules
      await pool.query(`
        CREATE TABLE fp_division_customer_merge_rules (
          id SERIAL PRIMARY KEY,
          division VARCHAR(50),
          merged_customer_name VARCHAR(255),
          original_customers JSONB,
          rule_source VARCHAR(100),
          confidence_score NUMERIC,
          status VARCHAR(50),
          created_by VARCHAR(255),
          suggested_at TIMESTAMP,
          suggested_by VARCHAR(255),
          reviewed_at TIMESTAMP,
          reviewed_by VARCHAR(255),
          approved_at TIMESTAMP,
          approved_by VARCHAR(255),
          last_validated_at TIMESTAMP,
          validation_status VARCHAR(50),
          validation_notes TEXT,
          is_active BOOLEAN DEFAULT true,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      console.log('✅ Created fp_division_customer_merge_rules table');
    } else {
      console.log('⏭️  fp_division_customer_merge_rules already exists');
    }
    
    // Migrate FP data
    const result = await pool.query(`
      INSERT INTO fp_division_customer_merge_rules 
        (division, merged_customer_name, original_customers, rule_source, confidence_score, status, 
         created_by, suggested_at, suggested_by, reviewed_at, reviewed_by, approved_at, approved_by,
         last_validated_at, validation_status, validation_notes, is_active, created_at, updated_at)
      SELECT 
        division, merged_customer_name, original_customers, rule_source, confidence_score, status,
        created_by, suggested_at, suggested_by, reviewed_at, reviewed_by, approved_at, approved_by,
        last_validated_at, validation_status, validation_notes, is_active, created_at, updated_at
      FROM division_customer_merge_rules 
      WHERE division = 'FP'
      ON CONFLICT DO NOTHING
    `);
    console.log(`✅ Migrated ${result.rowCount} rows to fp_division_customer_merge_rules`);
    
    // Verify count
    const count = await pool.query('SELECT COUNT(*) FROM fp_division_customer_merge_rules');
    console.log(`\n📊 Total rows in fp_division_customer_merge_rules: ${count.rows[0].count}`);
    
    // Show sample data
    const sample = await pool.query('SELECT merged_customer_name, rule_source, is_active FROM fp_division_customer_merge_rules LIMIT 5');
    console.log('\n📋 Sample data:');
    sample.rows.forEach(row => console.log(`   - ${row.merged_customer_name} (${row.rule_source})`));
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error(error);
  } finally {
    pool.end();
  }
}

migrateDivisionMergeRules();
