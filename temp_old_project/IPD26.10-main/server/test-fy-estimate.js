const { pool } = require('./database/config');

(async () => {
  try {
    console.log('Testing 2025 FY Estimate query for all Product Groups\n');
    console.log('This should return Actual (Jan-Oct) + Estimate (Nov-Dec) combined\n');
    
    // Test query that mimics what ProductGroupDataService does
    const query = `
      SELECT 
        productgroup,
        SUM(CASE WHEN values_type = 'KGS' THEN values ELSE 0 END) as kgs,
        SUM(CASE WHEN values_type = 'AMOUNT' THEN values ELSE 0 END) as amount,
        SUM(CASE WHEN values_type = 'MORM' THEN values ELSE 0 END) as morm,
        COUNT(*) as record_count
      FROM fp_data_excel 
      WHERE year = 2025
        AND month IN (1,2,3,4,5,6,7,8,9,10,11,12)
        AND UPPER(type) IN ('ACTUAL', 'ESTIMATE')
      GROUP BY productgroup
      ORDER BY amount DESC
    `;
    
    const result = await pool.query(query);
    
    console.log('================================================');
    console.log('2025 FY ESTIMATE - ALL PRODUCT GROUPS');
    console.log('================================================\n');
    
    let totalAmount = 0;
    let totalKgs = 0;
    let totalMorm = 0;
    
    result.rows.forEach((row, index) => {
      console.log(`${index + 1}. ${row.productgroup}`);
      console.log(`   AMOUNT: ${parseFloat(row.amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
      console.log(`   KGS: ${parseFloat(row.kgs).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
      console.log(`   MORM: ${parseFloat(row.morm).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
      console.log(`   Records: ${row.record_count}\n`);
      
      totalAmount += parseFloat(row.amount);
      totalKgs += parseFloat(row.kgs);
      totalMorm += parseFloat(row.morm);
    });
    
    console.log('================================================');
    console.log('GRAND TOTALS (FY 2025 - Actual + Estimate)');
    console.log('================================================');
    console.log(`AMOUNT: ${totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
    console.log(`KGS: ${totalKgs.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
    console.log(`MORM: ${totalMorm.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
    console.log(`\nTotal Product Groups: ${result.rows.length}`);
    
    console.log('\n================================================');
    console.log('BREAKDOWN BY TYPE');
    console.log('================================================\n');
    
    // Get breakdown by type
    const breakdownQuery = `
      SELECT 
        type,
        SUM(CASE WHEN values_type = 'AMOUNT' THEN values ELSE 0 END) as amount,
        COUNT(*) as record_count
      FROM fp_data_excel 
      WHERE year = 2025
        AND month IN (1,2,3,4,5,6,7,8,9,10,11,12)
        AND UPPER(type) IN ('ACTUAL', 'ESTIMATE')
      GROUP BY type
      ORDER BY type
    `;
    
    const breakdownResult = await pool.query(breakdownQuery);
    
    breakdownResult.rows.forEach(row => {
      console.log(`${row.type}:`);
      console.log(`  AMOUNT: ${parseFloat(row.amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
      console.log(`  Records: ${row.record_count}\n`);
    });
    
    await pool.end();
    
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
})();
