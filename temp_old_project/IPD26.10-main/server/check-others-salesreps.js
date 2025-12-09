const { Pool } = require('pg');
const pool = new Pool({ 
  user: 'postgres', 
  host: 'localhost', 
  database: 'fp_database', 
  password: '654883', 
  port: 5432 
});

async function checkOthersSalesReps() {
  // Get all sales reps with their totals
  const query = `
    SELECT 
      TRIM(UPPER(salesrepname)) as salesrepname,
      SUM(CASE WHEN UPPER(values_type) = 'AMOUNT' THEN values ELSE 0 END) as total_value 
    FROM public.fp_data_excel
    WHERE division = 'FP' 
    AND type = 'Actual'
    AND year = 2020
    AND month = 1
    GROUP BY TRIM(UPPER(salesrepname))
    ORDER BY total_value DESC
  `;
  
  const result = await pool.query(query);
  
  console.log('\n=== ALL SALES REPS IN DATABASE FOR FP 2020 JAN ===');
  console.log('Total sales reps:', result.rows.length);
  console.log('\nBreakdown:');
  
  let grandTotal = 0;
  result.rows.forEach((row, index) => {
    console.log(`${index + 1}. ${row.salesrepname}: ${parseFloat(row.total_value).toLocaleString()}`);
    grandTotal += parseFloat(row.total_value);
  });
  
  console.log('\n=== GRAND TOTAL ===');
  console.log(`Total sales: ${grandTotal.toLocaleString()}`);
  
  // Now check the sales rep groups
  console.log('\n=== CHECKING SALES REP GROUPS ===');
  const groupsQuery = `
    SELECT setting_value 
    FROM public.universal_settings 
    WHERE division = 'FP' 
    AND setting_key = 'salesRepGroups'
  `;
  
  const groupsResult = await pool.query(groupsQuery);
  if (groupsResult.rows.length > 0) {
    const groups = JSON.parse(groupsResult.rows[0].setting_value);
    console.log('Groups configuration:');
    Object.keys(groups).forEach(groupName => {
      console.log(`\n${groupName}:`);
      groups[groupName].forEach(member => {
        console.log(`  - ${member}`);
      });
    });
  } else {
    console.log('No sales rep groups configured for FP division');
  }
  
  pool.end();
}

checkOthersSalesReps().catch(err => {
  console.error('Error:', err);
  pool.end();
});
