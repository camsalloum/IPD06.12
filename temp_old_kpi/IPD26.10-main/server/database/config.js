const { Pool } = require('pg');
require('dotenv').config();

// Main database configuration (for your existing data)
const dbConfig = {
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'fp_database',
  password: process.env.DB_PASSWORD || '654883',
  port: process.env.DB_PORT || 5432,
};

// Authentication database configuration (separate)
const authDbConfig = {
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.AUTH_DB_NAME || 'ip_auth_database',
  password: process.env.DB_PASSWORD || '654883',
  port: process.env.DB_PORT || 5432,
};

// Create connection pools
const pool = new Pool(dbConfig);
const authPool = new Pool(authDbConfig);

// Test database connections
const testConnection = async () => {
  try {
    const client = await pool.connect();
    console.log('✅ Main database connected:', dbConfig.database);
    client.release();
    
    const authClient = await authPool.connect();
    console.log('✅ Auth database connected:', authDbConfig.database);
    authClient.release();
    
    return true;
  } catch (err) {
    console.error('❌ Database connection error:', err.message);
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
      password: process.env.DB_PASSWORD || '654883',
      port: process.env.DB_PORT || 5432,
    });
    console.log(`✅ Created pool for division database: ${dbName}`);
  }
  
  return divisionPools[dbName];
};

// Close a specific division pool
const closeDivisionPool = async (divisionCode) => {
  const dbName = `${divisionCode.toLowerCase()}_database`;
  if (divisionPools[dbName]) {
    await divisionPools[dbName].end();
    delete divisionPools[dbName];
    console.log(`✅ Closed pool for division database: ${dbName}`);
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