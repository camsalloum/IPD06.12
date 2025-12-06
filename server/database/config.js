const { Pool } = require('pg');
const logger = require('../utils/logger');
require('dotenv').config();

// Environment detection
const isProduction = process.env.NODE_ENV === 'production';
const isDevelopment = process.env.NODE_ENV === 'development' || !process.env.NODE_ENV;

// Main database configuration (for your existing data)
const dbConfig = {
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'fp_database',
  password: process.env.DB_PASSWORD || (isProduction ? null : '654883'),
  port: parseInt(process.env.DB_PORT) || 5432,
  max: parseInt(process.env.DB_POOL_MAX) || 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
};

// Authentication database configuration (separate)
const authDbConfig = {
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.AUTH_DB_NAME || 'ip_auth_database',
  password: process.env.DB_PASSWORD || (isProduction ? null : '654883'),
  port: parseInt(process.env.DB_PORT) || 5432,
  max: parseInt(process.env.DB_POOL_MAX) || 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
};

// Production validation
if (isProduction) {
  if (!process.env.DB_PASSWORD) {
    throw new Error('🔴 CRITICAL: DB_PASSWORD must be set in production environment!');
  }
  if (!process.env.DB_NAME) {
    logger.warn('⚠️  WARNING: Using default database name in production');
  }
}

// Development warning
if (isDevelopment && !process.env.DB_PASSWORD) {
  logger.warn('⚠️  DEVELOPMENT MODE: Using default credentials. Set DB_PASSWORD for production.');
}

// Create connection pools
const pool = new Pool(dbConfig);
const authPool = new Pool(authDbConfig);

// Test database connections
const testConnection = async () => {
  try {
    const client = await pool.connect();
    logger.info('✅ Main database connected:', dbConfig.database);
    client.release();
    
    const authClient = await authPool.connect();
    logger.info('✅ Auth database connected:', authDbConfig.database);
    authClient.release();
    
    return true;
  } catch (err) {
    logger.error('❌ Database connection error:', err.message);
    if (isProduction) {
      logger.error('🔴 Production database connection failed. Check environment variables.');
    }
    return false;
  }
};

// Division-specific pool cache
const divisionPools = {};

// Get or create pool for specific division database
const getDivisionPool = (divisionCode) => {
  const dbName = `${divisionCode.toLowerCase()}_database`;
  
  if (!divisionPools[dbName]) {
    divisionPools[dbName] = new Pool({
      user: process.env.DB_USER || 'postgres',
      host: process.env.DB_HOST || 'localhost',
      database: dbName,
      password: process.env.DB_PASSWORD || (isProduction ? null : '654883'),
      port: parseInt(process.env.DB_PORT) || 5432,
      max: parseInt(process.env.DB_POOL_MAX) || 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });
    logger.info(`✅ Created pool for division database: ${dbName}`);
  }
  
  return divisionPools[dbName];
};

// Close a specific division pool
const closeDivisionPool = async (divisionCode) => {
  const dbName = `${divisionCode.toLowerCase()}_database`;
  if (divisionPools[dbName]) {
    await divisionPools[dbName].end();
    delete divisionPools[dbName];
    logger.info(`✅ Closed pool for division database: ${dbName}`);
  }
};

module.exports = {
  pool,        // Main database (FP division - backward compatibility)
  authPool,    // Auth database (user accounts)
  getDivisionPool,  // Get division-specific pool
  closeDivisionPool, // Close division pool
  testConnection,
  dbConfig
};