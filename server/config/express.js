/**
 * Express Application Configuration
 * Configures middleware, CORS, body parsers, and static files
 */

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const path = require('path');

const logger = require('../utils/logger');
const requestLogger = require('../middleware/requestLogger');
const { errorHandler, notFoundHandler } = require('../middleware/errorHandler');
const { CORS_CONFIG, UPLOAD_CONFIG } = require('./environment');
const { applySecurityMiddleware, securityAuditMiddleware, rateLimitSecurityHeaders } = require('../middleware/security');
const { metricsMiddleware } = require('../middleware/monitoring');
const { errorTrackingMiddleware } = require('../services/errorTracking');
const { correlationMiddleware, requestSummaryMiddleware } = require('../middleware/correlation');

/**
 * Configure Express application with all middleware
 * @param {express.Application} app - Express app instance
 */
function configureExpress(app) {
  logger.info('Configuring Express middleware...');
  
  // Security middleware (Helmet.js) - must be first
  applySecurityMiddleware(app);
  
  // Correlation ID tracking (very early for request tracing)
  app.use(correlationMiddleware);
  
  // Metrics collection (very early to track all requests)
  app.use(metricsMiddleware);
  
  // Request logging (before other middleware)
  app.use(requestLogger);
  
  // Request summary logging (logs completed requests)
  app.use(requestSummaryMiddleware(logger));
  
  // Security audit logging
  app.use(securityAuditMiddleware);
  app.use(rateLimitSecurityHeaders);
  
  // Cookie parsing middleware (for refresh tokens)
  app.use(cookieParser());
  
  // Body parsing middleware - increased limit for large HTML budget imports
  const bodyLimit = UPLOAD_CONFIG.maxFileSize;
  app.use(express.json({ limit: bodyLimit }));
  app.use(bodyParser.json({ limit: bodyLimit }));
  app.use(express.urlencoded({ limit: bodyLimit, extended: true }));
  
  // CORS configuration (must support credentials for cookies)
  app.use(cors({
    ...CORS_CONFIG,
    credentials: true // Enable cookies in CORS
  }));
  
  // Static file serving
  const uploadsDir = path.join(__dirname, '..', UPLOAD_CONFIG.uploadDir);
  app.use('/uploads', express.static(uploadsDir));
  
  logger.info('✅ Express middleware configured', {
    bodyLimit,
    corsOrigin: CORS_CONFIG.origin,
    uploadsDir
  });
}

/**
 * Mount all application routes
 * @param {express.Application} app - Express app instance
 */
function mountRoutes(app) {
  logger.info('Mounting API routes...');
  
  // Import route modules
  const authRoutes = require('../routes/auth');
  const settingsRoutes = require('../routes/settings');
  const aebfRoutes = require('../routes/aebf');
  const budgetDraftRoutes = require('../routes/budget-draft');
  const divisionMergeRulesRoutes = require('../routes/divisionMergeRules');
  const globalConfigRoutes = require('../routes/globalConfig');
  const fpRoutes = require('../routes/fp');
  const hcRoutes = require('../routes/hc');
  const universalRoutes = require('../routes/universal');
  const excelRoutes = require('../routes/excel');
  const salesRepsRoutes = require('../routes/salesReps');
  const databaseRoutes = require('../routes/database');
  const adminRoutes = require('../routes/admin');
  const masterDataRoutes = require('../routes/masterData');
  const productGroupsRoutes = require('../routes/productGroups');
  const confirmedMergesRoutes = require('../routes/confirmedMerges');
  const dashboardRoutes = require('../routes/dashboards');
  const salesDataRoutes = require('../routes/salesData');
  const fpPerformanceRoutes = require('../routes/fpPerformance');
  const analyticsRoutes = require('../routes/analytics');
  const monitoringRoutes = require('../routes/monitoring');
  
  // Mount monitoring routes (public - no auth required)
  app.use('/api', monitoringRoutes);
  
  // Mount existing routes
  app.use('/api/auth', authRoutes);
  app.use('/api/settings', settingsRoutes);
  app.use('/api/aebf', aebfRoutes);
  app.use('/api/budget-draft', budgetDraftRoutes);
  app.use('/api/division-merge-rules', divisionMergeRulesRoutes);
  
  // Mount new modular routes (Phase 2)
  app.use('/api/standard-config', globalConfigRoutes);
  app.use('/api/fp', fpRoutes);
  app.use('/api/hc', hcRoutes);
  app.use('/api', universalRoutes);
  app.use('/api', excelRoutes);
  app.use('/api/sales-reps', salesRepsRoutes);
  app.use('/api', databaseRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api/master-data', masterDataRoutes);
  app.use('/api/product-groups', productGroupsRoutes);
  app.use('/api/confirmed-merges', confirmedMergesRoutes);
  app.use('/api/customer-dashboard', dashboardRoutes);
  app.use('/api', salesDataRoutes);
  app.use('/api/fp', fpPerformanceRoutes);
  app.use('/api', analyticsRoutes);
  
  logger.info('✅ API routes mounted', {
    routes: [
      '/api/auth', '/api/settings', '/api/aebf', '/api/budget-draft', 
      '/api/division-merge-rules', '/api/standard-config', '/api/fp', 
      '/api/hc', '/api/universal', '/api/excel', '/api/sales-reps',
      '/api/database', '/api/admin', '/api/master-data', '/api/product-groups',
      '/api/confirmed-merges', '/api/customer-dashboard', '/api/sales-data'
    ]
  });
}

/**
 * Mount error handling middleware (must be last)
 * @param {express.Application} app - Express app instance
 */
function mountErrorHandlers(app) {
  // 404 handler (for undefined routes)
  app.use(notFoundHandler);
  
  // Global error handler (must be last)
  app.use(errorHandler);
  
  logger.debug('✅ Error handlers mounted');
}

/**
 * Initialize complete Express application
 * @returns {express.Application} Configured Express app
 */
function initializeApp() {
  const app = express();
  
  // Configure middleware
  configureExpress(app);
  
  // Mount routes
  mountRoutes(app);
  
  // Setup Swagger API documentation (before error handlers)
  try {
    const { setupSwagger } = require('./swagger');
    setupSwagger(app);
    logger.info('📚 API documentation available at /api-docs');
  } catch (swaggerError) {
    logger.warn('Swagger documentation not available', { error: swaggerError.message });
  }
  
  // Mount error handlers (must be last)
  mountErrorHandlers(app);
  
  return app;
}

module.exports = {
  configureExpress,
  mountRoutes,
  mountErrorHandlers,
  initializeApp
};
