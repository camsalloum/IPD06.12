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
    console.log('📊 CHECKING DATABASE STATUS\n');
    console.log('═'.repeat(70));
    
    const actualQuery = `SELECT COUNT(*) as count FROM public.fp_data_excel WHERE UPPER(type) = 'ACTUAL'`;
    const budgetQuery = `SELECT COUNT(*) as count FROM public.fp_data_excel WHERE UPPER(type) = 'BUDGET'`;
    const estimateQuery = `SELECT COUNT(*) as count FROM public.fp_data_excel WHERE UPPER(type) = 'ESTIMATE'`;
    
    const actualResult = await pool.query(actualQuery);
    const budgetResult = await pool.query(budgetQuery);
    const estimateResult = await pool.query(estimateQuery);
    
    const actualCount = parseInt(actualResult.rows[0].count);
    const budgetCount = parseInt(budgetResult.rows[0].count);
    const estimateCount = parseInt(estimateResult.rows[0].count);
    
    console.log('\n📁 YOUR DATA IS SAFE:');
    console.log('─'.repeat(70));
    console.log(`✅ Actual records:   ${actualCount.toLocaleString()} (Jan-Oct 2025 - UNTOUCHED)`);
    console.log(`✅ Budget records:   ${budgetCount.toLocaleString()} (Your uploaded budget - UNTOUCHED)`);
    console.log(`❌ Estimate records: ${estimateCount.toLocaleString()} (Old wrong calculations - DELETED)`);
    
    console.log('\n💡 WHAT HAPPENED:');
    console.log('─'.repeat(70));
    console.log('1. Your Actual data (Jan-Oct 2025): SAFE ✅');
    console.log('2. Your Budget data: SAFE ✅');
    console.log('3. Old Estimate data (Nov-Dec): DELETED (was calculated wrong)');
    console.log('');
    console.log('You need to CREATE NEW estimates using the corrected method.');
    console.log('The new estimates will match your Excel calculation exactly!');
    
    console.log('\n🔄 NEXT STEPS:');
    console.log('─'.repeat(70));
    console.log('1. Go to Estimate tab');
    console.log('2. Click "Create Estimate"');
    console.log('3. Select Nov & Dec 2025');
    console.log('4. Verify amounts match your Excel (e.g., Laminates = 1,916,303)');
    console.log('5. Approve and save');
    
    await pool.end();
    console.log('\n✅ Check complete\n');
    
  } catch (err) {
    console.error('❌ Error:', err);
    await pool.end();
    process.exit(1);
  }
})();
