const { Pool } = require('pg');
const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'fp_database',
  password: '654883',
  port: 5432,
});

async function addConstraint() {
  try {
    console.log('Adding unique constraint to fp_sales_rep_budget_draft...\n');
    
    // First, check if constraint already exists
    const checkRes = await pool.query(`
      SELECT constraint_name 
      FROM information_schema.table_constraints 
      WHERE table_name = 'fp_sales_rep_budget_draft' 
      AND constraint_name = 'fp_sales_rep_budget_draft_unique'
    `);
    
    if (checkRes.rows.length > 0) {
      console.log('✅ Constraint already exists!');
      return;
    }
    
    // Add the unique constraint
    await pool.query(`
      ALTER TABLE fp_sales_rep_budget_draft
      ADD CONSTRAINT fp_sales_rep_budget_draft_unique
      UNIQUE (division, budget_year, month, salesrepname, customername, countryname, productgroup)
    `);
    
    console.log('✅ Unique constraint added successfully!');
    console.log('Constraint: (division, budget_year, month, salesrepname, customername, countryname, productgroup)');
    
  } catch (e) {
    console.error('❌ Error:', e.message);
    console.error('Details:', e.detail);
  } finally {
    await pool.end();
  }
}

addConstraint();
