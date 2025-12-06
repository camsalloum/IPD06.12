const { Pool } = require('pg');

const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'fp_database',
  password: '654883',
  port: 5432
});

async function checkNarekBudget() {
  try {
    // Check Narek's budget records
    console.log('\n📊 Checking Narek Koroukian Budget for 2026...\n');
    
    const budgetResult = await pool.query(`
      SELECT productgroup, values_type, SUM(values) as total, COUNT(*) as count
      FROM sales_rep_budget
      WHERE UPPER(salesrepname) = UPPER('Narek Koroukian')
      AND budget_year = 2026
      GROUP BY productgroup, values_type
      ORDER BY productgroup, values_type
    `);
    
    console.log('Budget Records:');
    console.table(budgetResult.rows);
    
    // Check pricing data for FP division, year 2025
    console.log('\n💰 Checking FP Pricing Data for 2025...\n');
    
    const pricingResult = await pool.query(`
      SELECT division, year, product_group, asp_round, morm_round
      FROM product_group_pricing_rounding
      WHERE UPPER(division) = 'FP'
      AND year = 2025
      ORDER BY product_group
    `);
    
    console.log('Pricing Records:');
    console.table(pricingResult.rows);
    
    // Check for "Commercial Items Plain" specifically
    console.log('\n🔍 Checking "Commercial Items Plain" pricing...\n');
    
    const commercialResult = await pool.query(`
      SELECT *
      FROM product_group_pricing_rounding
      WHERE UPPER(division) = 'FP'
      AND year = 2025
      AND LOWER(product_group) LIKE '%commercial%'
    `);
    
    console.log('Commercial Items Pricing:');
    console.table(commercialResult.rows);
    
    // Check draft data
    console.log('\n📝 Checking Narek Draft Data...\n');
    
    const draftResult = await pool.query(`
      SELECT productgroup, COUNT(*) as count, SUM(values) as total
      FROM sales_rep_budget_draft
      WHERE UPPER(salesrepname) = UPPER('Narek Koroukian')
      AND budget_year = 2026
      GROUP BY productgroup
    `);
    
    console.log('Draft Records:');
    console.table(draftResult.rows);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  } finally {
    await pool.end();
  }
}

checkNarekBudget();
