const { Pool } = require('pg');

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'fp_database',
  user: 'postgres',
  password: '654883'
});

async function migratePricingData() {
  const client = await pool.connect();
  
  try {
    console.log('═'.repeat(70));
    console.log('📊 PRICING DATA MIGRATION');
    console.log('═'.repeat(70));
    console.log('From: product_group_pricing_rounding (common table)');
    console.log('To:   {division}_product_group_pricing_rounding (division-specific tables)');
    console.log('═'.repeat(70));
    
    // Step 1: Check what divisions exist in the common table
    const divisionsResult = await client.query(`
      SELECT DISTINCT UPPER(TRIM(division)) as division, COUNT(*) as count
      FROM product_group_pricing_rounding
      GROUP BY UPPER(TRIM(division))
      ORDER BY division
    `);
    
    console.log('\n📋 Divisions found in common table:');
    divisionsResult.rows.forEach(row => {
      console.log(`   - ${row.division}: ${row.count} records`);
    });
    
    // Step 2: For each division, migrate data
    for (const divRow of divisionsResult.rows) {
      const division = divRow.division;
      const divisionCode = division.split('-')[0].toLowerCase();
      const targetTable = `${divisionCode}_product_group_pricing_rounding`;
      
      console.log(`\n${'─'.repeat(50)}`);
      console.log(`🔄 Migrating ${division} to ${targetTable}...`);
      
      // Check if target table exists
      const tableExistsResult = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_name = $1
        )
      `, [targetTable]);
      
      if (!tableExistsResult.rows[0].exists) {
        console.log(`   ⚠️  Table ${targetTable} does not exist. Creating it...`);
        
        // Create the table with same structure as common table
        await client.query(`
          CREATE TABLE ${targetTable} (
            id SERIAL PRIMARY KEY,
            division VARCHAR(50),
            year INTEGER,
            product_group VARCHAR(255),
            asp_round NUMERIC(15, 4),
            morm_round NUMERIC(15, 4),
            rm_round NUMERIC(15, 4),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          )
        `);
        console.log(`   ✅ Table ${targetTable} created`);
      }
      
      // Check current count in target table
      const targetCountResult = await client.query(`SELECT COUNT(*) as count FROM ${targetTable}`);
      const existingCount = parseInt(targetCountResult.rows[0].count);
      
      if (existingCount > 0) {
        console.log(`   ⚠️  Target table already has ${existingCount} records`);
        console.log(`   🗑️  Clearing existing data before migration...`);
        await client.query(`DELETE FROM ${targetTable}`);
      }
      
      // Migrate data with correct columns
      const insertResult = await client.query(`
        INSERT INTO ${targetTable} (division, year, product_group, asp_round, morm_round, rm_round, created_at, updated_at)
        SELECT division, year, product_group, asp_round, morm_round, rm_round, created_at, updated_at
        FROM product_group_pricing_rounding
        WHERE UPPER(TRIM(division)) = $1
      `, [division]);
      
      console.log(`   ✅ Migrated ${insertResult.rowCount} records to ${targetTable}`);
      
      // Verify migration
      const verifyResult = await client.query(`
        SELECT year, COUNT(*) as count 
        FROM ${targetTable} 
        GROUP BY year 
        ORDER BY year DESC
      `);
      console.log(`   📊 Verification - Records by year:`);
      verifyResult.rows.forEach(row => {
        console.log(`      Year ${row.year}: ${row.count} records`);
      });
    }
    
    console.log(`\n${'═'.repeat(70)}`);
    console.log('✅ MIGRATION COMPLETE!');
    console.log('═'.repeat(70));
    
    // Show summary
    console.log('\n📋 SUMMARY:');
    for (const divRow of divisionsResult.rows) {
      const division = divRow.division;
      const divisionCode = division.split('-')[0].toLowerCase();
      const targetTable = `${divisionCode}_product_group_pricing_rounding`;
      
      const countResult = await client.query(`SELECT COUNT(*) as count FROM ${targetTable}`);
      console.log(`   ${targetTable}: ${countResult.rows[0].count} records`);
    }
    
    console.log('\n⚠️  The common table "product_group_pricing_rounding" still exists.');
    console.log('   Confirm the migration worked, then I will delete it.');
    
  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    throw error;
  } finally {
    client.release();
    pool.end();
  }
}

migratePricingData();
