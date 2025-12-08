/**
 * IPDashboard Server - Main Entry Point
 * Modular Express Server with Winston Logging
 * 
 * All routes and middleware are organized in separate modules:
 * - config/express.js: Express configuration and route mounting
 * - config/environment.js: Environment validation
 * - routes/*: All API endpoints organized by functionality
 */

const { initializeApp } = require('./config/express');
const { validateEnvironment } = require('./config/environment');
const logger = require('./utils/logger');
const GlobalConfigService = require('./database/GlobalConfigService');
const { testConnection } = require('./config/database');
const { syncAllTablesToAllDivisions } = require('./utils/divisionDatabaseManager');
const { initRedis } = require('./middleware/cache');
const { migrateUserSessions } = require('./migrations/add-last-activity-to-sessions');

// Environment configuration
const PORT = process.env.PORT || 3001;
const NODE_ENV = process.env.NODE_ENV || 'development';

/**
 * Start the server
 */
const startServer = async () => {
  try {
    logger.info('🚀 Starting IPDashboard Backend Server...');
    logger.info('Environment:', { NODE_ENV, PORT });
    
    // Validate environment variables
    logger.info('Validating environment configuration...');
    validateEnvironment();
    logger.info('✅ Environment configuration valid');
    
    // Initialize Express app with all middleware and routes
    const app = initializeApp();
    
    // Initialize Redis cache (optional - will continue if unavailable)
    logger.info('Initializing cache system...');
    try {
      const redisConnected = await initRedis();
      if (redisConnected) {
        logger.info('✅ Redis cache connected');
      } else {
        logger.warn('⚠️  Redis cache not available - caching disabled');
      }
    } catch (cacheError) {
      logger.warn('Cache initialization warning', { error: cacheError.message });
    }
    
    // Initialize global configuration
    logger.info('Loading global configuration...');
    try {
      const globalConfigService = new GlobalConfigService();
      const standardConfig = await globalConfigService.getAllConfigs();
      logger.info('✅ Global configuration loaded', { 
        configKeys: Object.keys(standardConfig).length 
      });
    } catch (configError) {
      logger.warn('Could not load global configuration', { error: configError.message });
    }
    
    // Test database connection
    logger.database('Testing database connection...');
    const dbConnected = await testConnection();
    
    if (dbConnected) {
      logger.database('✅ Database connection successful');
      
      // Run auth database migrations
      logger.info('Running auth database migrations...');
      try {
        await migrateUserSessions();
        logger.info('✅ Auth database migrations complete');
      } catch (migrationError) {
        logger.warn('Auth migration warning', { error: migrationError.message });
      }
      
      // Sync tables across all divisions (ensures HC has same tables as FP)
      logger.database('Synchronizing division tables...');
      try {
        const syncResult = await syncAllTablesToAllDivisions();
        if (syncResult.synced > 0) {
          logger.database(`✅ Division sync: ${syncResult.synced} tables created`);
        } else {
          logger.database('✅ All divisions are in sync');
        }
      } catch (syncError) {
        logger.warn('Division sync warning', { error: syncError.message });
      }
    } else {
      logger.error('❌ Database connection failed - server will start but database features may not work');
      logger.warn('Please check your .env file and ensure PostgreSQL is running');
    }
    
    // Start listening
    app.listen(PORT, () => {
      logger.info(`\n${'='.repeat(60)}`);
      logger.info(`✅ Backend server running on http://localhost:${PORT}`);
      logger.info(`${'='.repeat(60)}\n`);
      logger.info('📊 Available API endpoints:');
      logger.info('   - Authentication: /api/auth/*');
      logger.info('   - Settings: /api/settings/*');
      logger.info('   - AEBF (Advanced Excel Budget & Forecast): /api/aebf/*');
      logger.info('   - Budget Draft: /api/budget-draft/*');
      logger.info('   - Division Merge Rules: /api/division-merge-rules/*');
      logger.info('   - Global Config: /api/standard-config/*');
      logger.info('   - FP Division: /api/fp/*');
      logger.info('   - HC Division: /api/hc/*');
      logger.info('   - Universal (Division-agnostic): /api/*');
      logger.info('   - Excel Downloads: /api/financials/*.xlsx, /api/sales.xlsx');
      logger.info('   - Sales Representatives: /api/sales-reps/*');
      logger.info('   - Database Operations: /api/countries-db, /api/customers-db, etc.');
      logger.info('   - Admin: /api/admin/*');
      logger.info('   - Master Data: /api/master-data/*');
      logger.info('   - Product Groups: /api/product-groups/*');
      logger.info('   - Confirmed Merges: /api/confirmed-merges/*');
      logger.info('   - Dashboards: /api/customer-dashboard/*, /api/sales-data/*');
      logger.info('   - Analytics: /api/geographic-distribution, /api/customer-insights-db');
      logger.info('\n🔧 Development Mode Features:');
      logger.info('   - Winston logging with file rotation');
      logger.info('   - Detailed error messages and stack traces');
      logger.info('   - CORS enabled for frontend development');
      logger.info(`\n${'='.repeat(60)}\n`);
    });
    
    // Graceful shutdown handling
    process.on('SIGTERM', () => {
      logger.info('SIGTERM signal received: closing HTTP server');
      app.close(() => {
        logger.info('HTTP server closed');
        process.exit(0);
      });
    });
    
    process.on('SIGINT', () => {
      logger.info('\nSIGINT signal received: closing HTTP server');
      app.close(() => {
        logger.info('HTTP server closed');
        process.exit(0);
      });
    });
    
  } catch (error) {
    logger.error('Failed to start server', { error: error.message, stack: error.stack });
    process.exit(1);
  }
};

// Start the server
startServer();

// Export for testing
module.exports = { startServer };
