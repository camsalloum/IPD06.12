const { pool } = require('../database/config');

async function testBudgetLoad() {
  const client = await pool.connect();
  
  try {
    console.log('🔍 Simulating frontend budget load for Narek...\n');
    
    const division = 'FP';
    const salesRep = 'Narek Koroukian';
    const actualYear = 2025;
    const budgetYear = 2026;
    
    // Step 1: Load actual sales (what the table shows)
    console.log('📊 STEP 1: Loading ACTUAL sales for table rows...');
    const actualQuery = `
      SELECT 
        TRIM(customername) as customer,
        TRIM(countryname) as country,
        TRIM(productgroup) as productgroup,
        month
      FROM public.fp_data_excel
      WHERE UPPER(division) = UPPER($1)
        AND year = $2
        AND UPPER(type) = 'ACTUAL'
        AND TRIM(UPPER(salesrepname)) = UPPER($3)
        AND customername IS NOT NULL
        AND TRIM(customername) != ''
        AND UPPER(TRIM(productgroup)) != 'SERVICES CHARGES'
      GROUP BY TRIM(customername), TRIM(countryname), TRIM(productgroup), month
    `;
    const actualResult = await client.query(actualQuery, [division, actualYear, salesRep]);
    
    const actualCustomers = new Set();
    actualResult.rows.forEach(row => {
      const key = `${row.customer}|${row.country}|${row.productgroup}`;
      actualCustomers.add(key);
    });
    
    console.log(`  Found ${actualCustomers.size} unique customer/product combinations from actual sales:`);
    actualCustomers.forEach(key => console.log(`    - ${key}`));
    
    // Step 2: Load budget data
    console.log('\n📊 STEP 2: Loading BUDGET data (2026)...');
    const budgetQuery = `
      SELECT 
        TRIM(customername) as customer,
        TRIM(countryname) as country,
        TRIM(productgroup) as productgroup,
        month,
        values / 1000.0 as mt_value
      FROM sales_rep_budget
      WHERE UPPER(division) = UPPER($1)
        AND budget_year = $2
        AND UPPER(TRIM(salesrepname)) = UPPER(TRIM($3))
        AND UPPER(type) = 'BUDGET'
        AND UPPER(values_type) = 'KGS'
    `;
    const budgetResult = await client.query(budgetQuery, [division, budgetYear, salesRep]);
    
    console.log(`  Found ${budgetResult.rows.length} budget records (KGS only)`);
    
    // Build budget map (like backend does)
    const budgetMap = {};
    const budgetCustomers = new Set();
    budgetResult.rows.forEach(row => {
      const key = `${row.customer}|${row.country}|${row.productgroup}|${row.month}`;
      budgetMap[key] = parseFloat(row.mt_value) || 0;
      
      const customerKey = `${row.customer}|${row.country}|${row.productgroup}`;
      budgetCustomers.add(customerKey);
    });
    
    console.log(`  Budget map has ${Object.keys(budgetMap).length} entries`);
    console.log(`  Sample entries:`);
    Object.entries(budgetMap).slice(0, 5).forEach(([key, value]) => {
      console.log(`    ${key} = ${value} MT`);
    });
    
    // Step 3: Check which customers are budget-only
    console.log('\n📊 STEP 3: Budget-only customers (should be added to table)...');
    const budgetOnly = [];
    budgetCustomers.forEach(key => {
      if (!actualCustomers.has(key)) {
        budgetOnly.push(key);
      }
    });
    
    if (budgetOnly.length > 0) {
      console.log(`  Found ${budgetOnly.length} budget-only customers:`);
      budgetOnly.forEach(key => console.log(`    ✅ ${key}`));
    } else {
      console.log('  No budget-only customers found');
    }
    
    // Step 4: Final table should include
    console.log('\n📊 STEP 4: Final table should show...');
    const finalTable = new Set([...actualCustomers, ...budgetCustomers]);
    console.log(`  Total rows: ${finalTable.size}`);
    console.log(`  Breakdown:`);
    console.log(`    - From actual sales only: ${actualCustomers.size - budgetCustomers.size + budgetOnly.length}`);
    console.log(`    - From budget only: ${budgetOnly.length}`);
    console.log(`    - Both actual + budget: ${budgetCustomers.size - budgetOnly.length}`);
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

testBudgetLoad()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('❌ Script failed:', err);
    process.exit(1);
  });
