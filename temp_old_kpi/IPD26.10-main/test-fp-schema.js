const { pool } = require('./server/database/config');
const fs = require('fs');
const path = require('path');

(async () => {
  try {
    const sqlPath = path.join(__dirname, 'server/scripts/create-fp-divisional-budget-table.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    console.log('Running SQL to create fp_divisional_budget table...');
    const result = await pool.query(sql);
    console.log('Table created successfully!');
    console.log(result);
  } catch(e) { 
    console.error('Error:', e.message); 
  } finally { 
    await pool.end(); 
  }
})();
