const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, 'server', '.env') });

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'fp_database',
  user: 'postgres',
  password: process.env.DB_PASSWORD
});

async function checkTable() {
  try {
    // Check constraints
    const constraints = await pool.query(`
      SELECT conname, pg_get_constraintdef(oid) as definition
      FROM pg_constraint
      WHERE conrelid = 'fp_divisional_budget'::regclass
    `);
    console.log('=== Constraints ===');
    constraints.rows.forEach(row => console.log(row.conname, ':', row.definition));
    
    // Check indexes
    const indexes = await pool.query(`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE tablename = 'fp_divisional_budget'
    `);
    console.log('\n=== Indexes ===');
    indexes.rows.forEach(row => console.log(row.indexname, ':', row.indexdef));
    
    // Check current data
    const data = await pool.query(`
      SELECT COUNT(*) as count, division, year, metric
      FROM fp_divisional_budget
      GROUP BY division, year, metric
      ORDER BY division, year, metric
    `);
    console.log('\n=== Current Data ===');
    data.rows.forEach(row => console.log(`${row.division} ${row.year} ${row.metric}: ${row.count} records`));
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkTable();
