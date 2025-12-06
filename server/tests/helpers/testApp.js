/**
 * Test Application Factory
 * Creates Express app instances for integration testing
 * Handles ESM module mocking and test isolation
 */

const express = require('express');
const cookieParser = require('cookie-parser');

/**
 * Create a minimal test app for route testing
 * Avoids loading modules that cause ESM issues in Jest
 * @param {Object} options - Configuration options
 * @returns {express.Application} Test-ready Express app
 */
function createTestApp(options = {}) {
  const app = express();
  
  // Basic middleware
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());
  
  // Mock correlation middleware
  app.use((req, res, next) => {
    req.correlationId = 'test-correlation-id';
    res.setHeader('X-Correlation-ID', req.correlationId);
    res.setHeader('X-Request-ID', 'test-request-id');
    next();
  });
  
  // Mount requested routes
  if (options.routes) {
    for (const [path, router] of Object.entries(options.routes)) {
      app.use(path, router);
    }
  }
  
  // Error handler
  app.use((err, req, res, next) => {
    const statusCode = err.statusCode || err.status || 500;
    res.status(statusCode).json({
      success: false,
      error: err.message || 'Internal Server Error',
      code: err.code || 'INTERNAL_ERROR'
    });
  });
  
  // 404 handler
  app.use((req, res) => {
    res.status(404).json({
      success: false,
      error: 'Not Found',
      path: req.path
    });
  });
  
  return app;
}

/**
 * Create a test app with auth routes
 * @returns {express.Application}
 */
function createAuthTestApp() {
  const authRoutes = require('../../routes/auth');
  return createTestApp({
    routes: { '/api/auth': authRoutes }
  });
}

/**
 * Create a test app with monitoring routes
 * @returns {express.Application}
 */
function createMonitoringTestApp() {
  const monitoringRoutes = require('../../routes/monitoring');
  return createTestApp({
    routes: { '/api': monitoringRoutes }
  });
}

/**
 * Create a mock user for testing
 * @param {Object} overrides - Properties to override
 * @returns {Object} Mock user object
 */
function createMockUser(overrides = {}) {
  return {
    id: 1,
    email: 'test@example.com',
    name: 'Test User',
    role: 'admin',
    divisions: ['FP', 'HC'],
    salesReps: [],
    ...overrides
  };
}

/**
 * Create mock JWT tokens for testing
 * @returns {Object} Object with accessToken and refreshToken
 */
function createMockTokens() {
  return {
    accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwiZW1haWwiOiJ0ZXN0QGV4YW1wbGUuY29tIiwiaWF0IjoxNjE2MTYyMjIyfQ.mock',
    refreshToken: 'mock-refresh-token-12345',
    expiresIn: '15m'
  };
}

/**
 * Create a mock database pool for testing
 * @param {Object} queryResults - Map of query patterns to results
 * @returns {Object} Mock pool object
 */
function createMockPool(queryResults = {}) {
  return {
    query: jest.fn().mockImplementation((sql, params) => {
      // Check if any pattern matches
      for (const [pattern, result] of Object.entries(queryResults)) {
        if (sql.includes(pattern)) {
          return Promise.resolve(result);
        }
      }
      // Default response
      return Promise.resolve({ rows: [], rowCount: 0 });
    }),
    connect: jest.fn().mockResolvedValue({
      query: jest.fn().mockResolvedValue({ rows: [] }),
      release: jest.fn()
    }),
    end: jest.fn().mockResolvedValue(undefined)
  };
}

/**
 * Create mock request object
 * @param {Object} overrides - Properties to override
 * @returns {Object} Mock request
 */
function createMockRequest(overrides = {}) {
  return {
    body: {},
    params: {},
    query: {},
    headers: {},
    cookies: {},
    user: null,
    ip: '127.0.0.1',
    method: 'GET',
    path: '/',
    correlationId: 'test-correlation-id',
    ...overrides
  };
}

/**
 * Create mock response object
 * @returns {Object} Mock response with chainable methods
 */
function createMockResponse() {
  const res = {
    statusCode: 200,
    headers: {},
    body: null
  };
  
  res.status = jest.fn().mockImplementation((code) => {
    res.statusCode = code;
    return res;
  });
  
  res.json = jest.fn().mockImplementation((data) => {
    res.body = data;
    return res;
  });
  
  res.send = jest.fn().mockImplementation((data) => {
    res.body = data;
    return res;
  });
  
  res.setHeader = jest.fn().mockImplementation((name, value) => {
    res.headers[name] = value;
    return res;
  });
  
  res.cookie = jest.fn().mockReturnValue(res);
  res.clearCookie = jest.fn().mockReturnValue(res);
  res.redirect = jest.fn().mockReturnValue(res);
  res.end = jest.fn().mockReturnValue(res);
  
  return res;
}

module.exports = {
  createTestApp,
  createAuthTestApp,
  createMonitoringTestApp,
  createMockUser,
  createMockTokens,
  createMockPool,
  createMockRequest,
  createMockResponse
};
