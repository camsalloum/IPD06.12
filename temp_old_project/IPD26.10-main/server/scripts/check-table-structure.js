/**
 * Check fp_data_excel table structure
 */

const { pool } = require('../database/config');

async function checkTableStructure() {
  try {
    // Get column information
    const result = await pool.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'fp_data_excel'
      ORDER BY ordinal_position
    `);

    console.log('\n📊 fp_data_excel Table Structure:\n');
    console.log('Columns:');
    result.rows.forEach(row => {
      console.log(`  - ${row.column_name} (${row.data_type})`);
    });

    // Get sample row
    const sampleResult = await pool.query(`
      SELECT * FROM fp_data_excel LIMIT 1
    `);

    if (sampleResult.rows.length > 0) {
      console.log('\n📄 Sample Row (first 10 columns):');
      const sample = sampleResult.rows[0];
      Object.keys(sample).slice(0, 10).forEach(key => {
        console.log(`  ${key}: ${sample[key]}`);
      });
    }

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkTableStructure();
