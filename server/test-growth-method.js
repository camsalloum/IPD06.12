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
    console.log('=== COMPARING 3 ESTIMATION METHODS FOR LAMINATES ===\n');
    
    const division = 'FP';
    const year = 2025;
    const basePeriodMonths = [1,2,3,4,5,6,7,8,9,10];
    
    // METHOD 1: Your Excel Method (Simple Average)
    console.log('📊 METHOD 1: Your Excel Method (Simple Total ÷ Months)');
    console.log('─'.repeat(70));
    
    const method1Query = `
      SELECT 
        SUM(values) as total
      FROM public.fp_data_excel
      WHERE UPPER(division) = $1 
        AND UPPER(type) = 'ACTUAL' 
        AND year = $2 
        AND month = ANY($3)
        AND UPPER(productgroup) = 'LAMINATES'
        AND UPPER(values_type) = 'AMOUNT'
    `;
    
    const method1Result = await pool.query(method1Query, [division, year, basePeriodMonths]);
    const method1Total = parseFloat(method1Result.rows[0].total);
    const method1PerMonth = method1Total / basePeriodMonths.length;
    
    console.log(`Total (Jan-Oct): ${method1Total.toLocaleString('en-US', {maximumFractionDigits: 2})}`);
    console.log(`Per month: ${method1PerMonth.toLocaleString('en-US', {maximumFractionDigits: 2})}`);
    console.log(`Nov estimate: ${method1PerMonth.toLocaleString('en-US', {maximumFractionDigits: 2})}`);
    console.log(`Dec estimate: ${method1PerMonth.toLocaleString('en-US', {maximumFractionDigits: 2})}`);
    console.log(`Total Nov+Dec: ${(method1PerMonth * 2).toLocaleString('en-US', {maximumFractionDigits: 2})}`);
    
    // METHOD 2: Current System (Dimension-level Average)
    console.log('\n📊 METHOD 2: Current System (AVG per Dimension, then SUM)');
    console.log('─'.repeat(70));
    
    const method2Query = `
      SELECT 
        AVG(values) as avg_value
      FROM public.fp_data_excel
      WHERE UPPER(division) = $1 
        AND UPPER(type) = 'ACTUAL' 
        AND year = $2 
        AND month = ANY($3)
        AND UPPER(productgroup) = 'LAMINATES'
        AND UPPER(values_type) = 'AMOUNT'
      GROUP BY salesrepname, customername, countryname, material, process
    `;
    
    const method2Result = await pool.query(method2Query, [division, year, basePeriodMonths]);
    const method2PerMonth = method2Result.rows.reduce((sum, row) => sum + parseFloat(row.avg_value), 0);
    
    console.log(`Sum of dimension averages: ${method2PerMonth.toLocaleString('en-US', {maximumFractionDigits: 2})}`);
    console.log(`Nov estimate: ${method2PerMonth.toLocaleString('en-US', {maximumFractionDigits: 2})}`);
    console.log(`Dec estimate: ${method2PerMonth.toLocaleString('en-US', {maximumFractionDigits: 2})}`);
    console.log(`Total Nov+Dec: ${(method2PerMonth * 2).toLocaleString('en-US', {maximumFractionDigits: 2})}`);
    
    // METHOD 3: Growth Rate Method (New Proposal)
    console.log('\n📊 METHOD 3: Growth Rate Method (Linear Extrapolation)');
    console.log('─'.repeat(70));
    
    // Get monthly data per dimension
    const method3Query = `
      SELECT 
        salesrepname,
        customername,
        countryname,
        material,
        process,
        month,
        SUM(values) as monthly_value
      FROM public.fp_data_excel
      WHERE UPPER(division) = $1 
        AND UPPER(type) = 'ACTUAL' 
        AND year = $2 
        AND month = ANY($3)
        AND UPPER(productgroup) = 'LAMINATES'
        AND UPPER(values_type) = 'AMOUNT'
      GROUP BY salesrepname, customername, countryname, material, process, month
      ORDER BY salesrepname, customername, countryname, material, process, month
    `;
    
    const method3Result = await pool.query(method3Query, [division, year, basePeriodMonths]);
    
    // Group by dimension and calculate growth rate
    const dimensionData = new Map();
    
    method3Result.rows.forEach(row => {
      const key = `${row.salesrepname}|${row.customername}|${row.countryname}|${row.material}|${row.process}`;
      if (!dimensionData.has(key)) {
        dimensionData.set(key, []);
      }
      dimensionData.get(key).push({
        month: row.month,
        value: parseFloat(row.monthly_value)
      });
    });
    
    let method3Nov = 0;
    let method3Dec = 0;
    let dimensionsWithGrowth = 0;
    let dimensionsWithoutGrowth = 0;
    
    console.log(`Processing ${dimensionData.size} unique dimensions...\n`);
    console.log('Sample calculations (first 5):');
    
    let sampleCount = 0;
    dimensionData.forEach((months, dimKey) => {
      // Sort by month
      months.sort((a, b) => a.month - b.month);
      
      let novEstimate, decEstimate;
      
      if (months.length >= 2) {
        // Calculate month-to-month growth rates
        const growthRates = [];
        for (let i = 1; i < months.length; i++) {
          if (months[i-1].value > 0) {
            const growth = (months[i].value - months[i-1].value) / months[i-1].value;
            growthRates.push(growth);
          }
        }
        
        if (growthRates.length > 0) {
          const avgGrowth = growthRates.reduce((a, b) => a + b, 0) / growthRates.length;
          const lastValue = months[months.length - 1].value;
          novEstimate = lastValue * (1 + avgGrowth);
          decEstimate = novEstimate * (1 + avgGrowth);
          dimensionsWithGrowth++;
          
          if (sampleCount < 5) {
            const customerName = dimKey.split('|')[1].substring(0, 25);
            console.log(`  ${customerName.padEnd(25)} | Last: ${lastValue.toLocaleString('en-US', {maximumFractionDigits: 0}).padStart(10)} | Growth: ${(avgGrowth*100).toFixed(1).padStart(6)}% | Nov: ${novEstimate.toLocaleString('en-US', {maximumFractionDigits: 0}).padStart(10)}`);
            sampleCount++;
          }
        } else {
          // No growth rates, use average
          const avg = months.reduce((sum, m) => sum + m.value, 0) / months.length;
          novEstimate = decEstimate = avg;
          dimensionsWithoutGrowth++;
        }
      } else {
        // Only 1 month, use that value
        const avg = months.reduce((sum, m) => sum + m.value, 0) / months.length;
        novEstimate = decEstimate = avg;
        dimensionsWithoutGrowth++;
      }
      
      method3Nov += novEstimate;
      method3Dec += decEstimate;
    });
    
    console.log(`\nDimensions with growth calculation: ${dimensionsWithGrowth}`);
    console.log(`Dimensions with simple average: ${dimensionsWithoutGrowth}`);
    console.log(`\nNov estimate: ${method3Nov.toLocaleString('en-US', {maximumFractionDigits: 2})}`);
    console.log(`Dec estimate: ${method3Dec.toLocaleString('en-US', {maximumFractionDigits: 2})}`);
    console.log(`Total Nov+Dec: ${(method3Nov + method3Dec).toLocaleString('en-US', {maximumFractionDigits: 2})}`);
    
    // COMPARISON
    console.log('\n🎯 COMPARISON SUMMARY');
    console.log('═'.repeat(70));
    console.log('Method                          | Per Month   | Nov+Dec Total | vs Method 1');
    console.log('─'.repeat(70));
    console.log(`Method 1 (Excel Simple)         | ${method1PerMonth.toLocaleString('en-US', {maximumFractionDigits: 0}).padStart(11)} | ${(method1PerMonth * 2).toLocaleString('en-US', {maximumFractionDigits: 0}).padStart(13)} | Baseline`);
    console.log(`Method 2 (Current System)       | ${method2PerMonth.toLocaleString('en-US', {maximumFractionDigits: 0}).padStart(11)} | ${(method2PerMonth * 2).toLocaleString('en-US', {maximumFractionDigits: 0}).padStart(13)} | +${((method2PerMonth/method1PerMonth - 1) * 100).toFixed(0)}%`);
    console.log(`Method 3 (Growth Rate)          | ${((method3Nov + method3Dec)/2).toLocaleString('en-US', {maximumFractionDigits: 0}).padStart(11)} | ${(method3Nov + method3Dec).toLocaleString('en-US', {maximumFractionDigits: 0}).padStart(13)} | +${(((method3Nov + method3Dec)/(method1PerMonth * 2) - 1) * 100).toFixed(0)}%`);
    
    console.log('\n💡 ANALYSIS:');
    console.log('─'.repeat(70));
    console.log('Method 1: Simple, conservative, treats all periods equally');
    console.log('Method 2: Over-weights customers with fewer months (219% higher)');
    console.log('Method 3: Considers trends, but still dimension-based (similar issue to Method 2)');
    console.log('\nMethod 3 is MORE COMPLEX but still has the dimension-weighting issue.');
    console.log('It also assumes recent trends will continue (may not be realistic).');
    
    await pool.end();
    console.log('\n✅ Analysis complete\n');
    
  } catch (err) {
    console.error('❌ Error:', err);
    await pool.end();
    process.exit(1);
  }
})();
