const { Pool } = require('pg');

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'fp_database',
  user: 'postgres',
  password: '654883'
});

async function checkMergeRules() {
  try {
    // Check merge rules format
    console.log('📋 Sample merge rules from fp_division_customer_merge_rules:\n');
    const rules = await pool.query(`
      SELECT merged_customer_name, original_customers 
      FROM fp_division_customer_merge_rules 
      WHERE is_active = true AND status = 'ACTIVE' 
      LIMIT 5
    `);
    
    rules.rows.forEach((row, i) => {
      const originals = Array.isArray(row.original_customers) 
        ? row.original_customers 
        : JSON.parse(row.original_customers || '[]');
      console.log(`${i+1}. Merged Name: "${row.merged_customer_name}"`);
      console.log(`   Originals:`);
      originals.forEach(o => console.log(`     - "${o}"`));
      console.log('');
    });

    // Check raw customer names in fp_data_excel
    console.log('\n📋 Sample raw customer names from fp_data_excel:\n');
    const rawCustomers = await pool.query(`
      SELECT DISTINCT TRIM(customername) as customer
      FROM fp_data_excel
      WHERE customername IS NOT NULL AND TRIM(customername) != ''
      ORDER BY customer
      LIMIT 10
    `);
    rawCustomers.rows.forEach(r => console.log(`   "${r.customer}"`));

    // Check if normalization is needed
    console.log('\n📋 Checking for case/format inconsistencies...\n');
    const inconsistent = await pool.query(`
      SELECT 
        TRIM(customername) as original,
        LOWER(TRIM(customername)) as normalized
      FROM fp_data_excel
      WHERE customername IS NOT NULL 
        AND TRIM(customername) != ''
        AND TRIM(customername) != UPPER(TRIM(customername))
        AND TRIM(customername) != LOWER(TRIM(customername))
      GROUP BY TRIM(customername)
      LIMIT 5
    `);
    
    if (inconsistent.rows.length > 0) {
      console.log('Mixed case customer names found:');
      inconsistent.rows.forEach(r => console.log(`   "${r.original}"`));
    } else {
      console.log('No mixed case issues detected in sample');
    }

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    pool.end();
  }
}

checkMergeRules();
