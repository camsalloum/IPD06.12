const { Pool } = require('pg');

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'fp_database',
  user: 'postgres',
  password: '654883'
});

async function checkTables() {
  try {
    const result = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_name LIKE '%merge%' OR table_name LIKE '%customer%'
      ORDER BY table_name
    `);
    
    console.log('📋 All merge/customer tables:');
    result.rows.forEach(row => console.log('   -', row.table_name));
    
    // Check specific table columns
    const tablesToCheck = [
      'customer_merge_rules',
      'fp_customer_merge_rules',
      'division_customer_merge_rules',
      'fp_division_customer_merge_rules'
    ];
    
    for (const table of tablesToCheck) {
      const cols = await pool.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = $1 
        ORDER BY ordinal_position
      `, [table]);
      
      if (cols.rows.length === 0) {
        console.log(`\n❌ ${table}: DOES NOT EXIST`);
      } else {
        console.log(`\n✅ ${table}:`);
        console.log('   Columns:', cols.rows.map(c => c.column_name).join(', '));
        
        const count = await pool.query(`SELECT COUNT(*) FROM ${table}`);
        console.log('   Rows:', count.rows[0].count);
      }
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    pool.end();
  }
}

checkTables();
