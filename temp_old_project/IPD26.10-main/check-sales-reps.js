const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://postgres:654883@localhost:5432/fp_database' });

(async () => {
  try {
    console.log('\n📊 === SALES REP NAMES IN DATABASE ===\n');
    
    // Check distinct sales rep names
    const salesReps = await pool.query(`
      SELECT DISTINCT salesrepname, COUNT(*) as cnt 
      FROM fp_sales_rep_budget 
      WHERE salesrepname IS NOT NULL
      GROUP BY salesrepname
      ORDER BY salesrepname
    `);
    
    console.log('Distinct Sales Rep Names:');
    salesReps.rows.forEach(row => {
      console.log(`  - "${row.salesrepname}" (${row.cnt} records)`);
    });
    
    console.log('\n📊 === DISTINCT CUSTOMERS ===\n');
    const customers = await pool.query(`
      SELECT DISTINCT customername, COUNT(*) as cnt 
      FROM fp_sales_rep_budget 
      WHERE customername IS NOT NULL
      GROUP BY customername
      ORDER BY customername
    `);
    
    console.log('Distinct Customer Names:');
    customers.rows.forEach(row => {
      console.log(`  - "${row.customername}" (${row.cnt} records)`);
    });
    
    console.log('\n📊 === SAMPLE OF ALL DATA ===\n');
    const sample = await pool.query(`
      SELECT salesrepname, customername, countryname, productgroup, values_type, values
      FROM fp_sales_rep_budget
      LIMIT 10
    `);
    
    console.log('Sample records:');
    sample.rows.forEach((row, i) => {
      console.log(`${i+1}. SalesRep: "${row.salesrepname}" | Customer: "${row.customername}" | Country: "${row.countryname}" | PG: "${row.productgroup}" | Type: ${row.values_type} | Value: ${row.values}`);
    });
    
    await pool.end();
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
})();
