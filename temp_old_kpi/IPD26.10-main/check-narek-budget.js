const { Pool } = require('pg');

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'fp_database',
  user: 'postgres',
  password: '654883'
});

async function checkNarekBudget() {
  try {
    // Check final budget
    const finalResult = await pool.query(`
      SELECT * FROM sales_rep_budget 
      WHERE UPPER(salesrepname) = UPPER('Narek Koroukian') 
      AND budget_year = 2026 
      ORDER BY customername, countryname, productgroup, month
    `);
    
    console.log('='.repeat(80));
    console.log('FINAL BUDGET RECORDS:', finalResult.rowCount);
    console.log('='.repeat(80));
    if (finalResult.rowCount > 0) {
      finalResult.rows.forEach(row => {
        console.log(`${row.customername.padEnd(30)} | ${row.countryname.padEnd(20)} | ${row.productgroup.padEnd(15)} | Month ${row.month.toString().padStart(2)} | ${row.values_type.padEnd(6)}: ${row.kgsvalue}`);
      });
    } else {
      console.log('No records found');
    }
    
    // Check draft budget
    const draftResult = await pool.query(`
      SELECT * FROM sales_rep_budget_draft 
      WHERE UPPER(salesrepname) = UPPER('Narek Koroukian') 
      AND budget_year = 2026 
      ORDER BY customername, countryname, productgroup, month
    `);
    
    console.log('\n' + '='.repeat(80));
    console.log('DRAFT BUDGET RECORDS:', draftResult.rowCount);
    console.log('='.repeat(80));
    if (draftResult.rowCount > 0) {
      draftResult.rows.forEach(row => {
        console.log(`${row.customername.padEnd(30)} | ${row.countryname.padEnd(20)} | ${row.productgroup.padEnd(15)} | Month ${row.month.toString().padStart(2)} | ${row.values_type.padEnd(6)}: ${row.kgsvalue}`);
      });
    } else {
      console.log('No records found');
    }
    
    console.log('\n' + '='.repeat(80));
    console.log(`TOTAL: ${finalResult.rowCount} final + ${draftResult.rowCount} draft = ${finalResult.rowCount + draftResult.rowCount} records`);
    console.log('='.repeat(80));
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkNarekBudget();
