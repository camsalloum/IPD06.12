const { Pool } = require('pg');

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'fp_database',
  user: 'postgres',
  password: '654883'
});

async function checkBudget() {
  try {
    // Check fp_sales_rep_budget
    console.log('\n=== fp_sales_rep_budget Summary ===');
    const summary = await pool.query(`
      SELECT salesrepname, budget_year, type, COUNT(*) as count 
      FROM fp_sales_rep_budget 
      GROUP BY salesrepname, budget_year, type 
      ORDER BY salesrepname, budget_year
    `);
    console.table(summary.rows);

    // Check recent entries
    console.log('\n=== Recent fp_sales_rep_budget entries ===');
    const recent = await pool.query(`
      SELECT id, salesrepname, customername, budget_year, type, month, values, values_type, created_at
      FROM fp_sales_rep_budget 
      ORDER BY created_at DESC 
      LIMIT 20
    `);
    console.table(recent.rows);

    // Check bulk import table
    console.log('\n=== fp_budget_bulk_import Summary ===');
    const bulkSummary = await pool.query(`
      SELECT sales_rep, status, COUNT(*) as count 
      FROM fp_budget_bulk_import 
      GROUP BY sales_rep, status 
      ORDER BY sales_rep
    `);
    console.table(bulkSummary.rows);

    // Check recent bulk imports
    console.log('\n=== Recent fp_budget_bulk_import entries ===');
    const bulkRecent = await pool.query(`
      SELECT id, sales_rep, customer, status, budget_year, jan, feb, mar, created_at
      FROM fp_budget_bulk_import 
      ORDER BY created_at DESC 
      LIMIT 10
    `);
    console.table(bulkRecent.rows);

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkBudget();
