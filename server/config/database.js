/**
 * Database Configuration
 * Main database connection pool and utilities
 */

const { Pool } = require('pg');
const logger = require('../utils/logger');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

// Main database configuration (FP database)
const databaseConfig = {
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: 'fp_database',
  password: process.env.DB_PASSWORD || '654883',
  port: process.env.DB_PORT || 5432,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
};

// Create main connection pool
const pool = new Pool(databaseConfig);

// Handle pool errors
pool.on('error', (err) => {
  logger.error('Unexpected error on idle database client', { error: err.message });
});

/**
 * Test database connection
 * @returns {Promise<boolean>} True if connection successful
 */
const testConnection = async () => {
  try {
    const client = await pool.connect();
    const result = await client.query('SELECT NOW()');
    client.release();
    logger.database('Database connection test successful', { 
      timestamp: result.rows[0].now 
    });
    return true;
  } catch (error) {
    logger.error('Database connection test failed', { error: error.message });
    return false;
  }
};

/**
 * Execute a query with automatic client management
 * @param {string} text - SQL query
 * @param {Array} params - Query parameters
 * @returns {Promise} Query result
 */
const query = async (text, params) => {
  const start = Date.now();
  try {
    const result = await pool.query(text, params);
    const duration = Date.now() - start;
    logger.database('Query executed', {
      query: text.substring(0, 100),
      duration: `${duration}ms`,
      rows: result.rowCount
    });
    return result;
  } catch (error) {
    logger.error('Query execution failed', {
      query: text.substring(0, 100),
      error: error.message
    });
    throw error;
  }
};

/**
 * Get a client from the pool
 * @returns {Promise} Database client
 */
const getClient = async () => {
  const client = await pool.connect();
  const query = client.query.bind(client);
  const release = client.release.bind(client);
  
  // Set timeout for client
  const timeout = setTimeout(() => {
    logger.warn('Client has been checked out for more than 5 seconds');
  }, 5000);
  
  // Monkey patch the release method to clear timeout
  client.release = () => {
    clearTimeout(timeout);
    client.query = query;
    client.release = release;
    return release();
  };
  
  return client;
};

module.exports = {
  pool,
  query,
  getClient,
  testConnection
};
