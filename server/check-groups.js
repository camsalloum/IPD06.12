const { pool } = require('./database/config');

async function checkGroups() {
  try {
    console.log('🔍 Checking Sales Rep Groups in FP...\n');
    
    const result = await pool.query(
      "SELECT * FROM sales_rep_groups WHERE division = 'FP' ORDER BY group_name"
    );
    
    console.log(`Found ${result.rows.length} groups:\n`);
    
    result.rows.forEach((row, i) => {
      console.log(`${i + 1}. Group: "${row.group_name}"`);
      console.log(`   Members (${row.members.length}):`, row.members);
      console.log('');
    });
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkGroups();
