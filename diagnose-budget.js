const { Pool } = require('pg');

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'fp_database',
  user: 'postgres',
  password: '654883'
});

async function diagnose() {
  try {
    // 1. Check tables
    console.log('📋 Budget/Sales Rep Tables:');
    const tables = await pool.query(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_name LIKE '%budget%' OR table_name LIKE '%sales_rep%' 
      ORDER BY table_name
    `);
    tables.rows.forEach(r => console.log('   -', r.table_name));

    // 2. Check if sales_rep_budget exists and get its structure
    const budgetStructure = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'sales_rep_budget'
      ORDER BY ordinal_position
    `);
    if (budgetStructure.rows.length > 0) {
      console.log('\n📋 sales_rep_budget structure:');
      budgetStructure.rows.forEach(c => console.log(`   - ${c.column_name}: ${c.data_type}`));
      
      const count = await pool.query('SELECT COUNT(*) FROM sales_rep_budget');
      console.log('   Rows:', count.rows[0].count);
    }

    // 3. Check if fp_sales_rep_budget exists
    const fpBudgetExists = await pool.query(`
      SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'fp_sales_rep_budget')
    `);
    console.log('\n📋 fp_sales_rep_budget exists:', fpBudgetExists.rows[0].exists);

    // 4. Check fp_data_excel for Narek actual data
    console.log('\n🔍 Checking fp_data_excel for Narek Koroukian actual data (2025):');
    const actualData = await pool.query(`
      SELECT 
        TRIM(salesrepname) as sales_rep,
        COUNT(*) as row_count,
        SUM(CASE WHEN UPPER(values_type) = 'KGS' THEN values ELSE 0 END) / 1000.0 as total_mt
      FROM fp_data_excel
      WHERE year = 2025 
        AND UPPER(type) = 'ACTUAL'
        AND UPPER(TRIM(salesrepname)) LIKE '%NAREK%'
      GROUP BY TRIM(salesrepname)
    `);
    if (actualData.rows.length > 0) {
      actualData.rows.forEach(r => console.log(`   ${r.sales_rep}: ${r.row_count} rows, ${parseFloat(r.total_mt).toFixed(2)} MT total`));
    } else {
      console.log('   ❌ No actual data found for Narek');
    }

    // 5. Check merge rules
    console.log('\n🔍 Checking fp_division_customer_merge_rules:');
    const mergeExists = await pool.query(`
      SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'fp_division_customer_merge_rules')
    `);
    if (mergeExists.rows[0].exists) {
      const mergeCount = await pool.query('SELECT COUNT(*) FROM fp_division_customer_merge_rules WHERE division = $1 AND status = $2 AND is_active = true', ['FP', 'ACTIVE']);
      console.log('   ✅ Table exists with', mergeCount.rows[0].count, 'active FP rules');
      
      // Show sample merge rules
      const sampleRules = await pool.query(`
        SELECT merged_customer_name, original_customers 
        FROM fp_division_customer_merge_rules 
        WHERE division = 'FP' AND status = 'ACTIVE' AND is_active = true 
        LIMIT 3
      `);
      if (sampleRules.rows.length > 0) {
        console.log('   Sample rules:');
        sampleRules.rows.forEach(r => {
          const originals = Array.isArray(r.original_customers) ? r.original_customers : JSON.parse(r.original_customers || '[]');
          console.log(`     "${r.merged_customer_name}" <- ${originals.length} customers`);
        });
      }
    } else {
      console.log('   ❌ Table does not exist!');
    }

    // 6. CREATE fp_sales_rep_budget if needed
    if (!fpBudgetExists.rows[0].exists) {
      console.log('\n🔨 Creating fp_sales_rep_budget table...');
      
      // Match the structure expected by the code (check aebf.js query)
      await pool.query(`
        CREATE TABLE fp_sales_rep_budget (
          id SERIAL PRIMARY KEY,
          division VARCHAR(50),
          salesrepname VARCHAR(255),
          customername VARCHAR(255),
          countryname VARCHAR(255),
          productgroup VARCHAR(255),
          budget_year INTEGER,
          year INTEGER,
          month INTEGER,
          type VARCHAR(50) DEFAULT 'BUDGET',
          values_type VARCHAR(50) DEFAULT 'KGS',
          values NUMERIC(15,4) DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          created_by VARCHAR(255)
        )
      `);
      console.log('   ✅ Created fp_sales_rep_budget');
      
      // Create index
      await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_fp_sales_rep_budget_lookup 
        ON fp_sales_rep_budget(division, budget_year, salesrepname)
      `);
      console.log('   ✅ Created index');
    }

    // 7. Check/create fp_sales_rep_budget_draft
    const fpDraftExists = await pool.query(`
      SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'fp_sales_rep_budget_draft')
    `);
    console.log('\n📋 fp_sales_rep_budget_draft exists:', fpDraftExists.rows[0].exists);
    
    if (!fpDraftExists.rows[0].exists) {
      console.log('🔨 Creating fp_sales_rep_budget_draft table...');
      await pool.query(`
        CREATE TABLE fp_sales_rep_budget_draft (
          id SERIAL PRIMARY KEY,
          division VARCHAR(50),
          salesrepname VARCHAR(255),
          customername VARCHAR(255),
          countryname VARCHAR(255),
          productgroup VARCHAR(255),
          budget_year INTEGER,
          year INTEGER,
          month INTEGER,
          type VARCHAR(50) DEFAULT 'BUDGET',
          values_type VARCHAR(50) DEFAULT 'KGS',
          values NUMERIC(15,4) DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          created_by VARCHAR(255)
        )
      `);
      console.log('   ✅ Created fp_sales_rep_budget_draft');
    }

    console.log('\n✅ Diagnosis complete!');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  } finally {
    pool.end();
  }
}

diagnose();
