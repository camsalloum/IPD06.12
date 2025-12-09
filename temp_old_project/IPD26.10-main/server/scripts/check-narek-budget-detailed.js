const { pool } = require('../database/config');

async function checkNarekBudget() {
  const client = await pool.connect();
  
  try {
    console.log('🔍 Checking Narek Koroukian budget data...\n');
    
    const division = 'FP';
    const salesRep = 'Narek Koroukian';
    const budgetYear = 2026;
    const actualYear = 2025;
    
    // Check final budget table
    console.log('📊 FINAL BUDGET TABLE (sales_rep_budget):');
    const finalQuery = `
      SELECT 
        TRIM(customername) as customer,
        TRIM(countryname) as country,
        TRIM(productgroup) as productgroup,
        month,
        values_type,
        values / 1000.0 as mt_value,
        created_at
      FROM sales_rep_budget
      WHERE UPPER(division) = UPPER($1)
        AND UPPER(salesrepname) = UPPER($2)
        AND budget_year = $3
        AND UPPER(type) = 'BUDGET'
      ORDER BY customername, month, values_type
    `;
    const finalResult = await client.query(finalQuery, [division, salesRep, budgetYear]);
    console.log(`  Total records: ${finalResult.rows.length}\n`);
    
    // Group by customer
    const customerGroups = {};
    finalResult.rows.forEach(row => {
      if (!customerGroups[row.customer]) {
        customerGroups[row.customer] = {
          country: row.country,
          productgroup: row.productgroup,
          records: []
        };
      }
      customerGroups[row.customer].records.push(row);
    });
    
    Object.entries(customerGroups).forEach(([customer, data]) => {
      console.log(`  📦 ${customer} (${data.country}) - ${data.productgroup}`);
      console.log(`     Records: ${data.records.length}`);
      const kgsRecords = data.records.filter(r => r.values_type === 'KGS');
      if (kgsRecords.length > 0) {
        const total = kgsRecords.reduce((sum, r) => sum + parseFloat(r.mt_value), 0);
        console.log(`     Total KGS across all months: ${total.toFixed(2)} MT`);
        console.log(`     Sample: Month ${kgsRecords[0].month} = ${kgsRecords[0].mt_value} MT`);
      }
    });
    
    // Check what the API endpoint returns
    console.log('\n📡 TESTING API ENDPOINT (html-budget-customers):');
    console.log('   Simulating: POST /api/aebf/html-budget-customers');
    console.log(`   Filters: division=${division}, actualYear=${actualYear}, salesRep=${salesRep}\n`);
    
    // Load actual sales data (same as endpoint)
    const actualQuery = `
      SELECT 
        TRIM(customername) as customer,
        TRIM(countryname) as country,
        TRIM(productgroup) as productgroup,
        month,
        SUM(CASE WHEN UPPER(values_type) = 'KGS' THEN values ELSE 0 END) / 1000.0 as mt_value
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
    console.log(`  Customers from ACTUAL sales (2025): ${actualResult.rows.length} rows`);
    
    // Get unique customers from actual
    const actualCustomers = new Set();
    actualResult.rows.forEach(row => {
      actualCustomers.add(`${row.customer}|${row.country}|${row.productgroup}`);
    });
    console.log(`  Unique customer combinations: ${actualCustomers.size}`);
    actualCustomers.forEach(key => console.log(`    - ${key}`));
    
    // Load budget data (same as endpoint)
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
    console.log(`\n  Customers from BUDGET (2026): ${budgetResult.rows.length} rows`);
    
    // Get unique customers from budget
    const budgetCustomers = new Set();
    budgetResult.rows.forEach(row => {
      budgetCustomers.add(`${row.customer}|${row.country}|${row.productgroup}`);
    });
    console.log(`  Unique customer combinations: ${budgetCustomers.size}`);
    budgetCustomers.forEach(key => console.log(`    - ${key}`));
    
    // Find budget-only customers
    console.log('\n  🆕 BUDGET-ONLY customers (should appear in table after fix):');
    let foundBudgetOnly = false;
    budgetCustomers.forEach(key => {
      if (!actualCustomers.has(key)) {
        console.log(`    ✅ ${key} (NO actual sales, ONLY budget)`);
        foundBudgetOnly = true;
      }
    });
    if (!foundBudgetOnly) {
      console.log('    ❌ No budget-only customers found!');
    }
    
    console.log('\n✅ Analysis complete!');
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

checkNarekBudget()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('❌ Script failed:', err);
    process.exit(1);
  });
