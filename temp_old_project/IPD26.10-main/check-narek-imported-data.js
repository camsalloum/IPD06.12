const { Pool } = require('pg');

const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'fp_database',
  password: '654883',
  port: 5432,
});

async function checkImportedData() {
  const client = await pool.connect();
  try {
    console.log('🔍 Checking Narek Koroukian budget data...\n');
    
    const query = `
      SELECT 
        customername,
        countryname,
        productgroup,
        month,
        values_type,
        values,
        uploaded_filename,
        uploaded_at
      FROM fp_sales_rep_budget
      WHERE UPPER(salesrepname) = UPPER('Narek Koroukian')
        AND budget_year = 2026
        AND UPPER(type) = 'BUDGET'
      ORDER BY customername, countryname, productgroup, month, values_type;
    `;
    
    const result = await client.query(query);
    
    console.log(`📊 Found ${result.rows.length} records\n`);
    
    if (result.rows.length === 0) {
      console.log('❌ No data found for Narek Koroukian 2026');
    } else {
      // Group by customer
      const byCustomer = {};
      result.rows.forEach(row => {
        const key = `${row.customername} | ${row.countryname} | ${row.productgroup}`;
        if (!byCustomer[key]) {
          byCustomer[key] = [];
        }
        byCustomer[key].push(row);
      });
      
      console.log('📋 CUSTOMERS IN DATABASE:\n');
      Object.keys(byCustomer).forEach(key => {
        const records = byCustomer[key];
        const firstRecord = records[0];
        console.log(`  ✅ ${key}`);
        console.log(`     Uploaded: ${firstRecord.uploaded_at}`);
        console.log(`     File: ${firstRecord.uploaded_filename || 'N/A'}`);
        console.log(`     Data points: ${records.length} (should be ~36 for 12 months × 3 types)`);
        console.log('');
      });
      
      console.log('='.repeat(70));
      console.log(`TOTAL UNIQUE COMBINATIONS: ${Object.keys(byCustomer).length}`);
      console.log('='.repeat(70));
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

checkImportedData();
