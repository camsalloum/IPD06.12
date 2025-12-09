const { Pool } = require('pg');

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'fp_database',
  user: 'postgres',
  password: '654883'
});

async function checkAndCreateBudgetTables() {
  console.log('🔍 Checking sales_rep_budget tables...\n');
  
  try {
    // Check existing budget tables
    const existingTables = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_name LIKE '%sales_rep_budget%' OR table_name LIKE '%budget%'
      ORDER BY table_name
    `);
    
    console.log('📋 Existing budget-related tables:');
    existingTables.rows.forEach(row => console.log('   -', row.table_name));
    
    // Check if common sales_rep_budget exists and its structure
    const commonStructure = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'sales_rep_budget'
      ORDER BY ordinal_position
    `);
    
    if (commonStructure.rows.length > 0) {
      console.log('\n📋 sales_rep_budget columns:');
      commonStructure.rows.forEach(col => console.log(`   - ${col.column_name}: ${col.data_type}`));
      
      const count = await pool.query('SELECT COUNT(*) FROM sales_rep_budget');
      console.log('   Rows:', count.rows[0].count);
    } else {
      console.log('\n❌ sales_rep_budget table does not exist');
    }
    
    // Check fp_sales_rep_budget
    const fpExists = await pool.query(`
      SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'fp_sales_rep_budget')
    `);
    
    if (!fpExists.rows[0].exists) {
      console.log('\n🔨 Creating fp_sales_rep_budget table...');
      
      // Create with expected structure based on code usage
      await pool.query(`
        CREATE TABLE fp_sales_rep_budget (
          id SERIAL PRIMARY KEY,
          division VARCHAR(50),
          sales_rep VARCHAR(255),
          customername VARCHAR(255),
          countryname VARCHAR(255),
          productgroup VARCHAR(255),
          year INTEGER,
          month INTEGER,
          budget_value NUMERIC(15,4) DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          created_by VARCHAR(255),
          is_draft BOOLEAN DEFAULT false,
          UNIQUE(division, sales_rep, customername, countryname, productgroup, year, month)
        )
      `);
      console.log('✅ Created fp_sales_rep_budget table');
      
      // Create index for faster queries
      await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_fp_sales_rep_budget_lookup 
        ON fp_sales_rep_budget(division, sales_rep, year)
      `);
      console.log('✅ Created index on fp_sales_rep_budget');
    } else {
      console.log('\n✅ fp_sales_rep_budget already exists');
    }
    
    // Check fp_sales_rep_budget_draft
    const fpDraftExists = await pool.query(`
      SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'fp_sales_rep_budget_draft')
    `);
    
    if (!fpDraftExists.rows[0].exists) {
      console.log('\n🔨 Creating fp_sales_rep_budget_draft table...');
      
      await pool.query(`
        CREATE TABLE fp_sales_rep_budget_draft (
          id SERIAL PRIMARY KEY,
          division VARCHAR(50),
          sales_rep VARCHAR(255),
          customername VARCHAR(255),
          countryname VARCHAR(255),
          productgroup VARCHAR(255),
          year INTEGER,
          month INTEGER,
          budget_value NUMERIC(15,4) DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          created_by VARCHAR(255),
          UNIQUE(division, sales_rep, customername, countryname, productgroup, year, month)
        )
      `);
      console.log('✅ Created fp_sales_rep_budget_draft table');
      
      // Create index
      await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_fp_sales_rep_budget_draft_lookup 
        ON fp_sales_rep_budget_draft(division, sales_rep, year)
      `);
      console.log('✅ Created index on fp_sales_rep_budget_draft');
    } else {
      console.log('\n✅ fp_sales_rep_budget_draft already exists');
    }
    
    // If common sales_rep_budget has data, migrate it
    if (commonStructure.rows.length > 0) {
      const commonCount = await pool.query(`SELECT COUNT(*) FROM sales_rep_budget WHERE UPPER(division) = 'FP'`);
      if (parseInt(commonCount.rows[0].count) > 0) {
        console.log(`\n📊 Found ${commonCount.rows[0].count} FP rows in common sales_rep_budget, migrating...`);
        
        const migrateResult = await pool.query(`
          INSERT INTO fp_sales_rep_budget (division, sales_rep, customername, countryname, productgroup, year, month, budget_value, created_at, updated_at, created_by)
          SELECT division, sales_rep, customername, countryname, productgroup, year, month, budget_value, created_at, updated_at, created_by
          FROM sales_rep_budget
          WHERE UPPER(division) = 'FP'
          ON CONFLICT (division, sales_rep, customername, countryname, productgroup, year, month) DO NOTHING
        `);
        console.log(`✅ Migrated ${migrateResult.rowCount} rows to fp_sales_rep_budget`);
      }
    }
    
    console.log('\n✅ Budget tables setup complete!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  } finally {
    pool.end();
  }
}

checkAndCreateBudgetTables();
