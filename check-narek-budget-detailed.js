const { Pool } = require('pg');

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'fp_database',
  user: 'postgres',
  password: '654883'
});

async function checkNarekBudgetDetailed() {
  try {
    const result = await pool.query(`
      SELECT 
        division,
        salesrepname,
        budget_year,
        month,
        customername,
        countryname,
        productgroup,
        values_type,
        values,
        material,
        process,
        created_at
      FROM fp_sales_rep_budget 
      WHERE UPPER(salesrepname) = UPPER('Narek Koroukian') 
      AND budget_year = 2026 
      ORDER BY customername, countryname, productgroup, values_type, month
    `);
    
    console.log('='.repeat(100));
    console.log(`NAREK KOROUKIAN - BUDGET 2026 - DETAILED VIEW`);
    console.log('='.repeat(100));
    console.log(`Total Records: ${result.rowCount}\n`);
    
    if (result.rowCount > 0) {
      let currentCustomer = '';
      
      result.rows.forEach((row, idx) => {
        if (row.customername !== currentCustomer) {
          if (currentCustomer !== '') console.log('\n' + '-'.repeat(100) + '\n');
          currentCustomer = row.customername;
          console.log(`📦 CUSTOMER: ${row.customername}`);
          console.log(`   Country: ${row.countryname}`);
          console.log(`   Product: ${row.productgroup}`);
          console.log('');
        }
        
        console.log(`   Month ${row.month} | ${row.values_type.padEnd(6)} | Value: ${row.values || 0} | Material: ${row.material || 'N/A'} | Process: ${row.process || 'N/A'}`);
      });
      
      console.log('\n' + '='.repeat(100));
      
      // Calculate totals by type
      const totals = result.rows.reduce((acc, row) => {
        const type = row.values_type;
        if (!acc[type]) acc[type] = { total: 0, count: 0 };
        acc[type].total += parseFloat(row.values) || 0;
        acc[type].count += 1;
        return acc;
      }, {});
      
      console.log('\n📊 TOTALS BY TYPE:');
      Object.keys(totals).forEach(type => {
        console.log(`   ${type}: Total=${totals[type].total.toFixed(2)} (${totals[type].count} records)`);
      });
      
      console.log('='.repeat(100));
    } else {
      console.log('❌ No records found');
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkNarekBudgetDetailed();
