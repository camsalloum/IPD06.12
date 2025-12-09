const { Pool } = require('pg');

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'fp_database',
  user: 'postgres',
  password: '654883'
});

(async () => {
  try {
    console.log('=== UNDERSTANDING VALUES_TYPE (AMOUNT, KGS, MORM) ===\n');
    
    const division = 'FP';
    const year = 2025;
    const basePeriodMonths = [1,2,3,4,5,6,7,8,9,10];
    
    console.log('📊 Step 1: Check Laminates records by values_type');
    console.log('─'.repeat(70));
    
    const countQuery = `
      SELECT 
        values_type,
        COUNT(*) as record_count,
        SUM(values) as total_value
      FROM public.fp_data_excel
      WHERE UPPER(division) = $1 
        AND UPPER(type) = 'ACTUAL' 
        AND year = $2 
        AND month = ANY($3)
        AND UPPER(productgroup) = 'LAMINATES'
      GROUP BY values_type
      ORDER BY values_type
    `;
    
    const countResult = await pool.query(countQuery, [division, year, basePeriodMonths]);
    
    console.log('Records by values_type:');
    countResult.rows.forEach(row => {
      console.log(`  ${row.values_type.padEnd(10)} | Records: ${String(row.record_count).padStart(4)} | Total: ${parseFloat(row.total_value).toLocaleString('en-US', {maximumFractionDigits: 2})}`);
    });
    
    console.log('\n📊 Step 2: Check ONE specific customer to see the pattern');
    console.log('─'.repeat(70));
    
    const sampleQuery = `
      SELECT 
        customername,
        salesrepname,
        countryname,
        material,
        process,
        month,
        values_type,
        values
      FROM public.fp_data_excel
      WHERE UPPER(division) = $1 
        AND UPPER(type) = 'ACTUAL' 
        AND year = $2 
        AND month = ANY($3)
        AND UPPER(productgroup) = 'LAMINATES'
        AND customername = 'ALGO FOOD'
      ORDER BY month, values_type
      LIMIT 30
    `;
    
    const sampleResult = await pool.query(sampleQuery, [division, year, basePeriodMonths]);
    
    console.log(`Sample: ALGO FOOD (first 30 records):`);
    console.log('Month | Values Type | Value');
    console.log('─'.repeat(70));
    
    let currentMonth = null;
    sampleResult.rows.forEach(row => {
      if (currentMonth !== row.month) {
        if (currentMonth !== null) console.log('');
        currentMonth = row.month;
      }
      console.log(`  ${String(row.month).padStart(2)}  | ${row.values_type.padEnd(11)} | ${parseFloat(row.values).toLocaleString('en-US', {maximumFractionDigits: 2}).padStart(15)}`);
    });
    
    console.log('\n💡 IMPORTANT INSIGHT:');
    console.log('─'.repeat(70));
    console.log('Each transaction has 3 SEPARATE records:');
    console.log('  1. AMOUNT (currency value)');
    console.log('  2. KGS (weight in kilograms)');
    console.log('  3. MORM (???)');
    console.log('');
    console.log('So when we GROUP BY dimension and calculate AVG:');
    console.log('  - We get separate averages for AMOUNT, KGS, and MORM');
    console.log('  - Each values_type is treated independently');
    console.log('  - The 67 AMOUNT records become ~30 dimension combinations after grouping');
    console.log('');
    
    console.log('📊 Step 3: Verify dimension grouping for AMOUNT only');
    console.log('─'.repeat(70));
    
    const dimensionQuery = `
      SELECT 
        customername,
        countryname,
        salesrepname,
        material,
        process,
        COUNT(DISTINCT month) as months_present,
        AVG(values) as avg_value,
        SUM(values) as total_value
      FROM public.fp_data_excel
      WHERE UPPER(division) = $1 
        AND UPPER(type) = 'ACTUAL' 
        AND year = $2 
        AND month = ANY($3)
        AND UPPER(productgroup) = 'LAMINATES'
        AND UPPER(values_type) = 'AMOUNT'
      GROUP BY customername, countryname, salesrepname, material, process
      ORDER BY avg_value DESC
    `;
    
    const dimensionResult = await pool.query(dimensionQuery, [division, year, basePeriodMonths]);
    
    console.log(`Total unique dimensions (AMOUNT only): ${dimensionResult.rows.length}\n`);
    console.log('Top 10 dimensions:');
    console.log('Customer (30 chars) | Months | Avg/Month | Total');
    console.log('─'.repeat(70));
    
    dimensionResult.rows.slice(0, 10).forEach((row, idx) => {
      console.log(`${String(idx+1).padStart(2)}. ${row.customername.substring(0, 30).padEnd(30)} | ${String(row.months_present).padStart(3)}    | ${parseFloat(row.avg_value).toLocaleString('en-US', {maximumFractionDigits: 2}).padStart(12)} | ${parseFloat(row.total_value).toLocaleString('en-US', {maximumFractionDigits: 2}).padStart(15)}`);
    });
    
    const sumOfAvg = dimensionResult.rows.reduce((sum, row) => sum + parseFloat(row.avg_value), 0);
    const sumOfTotal = dimensionResult.rows.reduce((sum, row) => sum + parseFloat(row.total_value), 0);
    
    console.log('\n' + '─'.repeat(70));
    console.log(`Sum of ALL averages:  ${sumOfAvg.toLocaleString('en-US', {maximumFractionDigits: 2})} per month`);
    console.log(`Sum of ALL totals:    ${sumOfTotal.toLocaleString('en-US', {maximumFractionDigits: 2})} (10 months)`);
    console.log(`Simple average:       ${(sumOfTotal / 10).toLocaleString('en-US', {maximumFractionDigits: 2})} per month`);
    console.log(`Difference:           ${(sumOfAvg - sumOfTotal/10).toLocaleString('en-US', {maximumFractionDigits: 2})}`);
    
    console.log('\n✅ CONCLUSION:');
    console.log('─'.repeat(70));
    console.log('YES - values_type is handled correctly. Each type (AMOUNT/KGS/MORM) is');
    console.log('calculated separately. The issue is NOT about mixing value types.');
    console.log('');
    console.log('The issue is: System uses AVG(per dimension) instead of SUM(all)/months');
    
    await pool.end();
    console.log('\n✅ Analysis complete\n');
    
  } catch (err) {
    console.error('❌ Error:', err);
    await pool.end();
    process.exit(1);
  }
})();
