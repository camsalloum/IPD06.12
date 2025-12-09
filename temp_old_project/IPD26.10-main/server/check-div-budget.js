const { Pool } = require('pg');

const pool = new Pool({
  host: 'localhost',
  database: 'fp_database',
  user: 'postgres',
  password: '654883',
  port: 5432
});

async function check() {
  try {
    // Check what's in divisional budget
    const result = await pool.query(`
      SELECT division, year, month, product_group, metric, value 
      FROM fp_divisional_budget 
      ORDER BY division, year, month, product_group
      LIMIT 30
    `);
    
    console.log('=== DIVISIONAL BUDGET DATA ===');
    console.log('Total rows found:', result.rows.length);
    console.log(JSON.stringify(result.rows, null, 2));
    
    // Check distinct divisions and years
    const summary = await pool.query(`
      SELECT division, year, COUNT(*) as count
      FROM fp_divisional_budget 
      GROUP BY division, year
      ORDER BY division, year
    `);
    
    console.log('\n=== SUMMARY BY DIVISION/YEAR ===');
    console.log(JSON.stringify(summary.rows, null, 2));
    
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await pool.end();
  }
}

check();
