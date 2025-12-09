const { Pool } = require('pg');

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'fp_database',
  user: 'postgres',
  password: '654883'
});

async function checkBudgetData() {
  try {
    console.log('=== Checking Budget Data for 2025 ===\n');
    
    // Check if budget data exists
    const budgetCheck = await pool.query(`
      SELECT type, COUNT(*) as count, SUM(CASE WHEN values_type = 'AMOUNT' THEN values ELSE 0 END) as total
      FROM fp_data_excel
      WHERE year = 2025
      GROUP BY type
      ORDER BY type
    `);
    
    console.log('Data types available for 2025:');
    console.log(budgetCheck.rows);
    console.log();
    
    // Check budget by product group
    const budgetByProduct = await pool.query(`
      SELECT productgroup, SUM(CASE WHEN values_type = 'AMOUNT' THEN values ELSE 0 END) as total
      FROM fp_data_excel
      WHERE year = 2025 AND type = 'Budget'
      GROUP BY productgroup
      ORDER BY total DESC
      LIMIT 10
    `);
    
    console.log('Budget by Product Group (2025):');
    console.log(budgetByProduct.rows);
    console.log();
    
    // Check Actual/Estimate by product group for comparison
    const actualByProduct = await pool.query(`
      SELECT productgroup, 
             SUM(CASE WHEN type = 'Actual' AND values_type = 'AMOUNT' THEN values ELSE 0 END) as actual,
             SUM(CASE WHEN type = 'Estimate' AND values_type = 'AMOUNT' THEN values ELSE 0 END) as estimate,
             SUM(CASE WHEN type IN ('Actual', 'Estimate') AND values_type = 'AMOUNT' THEN values ELSE 0 END) as total
      FROM fp_data_excel
      WHERE year = 2025
      GROUP BY productgroup
      ORDER BY total DESC
      LIMIT 10
    `);
    
    console.log('Actual + Estimate by Product Group (2025):');
    console.log(actualByProduct.rows);
    console.log();
    
    // Calculate budget achievement for top products
    console.log('Budget Achievement Calculation:');
    for (const product of actualByProduct.rows.slice(0, 5)) {
      const budgetRow = budgetByProduct.rows.find(b => b.productgroup === product.productgroup);
      const budgetAmount = budgetRow ? parseFloat(budgetRow.total) : 0;
      const actualAmount = parseFloat(product.total);
      const achievement = budgetAmount > 0 ? (actualAmount / budgetAmount * 100).toFixed(1) : 0;
      
      console.log(`${product.productgroup}:`);
      console.log(`  Actual+Est: $${actualAmount.toLocaleString()}`);
      console.log(`  Budget: $${budgetAmount.toLocaleString()}`);
      console.log(`  Achievement: ${achievement}%`);
      console.log();
    }
    
    await pool.end();
  } catch (error) {
    console.error('Error:', error);
    await pool.end();
    process.exit(1);
  }
}

checkBudgetData();
