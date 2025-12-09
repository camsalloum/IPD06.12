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
    // Check sales_rep_budget (old shared table)
    console.log('📋 OLD sales_rep_budget table:');
    const oldBudget = await pool.query(`
      SELECT budget_year, division, COUNT(*) as rows 
      FROM sales_rep_budget 
      GROUP BY budget_year, division 
      ORDER BY budget_year, division
    `);
    if (oldBudget.rows.length === 0) {
      console.log('   (empty)');
    } else {
      oldBudget.rows.forEach(r => console.log(`   Year: ${r.budget_year}, Division: ${r.division}, Rows: ${r.rows}`));
    }

    // Check sales_rep_budget_draft (old shared table)
    console.log('\n📋 OLD sales_rep_budget_draft table:');
    const oldDraft = await pool.query(`
      SELECT budget_year, division, COUNT(*) as rows 
      FROM sales_rep_budget_draft 
      GROUP BY budget_year, division 
      ORDER BY budget_year, division
    `);
    if (oldDraft.rows.length === 0) {
      console.log('   (empty)');
    } else {
      oldDraft.rows.forEach(r => console.log(`   Year: ${r.budget_year}, Division: ${r.division}, Rows: ${r.rows}`));
    }

    // Check fp_sales_rep_budget (new FP-specific table)
    console.log('\n📋 NEW fp_sales_rep_budget table:');
    const newBudget = await pool.query(`
      SELECT budget_year, division, COUNT(*) as rows 
      FROM fp_sales_rep_budget 
      GROUP BY budget_year, division 
      ORDER BY budget_year, division
    `);
    if (newBudget.rows.length === 0) {
      console.log('   (empty)');
    } else {
      newBudget.rows.forEach(r => console.log(`   Year: ${r.budget_year}, Division: ${r.division}, Rows: ${r.rows}`));
    }

    // Check fp_sales_rep_budget_draft (new FP-specific table)
    console.log('\n📋 NEW fp_sales_rep_budget_draft table:');
    const newDraft = await pool.query(`
      SELECT budget_year, division, COUNT(*) as rows 
      FROM fp_sales_rep_budget_draft 
      GROUP BY budget_year, division 
      ORDER BY budget_year, division
    `);
    if (newDraft.rows.length === 0) {
      console.log('   (empty)');
    } else {
      newDraft.rows.forEach(r => console.log(`   Year: ${r.budget_year}, Division: ${r.division}, Rows: ${r.rows}`));
    }

    // Show sample from old table if it has data
    if (oldBudget.rows.length > 0) {
      console.log('\n📊 Sample from OLD sales_rep_budget:');
      const sample = await pool.query(`
        SELECT salesrepname, customername, budget_year, month, values 
        FROM sales_rep_budget 
        LIMIT 3
      `);
      sample.rows.forEach(r => console.log(`   ${r.salesrepname} / ${r.customername} / Year ${r.budget_year} M${r.month}: ${r.values}`));
    }

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    pool.end();
  }
}

checkBudgetData();
