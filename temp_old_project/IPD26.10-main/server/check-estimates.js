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
    console.log('🔍 Checking Estimate records in database...\n');
    
    // Check if there are any estimates
    const checkQuery = `
      SELECT 
        type,
        month,
        values_type,
        COUNT(*) as record_count,
        SUM(values) as total_value
      FROM public.fp_data_excel
      WHERE UPPER(division) = 'FP' AND year = 2025
      GROUP BY type, month, values_type
      ORDER BY type, month, values_type
    `;
    
    const result = await pool.query(checkQuery);
    
    console.log('Records by Type, Month, and Values Type:');
    console.log('Type      | Month | Values Type | Records | Total Value');
    console.log('─'.repeat(70));
    
    let actualTotal = 0;
    let estimateTotal = 0;
    
    result.rows.forEach(row => {
      const value = parseFloat(row.total_value);
      console.log(`${row.type.padEnd(10)}| ${String(row.month).padStart(5)} | ${row.values_type.padEnd(11)} | ${String(row.record_count).padStart(7)} | ${value.toLocaleString('en-US', {maximumFractionDigits: 2})}`);
      
      if (row.type.toUpperCase() === 'ACTUAL' && row.values_type === 'AMOUNT') {
        actualTotal += value;
      } else if (row.type.toUpperCase() === 'ESTIMATE' && row.values_type === 'AMOUNT') {
        estimateTotal += value;
      }
    });
    
    console.log('\n' + '═'.repeat(70));
    console.log(`ACTUAL Total AMOUNT (Jan-Oct):  ${actualTotal.toLocaleString('en-US', {maximumFractionDigits: 2})}`);
    console.log(`ESTIMATE Total AMOUNT (Nov-Dec): ${estimateTotal.toLocaleString('en-US', {maximumFractionDigits: 2})}`);
    console.log(`Expected Estimate (Nov-Dec):     17,426,747.62`);
    console.log(`Difference:                      ${(estimateTotal - 17426747.62).toLocaleString('en-US', {maximumFractionDigits: 2})}`);
    
    await pool.end();
    
  } catch (err) {
    console.error('❌ Error:', err);
    await pool.end();
    process.exit(1);
  }
})();
