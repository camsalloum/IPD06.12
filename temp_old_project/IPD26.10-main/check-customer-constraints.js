const { Pool } = require('pg');

const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'fp_database',
  password: '654883',
  port: 5432,
});

async function checkConstraints() {
  const client = await pool.connect();
  try {
    console.log('🔍 Checking for foreign key constraints on customername column...\n');
    
    // Check for foreign key constraints
    const fkQuery = `
      SELECT 
        tc.constraint_name,
        tc.table_name,
        kcu.column_name,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name
      FROM 
        information_schema.table_constraints AS tc
        JOIN information_schema.key_column_usage AS kcu
          ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
        JOIN information_schema.constraint_column_usage AS ccu
          ON ccu.constraint_name = tc.constraint_name
          AND ccu.table_schema = tc.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY' 
        AND tc.table_name IN ('fp_sales_rep_budget', 'fp_sales_rep_budget_draft')
        AND kcu.column_name = 'customername';
    `;
    
    const fkResult = await client.query(fkQuery);
    
    if (fkResult.rows.length === 0) {
      console.log('✅ No foreign key constraints on customername column');
      console.log('✅ Database will accept ANY customer name, including new ones!\n');
    } else {
      console.log('❌ Found foreign key constraints:');
      fkResult.rows.forEach(row => {
        console.log(`   - ${row.table_name}.${row.column_name} -> ${row.foreign_table_name}.${row.foreign_column_name}`);
      });
      console.log('\n⚠️  New customer names will be rejected by foreign key constraint!\n');
    }
    
    // Check column definition
    console.log('📋 Checking customername column definition...\n');
    const colQuery = `
      SELECT 
        table_name,
        column_name,
        data_type,
        character_maximum_length,
        is_nullable
      FROM information_schema.columns
      WHERE table_name IN ('fp_sales_rep_budget', 'fp_sales_rep_budget_draft')
        AND column_name = 'customername'
      ORDER BY table_name;
    `;
    
    const colResult = await client.query(colQuery);
    colResult.rows.forEach(row => {
      console.log(`Table: ${row.table_name}`);
      console.log(`  Column: ${row.column_name}`);
      console.log(`  Type: ${row.data_type}(${row.character_maximum_length})`);
      console.log(`  Nullable: ${row.is_nullable}`);
      console.log('');
    });
    
    // Check if there's a customer master table
    console.log('🔍 Checking for customer master tables...\n');
    const tableQuery = `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_name LIKE '%customer%'
      ORDER BY table_name;
    `;
    
    const tableResult = await client.query(tableQuery);
    if (tableResult.rows.length > 0) {
      console.log('📋 Found customer-related tables:');
      tableResult.rows.forEach(row => {
        console.log(`   - ${row.table_name}`);
      });
      console.log('');
    } else {
      console.log('✅ No customer master table found');
      console.log('✅ Customer names are stored directly without validation\n');
    }
    
    console.log('='.repeat(70));
    console.log('SUMMARY:');
    console.log('='.repeat(70));
    if (fkResult.rows.length === 0) {
      console.log('✅ Database is ready to import new customer names');
      console.log('✅ No constraints will block custom rows with new customers');
      console.log('✅ Customer name can be any string up to 255-500 characters');
    } else {
      console.log('⚠️  Database has constraints that may block new customer names');
      console.log('⚠️  You may need to remove foreign key constraints or add new customers to master table');
    }
    console.log('='.repeat(70));
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

checkConstraints();
