const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Load env from server directory
require('dotenv').config({ path: path.join(__dirname, 'server', '.env') });

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'fp_database',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD
});

async function testUpload() {
  const client = await pool.connect();
  
  try {
    console.log('✅ Connected to database:', process.env.DB_NAME);
    
    // 1. Check if fp_divisional_budget table exists
    console.log('\n📋 Checking for divisional budget tables...');
    const tablesResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name LIKE '%divisional%'
      ORDER BY table_name
    `);
    
    console.log('Found tables:', tablesResult.rows.map(r => r.table_name));
    
    // 2. Check if fp_divisional_budget exists
    const hasBudgetTable = tablesResult.rows.some(r => r.table_name === 'fp_divisional_budget');
    
    if (!hasBudgetTable) {
      console.log('\n❌ fp_divisional_budget table does NOT exist!');
      console.log('Creating table...');
      
      await client.query(`
        CREATE TABLE IF NOT EXISTS fp_divisional_budget (
          id SERIAL PRIMARY KEY,
          division VARCHAR(50) NOT NULL,
          year INTEGER NOT NULL,
          month INTEGER NOT NULL,
          product_group VARCHAR(100) NOT NULL,
          metric VARCHAR(20) NOT NULL,
          value NUMERIC(18,4),
          material VARCHAR(100),
          process VARCHAR(100),
          uploaded_filename VARCHAR(500),
          uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT fp_divisional_budget_unique UNIQUE (division, year, month, product_group, metric)
        )
      `);
      
      // Create index
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_fp_divisional_budget_lookup 
        ON fp_divisional_budget(UPPER(division), year, month)
      `);
      
      console.log('✅ Created fp_divisional_budget table');
    } else {
      console.log('✅ fp_divisional_budget table exists');
      
      // Check current records
      const countResult = await client.query(`
        SELECT COUNT(*) as count, 
               MAX(uploaded_at) as last_upload,
               MAX(uploaded_filename) as last_file
        FROM fp_divisional_budget
        WHERE UPPER(division) = 'FP'
      `);
      console.log('Current FP records:', countResult.rows[0]);
    }
    
    // 3. Check archive table
    const hasArchiveTable = tablesResult.rows.some(r => r.table_name === 'fp_divisional_budget_archive');
    if (!hasArchiveTable) {
      console.log('\n📦 Creating archive table...');
      await client.query(`
        CREATE TABLE IF NOT EXISTS fp_divisional_budget_archive (
          id SERIAL PRIMARY KEY,
          division VARCHAR(50),
          year INTEGER,
          month INTEGER,
          product_group VARCHAR(100),
          metric VARCHAR(20),
          value NUMERIC(18,4),
          material VARCHAR(100),
          process VARCHAR(100),
          uploaded_filename VARCHAR(500),
          uploaded_at TIMESTAMP,
          archived_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          archived_reason VARCHAR(255)
        )
      `);
      console.log('✅ Created fp_divisional_budget_archive table');
    } else {
      console.log('✅ fp_divisional_budget_archive table exists');
    }
    
    // 4. Check pricing table
    console.log('\n💰 Checking pricing table...');
    const pricingResult = await client.query(`
      SELECT COUNT(*) as count 
      FROM fp_product_group_pricing_rounding
      WHERE UPPER(division) = 'FP'
    `);
    console.log('Pricing records for FP:', pricingResult.rows[0].count);
    
    // 5. Check material percentages table
    console.log('\n🏭 Checking material percentages table...');
    try {
      const materialResult = await client.query(`
        SELECT COUNT(*) as count FROM fp_material_percentages
      `);
      console.log('Material percentage records:', materialResult.rows[0].count);
    } catch (e) {
      console.log('⚠️ fp_material_percentages table not found:', e.message);
    }
    
    console.log('\n✅ All checks complete!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    client.release();
    await pool.end();
  }
}

testUpload();
