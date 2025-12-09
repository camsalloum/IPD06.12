/**
 * Create bulk import table for storing merged budget imports
 * Run: node create-bulk-import-table.js
 */
require('dotenv').config({ path: './server/.env' });
const { Pool } = require('pg');

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST || process.env.DB_SERVER,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT || 5432,
});

async function createTable() {
  const client = await pool.connect();
  try {
    console.log('Connected to database');

    // Create the bulk import table
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS fp_budget_bulk_import (
        id SERIAL PRIMARY KEY,
        batch_id VARCHAR(50) NOT NULL,
        division VARCHAR(10) NOT NULL,
        sales_rep VARCHAR(100) NOT NULL,
        budget_year INT NOT NULL,
        customer VARCHAR(200),
        country VARCHAR(100),
        product_group VARCHAR(100),
        month_1 DECIMAL(18,2) DEFAULT 0,
        month_2 DECIMAL(18,2) DEFAULT 0,
        month_3 DECIMAL(18,2) DEFAULT 0,
        month_4 DECIMAL(18,2) DEFAULT 0,
        month_5 DECIMAL(18,2) DEFAULT 0,
        month_6 DECIMAL(18,2) DEFAULT 0,
        month_7 DECIMAL(18,2) DEFAULT 0,
        month_8 DECIMAL(18,2) DEFAULT 0,
        month_9 DECIMAL(18,2) DEFAULT 0,
        month_10 DECIMAL(18,2) DEFAULT 0,
        month_11 DECIMAL(18,2) DEFAULT 0,
        month_12 DECIMAL(18,2) DEFAULT 0,
        total_kg DECIMAL(18,2) DEFAULT 0,
        total_amount DECIMAL(18,2) DEFAULT 0,
        total_morm DECIMAL(18,2) DEFAULT 0,
        status VARCHAR(20) DEFAULT 'draft',
        source_file VARCHAR(255),
        imported_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        imported_by VARCHAR(100)
      );
    `;

    await client.query(createTableSQL);
    console.log('✅ Table fp_budget_bulk_import created (or already exists)');

    // Create indexes
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_bulk_batch_id ON fp_budget_bulk_import(batch_id)',
      'CREATE INDEX IF NOT EXISTS idx_bulk_division ON fp_budget_bulk_import(division)',
      'CREATE INDEX IF NOT EXISTS idx_bulk_sales_rep ON fp_budget_bulk_import(sales_rep)',
      'CREATE INDEX IF NOT EXISTS idx_bulk_status ON fp_budget_bulk_import(status)'
    ];

    for (const idx of indexes) {
      await client.query(idx);
    }
    console.log('✅ Indexes created');

    console.log('✅ Table creation completed successfully');
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
    console.log('Connection closed');
  }
}

createTable();
