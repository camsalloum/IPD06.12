const { Pool } = require('pg');

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'fp_database',
  user: 'postgres',
  password: '654883'
});

async function comprehensiveAudit() {
  console.log('\n' + '='.repeat(80));
  console.log('COMPREHENSIVE BUDGET DATABASE AUDIT');
  console.log('='.repeat(80) + '\n');
  
  try {
    // 1. CHECK fp_budget_bulk_import table
    console.log('\n' + '-'.repeat(40));
    console.log('1. fp_budget_bulk_import TABLE');
    console.log('-'.repeat(40));
    
    const bulkImport = await pool.query(`
      SELECT id, batch_id, division, sales_rep, budget_year, customer, country, product_group,
             month_1, month_2, month_3, month_4, month_5, month_6,
             month_7, month_8, month_9, month_10, month_11, month_12,
             total_kg, status, source_file
      FROM fp_budget_bulk_import
      ORDER BY id DESC
      LIMIT 20
    `);
    
    console.log(`Found ${bulkImport.rows.length} records in fp_budget_bulk_import:\n`);
    
    bulkImport.rows.forEach((row, idx) => {
      console.log(`Record ${idx + 1}:`);
      console.log(`  ID: ${row.id}`);
      console.log(`  Batch: ${row.batch_id}`);
      console.log(`  Division: ${row.division}`);
      console.log(`  Sales Rep: "${row.sales_rep}"`);
      console.log(`  Budget Year: ${row.budget_year}`);
      console.log(`  Customer: "${row.customer}"`);
      console.log(`  Country: "${row.country}"`);
      console.log(`  Product Group: "${row.product_group}"`);
      console.log(`  Month Values: [${row.month_1}, ${row.month_2}, ${row.month_3}, ${row.month_4}, ${row.month_5}, ${row.month_6}, ${row.month_7}, ${row.month_8}, ${row.month_9}, ${row.month_10}, ${row.month_11}, ${row.month_12}]`);
      console.log(`  Total KG: ${row.total_kg}`);
      console.log(`  Status: ${row.status}`);
      console.log(`  Source: ${row.source_file}`);
      console.log('');
    });
    
    // 2. CHECK fp_sales_rep_budget table
    console.log('\n' + '-'.repeat(40));
    console.log('2. fp_sales_rep_budget TABLE');
    console.log('-'.repeat(40));
    
    const salesRepBudget = await pool.query(`
      SELECT id, division, salesrepname, customername, countryname, productgroup,
             budget_year, year, month, type, values_type, values
      FROM fp_sales_rep_budget
      ORDER BY id DESC
      LIMIT 30
    `);
    
    console.log(`Found ${salesRepBudget.rows.length} records in fp_sales_rep_budget:\n`);
    
    salesRepBudget.rows.forEach((row, idx) => {
      console.log(`Record ${idx + 1}: ID=${row.id}, SalesRep="${row.salesrepname}", Customer="${row.customername}", Country="${row.countryname}", PG="${row.productgroup}", Year=${row.budget_year}, Month=${row.month}, Type="${row.type}", ValType="${row.values_type}", Value=${row.values}`);
    });
    
    // 3. CHECK DISTINCT VALUES FOR CASE ANALYSIS
    console.log('\n' + '-'.repeat(40));
    console.log('3. NAME CASE ANALYSIS');
    console.log('-'.repeat(40));
    
    // Check sales rep names in both tables
    const salesRepNames = await pool.query(`
      SELECT DISTINCT 'bulk_import' as source, sales_rep as name FROM fp_budget_bulk_import
      UNION ALL
      SELECT DISTINCT 'sales_rep_budget' as source, salesrepname as name FROM fp_sales_rep_budget
      ORDER BY source, name
    `);
    
    console.log('\nSales Rep Names across tables:');
    salesRepNames.rows.forEach(row => {
      const caseType = row.name === row.name.toUpperCase() ? 'ALL CAPS' : 
                       row.name === row.name.toLowerCase() ? 'all lower' : 'Mixed Case';
      console.log(`  [${row.source}] "${row.name}" - ${caseType}`);
    });
    
    // 4. CHECK fp_data_excel for actual sales rep names
    console.log('\n' + '-'.repeat(40));
    console.log('4. ACTUAL SALES DATA (fp_data_excel)');
    console.log('-'.repeat(40));
    
    const actualSalesReps = await pool.query(`
      SELECT DISTINCT salesrepname
      FROM fp_data_excel
      WHERE division = 'FP' AND year = 2024
      ORDER BY salesrepname
      LIMIT 20
    `);
    
    console.log('\nSales Rep Names in fp_data_excel (FP/2024):');
    actualSalesReps.rows.forEach(row => {
      const caseType = row.salesrepname === row.salesrepname.toUpperCase() ? 'ALL CAPS' : 
                       row.salesrepname === row.salesrepname.toLowerCase() ? 'all lower' : 'Mixed Case';
      console.log(`  "${row.salesrepname}" - ${caseType}`);
    });
    
    // 5. CHECK CUSTOMER NAMES IN ACTUAL DATA
    console.log('\n' + '-'.repeat(40));
    console.log('5. CUSTOMER NAMES COMPARISON');
    console.log('-'.repeat(40));
    
    const budgetCustomers = await pool.query(`
      SELECT DISTINCT customer FROM fp_budget_bulk_import
      ORDER BY customer
    `);
    
    console.log('\nCustomers in budget data:');
    budgetCustomers.rows.forEach(row => {
      console.log(`  "${row.customer}"`);
    });
    
    // Check if these customers exist in actual data
    console.log('\nChecking if budget customers exist in actual sales data (fp_data_excel):');
    for (const row of budgetCustomers.rows) {
      const exists = await pool.query(`
        SELECT COUNT(*) as cnt FROM fp_data_excel 
        WHERE LOWER(TRIM(customername)) = LOWER(TRIM($1))
        AND division = 'FP'
      `, [row.customer]);
      console.log(`  "${row.customer}" - ${exists.rows[0].cnt > 0 ? '✅ EXISTS' : '❌ NOT FOUND'} (${exists.rows[0].cnt} matches)`);
    }
    
    // 6. QUERY USED BY FRONTEND
    console.log('\n' + '-'.repeat(40));
    console.log('6. TESTING FRONTEND QUERY');
    console.log('-'.repeat(40));
    
    const frontendQuery = await pool.query(`
      SELECT 
        TRIM(salesrepname) as salesrep,
        TRIM(customername) as customer,
        TRIM(countryname) as country,
        TRIM(productgroup) as productgroup,
        month,
        SUM(values) / 1000.0 as mt_value
      FROM fp_sales_rep_budget
      WHERE UPPER(division) = UPPER('FP')
        AND budget_year = 2026
        AND UPPER(type) = 'BUDGET'
        AND UPPER(values_type) = 'KGS'
      GROUP BY TRIM(salesrepname), TRIM(customername), TRIM(countryname), TRIM(productgroup), month
      ORDER BY TRIM(salesrepname), TRIM(customername), TRIM(countryname), TRIM(productgroup), month
    `);
    
    console.log(`\nFrontend budget query returns ${frontendQuery.rows.length} rows:`);
    frontendQuery.rows.forEach(row => {
      console.log(`  SalesRep="${row.salesrep}", Customer="${row.customer}", Country="${row.country}", PG="${row.productgroup}", Month=${row.month}, MT=${row.mt_value}`);
    });
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

comprehensiveAudit();
