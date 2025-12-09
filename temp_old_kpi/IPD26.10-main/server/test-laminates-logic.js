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
    console.log('=== LAMINATES EXAMPLE - Understanding the Estimation Logic ===\n');
    
    const division = 'FP';
    const year = 2025;
    const basePeriodMonths = [1,2,3,4,5,6,7,8,9,10];
    
    console.log('📊 YOUR EXCEL METHOD (Simple Average):');
    console.log('─'.repeat(60));
    
    // Step 1: Get total for Laminates AMOUNT
    const totalQuery = `
      SELECT SUM(values) as total, COUNT(*) as record_count
      FROM public.fp_data_excel
      WHERE UPPER(division) = $1 
        AND UPPER(type) = 'ACTUAL' 
        AND year = $2 
        AND month = ANY($3)
        AND UPPER(productgroup) = 'LAMINATES'
        AND UPPER(values_type) = 'AMOUNT'
    `;
    
    const totalResult = await pool.query(totalQuery, [division, year, basePeriodMonths]);
    const total = parseFloat(totalResult.rows[0].total);
    const recordCount = parseInt(totalResult.rows[0].record_count);
    
    console.log(`Total AMOUNT for Laminates (Jan-Oct): ${total.toLocaleString('en-US', {maximumFractionDigits: 2})}`);
    console.log(`Total records: ${recordCount.toLocaleString()}`);
    console.log(`Average per month (Total ÷ 10 months): ${(total/10).toLocaleString('en-US', {maximumFractionDigits: 2})}`);
    console.log(`For 2 months (Nov-Dec): ${(total/10 * 2).toLocaleString('en-US', {maximumFractionDigits: 2})}`);
    
    console.log('\n🔧 SYSTEM METHOD (Dimension-Level Averages):');
    console.log('─'.repeat(60));
    
    // Step 2: Get dimension-level averages
    const dimensionQuery = `
      SELECT 
        customername,
        countryname,
        salesrepname,
        material,
        process,
        AVG(values) as avg_value,
        COUNT(*) as month_count
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
    
    console.log(`Found ${dimensionResult.rows.length} unique dimension combinations`);
    console.log('\nTop 5 dimension combinations by average value:');
    
    dimensionResult.rows.slice(0, 5).forEach((row, idx) => {
      const avg = parseFloat(row.avg_value);
      console.log(`  [${idx+1}] Customer: ${row.customername.substring(0,35).padEnd(35)} | Avg/Month: ${avg.toLocaleString('en-US', {maximumFractionDigits: 2}).padStart(15)} | Months: ${row.month_count}`);
    });
    
    console.log(`  ... (${dimensionResult.rows.length - 5} more combinations)\n`);
    
    // Calculate sum of all averages
    const totalSumOfAverages = dimensionResult.rows.reduce((sum, row) => sum + parseFloat(row.avg_value), 0);
    
    console.log(`Sum of ALL ${dimensionResult.rows.length} dimension averages: ${totalSumOfAverages.toLocaleString('en-US', {maximumFractionDigits: 2})}`);
    console.log(`This becomes the estimated AMOUNT per month for Laminates`);
    console.log(`For 2 months (Nov-Dec): ${(totalSumOfAverages * 2).toLocaleString('en-US', {maximumFractionDigits: 2})}`);
    
    console.log('\n🎯 THE DIFFERENCE:');
    console.log('─'.repeat(60));
    console.log(`Your Excel method (Simple):     ${(total/10).toLocaleString('en-US', {maximumFractionDigits: 2})} per month`);
    console.log(`System method (Dimension AVG):  ${totalSumOfAverages.toLocaleString('en-US', {maximumFractionDigits: 2})} per month`);
    console.log(`Difference:                     ${Math.abs(totalSumOfAverages - total/10).toLocaleString('en-US', {maximumFractionDigits: 2})}`);
    console.log(`Percentage difference:          ${((Math.abs(totalSumOfAverages - total/10) / (total/10)) * 100).toFixed(2)}%`);
    
    console.log('\n💡 WHY THE DIFFERENCE?');
    console.log('─'.repeat(60));
    console.log('Your method:  SUM(all records for 10 months) ÷ 10');
    console.log('System method: AVG(each dimension across 10 months), then SUM all averages');
    console.log('\nExample: If a customer has sales in only 5 months (not all 10):');
    console.log('  Your method: Includes all 5 months in the total, divides by 10');
    console.log('  System method: Averages only those 5 months for that customer');
    console.log('\nThe system preserves dimension-level patterns, your method is simpler.');
    
    await pool.end();
    console.log('\n✅ Analysis complete\n');
    
  } catch (err) {
    console.error('❌ Error:', err);
    await pool.end();
    process.exit(1);
  }
})();
