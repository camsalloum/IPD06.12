const { Pool } = require('pg');

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'fp_database',
  user: 'postgres',
  password: '654883'
});

// Helper function to convert to Proper Case
function toProperCase(str) {
  if (!str) return '';
  return str.toString().trim().toLowerCase()
    .replace(/(?:^|\s|[-/])\w/g, (match) => match.toUpperCase());
}

async function fixDatabaseNames() {
  console.log('\n' + '='.repeat(60));
  console.log('FIXING DATABASE NAME CASE');
  console.log('='.repeat(60) + '\n');
  
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // 1. Fix fp_sales_rep_budget table
    console.log('1. Fixing fp_sales_rep_budget table...\n');
    
    const budgetRecords = await client.query(`
      SELECT id, salesrepname, customername, countryname, productgroup 
      FROM fp_sales_rep_budget
    `);
    
    let fixedCount = 0;
    for (const row of budgetRecords.rows) {
      const newSalesRep = toProperCase(row.salesrepname);
      const newCustomer = toProperCase(row.customername);
      const newCountry = toProperCase(row.countryname);
      const newProductGroup = toProperCase(row.productgroup);
      
      // Only update if something changed
      if (newSalesRep !== row.salesrepname || 
          newCustomer !== row.customername ||
          newCountry !== row.countryname ||
          newProductGroup !== row.productgroup) {
        await client.query(`
          UPDATE fp_sales_rep_budget 
          SET salesrepname = $1, customername = $2, countryname = $3, productgroup = $4
          WHERE id = $5
        `, [newSalesRep, newCustomer, newCountry, newProductGroup, row.id]);
        
        console.log(`  Fixed ID ${row.id}:`);
        if (newSalesRep !== row.salesrepname) console.log(`    SalesRep: "${row.salesrepname}" -> "${newSalesRep}"`);
        if (newCustomer !== row.customername) console.log(`    Customer: "${row.customername}" -> "${newCustomer}"`);
        if (newCountry !== row.countryname) console.log(`    Country: "${row.countryname}" -> "${newCountry}"`);
        if (newProductGroup !== row.productgroup) console.log(`    ProductGroup: "${row.productgroup}" -> "${newProductGroup}"`);
        fixedCount++;
      }
    }
    console.log(`\n  ✅ Fixed ${fixedCount} records in fp_sales_rep_budget\n`);
    
    // 2. Fix fp_budget_bulk_import table
    console.log('2. Fixing fp_budget_bulk_import table...\n');
    
    const bulkRecords = await client.query(`
      SELECT id, sales_rep, customer, country, product_group 
      FROM fp_budget_bulk_import
    `);
    
    let bulkFixedCount = 0;
    for (const row of bulkRecords.rows) {
      const newSalesRep = toProperCase(row.sales_rep);
      const newCustomer = toProperCase(row.customer);
      const newCountry = toProperCase(row.country);
      const newProductGroup = toProperCase(row.product_group);
      
      // Only update if something changed
      if (newSalesRep !== row.sales_rep || 
          newCustomer !== row.customer ||
          newCountry !== row.country ||
          newProductGroup !== row.product_group) {
        await client.query(`
          UPDATE fp_budget_bulk_import 
          SET sales_rep = $1, customer = $2, country = $3, product_group = $4
          WHERE id = $5
        `, [newSalesRep, newCustomer, newCountry, newProductGroup, row.id]);
        
        console.log(`  Fixed ID ${row.id}:`);
        if (newSalesRep !== row.sales_rep) console.log(`    SalesRep: "${row.sales_rep}" -> "${newSalesRep}"`);
        if (newCustomer !== row.customer) console.log(`    Customer: "${row.customer}" -> "${newCustomer}"`);
        if (newCountry !== row.country) console.log(`    Country: "${row.country}" -> "${newCountry}"`);
        if (newProductGroup !== row.product_group) console.log(`    ProductGroup: "${row.product_group}" -> "${newProductGroup}"`);
        bulkFixedCount++;
      }
    }
    console.log(`\n  ✅ Fixed ${bulkFixedCount} records in fp_budget_bulk_import\n`);
    
    await client.query('COMMIT');
    
    // 3. Verify the fix
    console.log('3. Verifying the fix...\n');
    
    const verifyBudget = await client.query(`
      SELECT DISTINCT salesrepname FROM fp_sales_rep_budget ORDER BY salesrepname
    `);
    console.log('  Sales Rep Names in fp_sales_rep_budget:');
    verifyBudget.rows.forEach(row => {
      console.log(`    "${row.salesrepname}"`);
    });
    
    const verifyBulk = await client.query(`
      SELECT DISTINCT sales_rep FROM fp_budget_bulk_import ORDER BY sales_rep
    `);
    console.log('\n  Sales Rep Names in fp_budget_bulk_import:');
    verifyBulk.rows.forEach(row => {
      console.log(`    "${row.sales_rep}"`);
    });
    
    console.log('\n' + '='.repeat(60));
    console.log('DATABASE FIX COMPLETE');
    console.log('='.repeat(60) + '\n');
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

fixDatabaseNames();
