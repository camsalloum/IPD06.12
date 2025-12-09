const { Pool } = require('pg');

const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'fp_database',
  password: 'admin',
  port: 5432,
});

async function checkConstraints() {
  const client = await pool.connect();
  try {
    console.log('Checking constraints for fp_divisional_budget...');
    
    const res = await client.query(`
      SELECT indexname, indexdef 
      FROM pg_indexes 
      WHERE tablename = 'fp_divisional_budget';
    `);
    
    console.log('Found indexes:');
    res.rows.forEach(row => {
      console.log(`- ${row.indexname}: ${row.indexdef}`);
    });

    const uniqueIndex = res.rows.find(row => 
      row.indexdef.includes('UNIQUE INDEX') && 
      row.indexdef.includes('division') && 
      row.indexdef.includes('year') && 
      row.indexdef.includes('month') && 
      row.indexdef.includes('product_group') && 
      row.indexdef.includes('metric')
    );

    if (uniqueIndex) {
      console.log('\n✅ REQUIRED UNIQUE INDEX EXISTS!');
    } else {
      console.log('\n❌ MISSING REQUIRED UNIQUE INDEX! The ON CONFLICT clause will fail.');
    }

  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    client.release();
    pool.end();
  }
}

checkConstraints();