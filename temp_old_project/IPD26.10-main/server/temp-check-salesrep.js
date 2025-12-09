const { Pool } = require('pg');
const pool = new Pool({ 
  user: 'postgres', 
  host: 'localhost', 
  database: 'fp_database', 
  password: '654883', 
  port: 5432 
});

pool.query("SELECT DISTINCT salesrepname FROM public.fp_data_excel WHERE division = 'FP' AND type = 'Actual' ORDER BY salesrepname")
  .then(result => {
    console.log('Sales Reps in database:', result.rows);
    console.log('Total:', result.rows.length);
    pool.end();
  })
  .catch(err => {
    console.error('Error:', err);
    pool.end();
  });
