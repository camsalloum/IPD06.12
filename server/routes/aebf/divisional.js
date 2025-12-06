/**
 * @fileoverview AEBF Divisional Budget Routes
 * @module routes/aebf/divisional
 * @description Handles divisional-level budget operations via service layer integration
 * 
 * @requires express
 * @requires divisionalBudgetService For business logic delegation
 * 
 * @routes
 * - POST   /divisional-html-budget-data           - Get divisional budget via getDivisionalBudgetInfo
 * - POST   /export-divisional-html-budget-form    - Export divisional form (placeholder)
 * - POST   /import-divisional-budget-html         - Import divisional HTML (placeholder)
 * - POST   /save-divisional-budget                - Save via saveDivisionalBudget service
 * - DELETE /delete-divisional-budget/:division/:budgetYear - Delete divisional budget
 * 
 * @pattern Service Layer Integration
 * - All business logic delegated to divisionalBudgetService
 * - Thin controller layer for request/response handling
 * - Clean separation of concerns
 * 
 * @validation All routes use express-validator middleware
 * @errorHandling Centralized error handler with service error propagation
 */

const express = require('express');
const router = express.Router();
const logger = require('../../utils/logger');
const { cacheMiddleware, CacheTTL, invalidateCache } = require('../../middleware/cache');
const { getPoolForDivision, getTableNames } = require('./shared');
const { saveDivisionalBudget, getDivisionalBudgetInfo } = require('../../services/divisionalBudgetService');
const { asyncHandler, successResponse } = require('../../middleware/aebfErrorHandler');
const validationRules = require('../../middleware/aebfValidation');
const { queryLimiter } = require('../../middleware/rateLimiter');

/**
 * POST /divisional-html-budget-data
 * Get divisional budget data via getDivisionalBudgetInfo service
 * 
 * @route POST /api/aebf/divisional-html-budget-data
 * @body {string} division - Division (FP or HC)
 * @body {number} budgetYear - Budget year
 * @returns {object} 200 - Divisional budget data
 */
router.post('/divisional-html-budget-data', queryLimiter, cacheMiddleware({ ttl: CacheTTL.MEDIUM }), validationRules.divisionalBudgetData, asyncHandler(async (req, res) => {
  const { division, budgetYear } = req.body;
  
  const budgetInfo = await getDivisionalBudgetInfo(division, budgetYear);
  
  successResponse(res, { budgetData: budgetInfo });
}));

/**
 * POST /export-divisional-html-budget-form
 * Export divisional budget form (placeholder for future implementation)
 * 
 * @route POST /api/aebf/export-divisional-html-budget-form
 * @body {string} division - Division (FP or HC)
 * @body {number} budgetYear - Budget year
 * @returns {object} 200 - Export result (placeholder)
 */
router.post('/export-divisional-html-budget-form', validationRules.divisionalBudgetData, asyncHandler(async (req, res) => {
  const { division, budgetYear } = req.body;
  
  // Placeholder - implement export logic
  successResponse(res, {
    message: 'Export divisional budget form to be implemented',
    division,
    budgetYear
  });
}));

/**
 * POST /import-divisional-budget-html
 * Import divisional budget HTML (placeholder for future implementation)
 * 
 * @route POST /api/aebf/import-divisional-budget-html
 * @body {string} division - Division (FP or HC)
 * @body {number} budgetYear - Budget year
 * @body {object} budgetData - Budget data to import
 * @returns {object} 200 - Import result (placeholder)
 */
router.post('/import-divisional-budget-html', validationRules.saveDivisionalBudget, asyncHandler(async (req, res) => {
  const { division, budgetYear, budgetData } = req.body;
  
  // Placeholder - implement import logic
  successResponse(res, {
    message: 'Import divisional budget to be implemented'
  });
}));

/**
 * POST /save-divisional-budget
 * Save divisional budget via saveDivisionalBudget service
 * 
 * @route POST /api/aebf/save-divisional-budget
 * @body {string} division - Division (FP or HC)
 * @body {number} budgetYear - Budget year
 * @body {array} budgetData - Array of budget records
 * @returns {object} 200 - Save result with record counts
 */
router.post('/save-divisional-budget', validationRules.saveDivisionalBudget, asyncHandler(async (req, res) => {
  const { division, budgetYear, budgetData } = req.body;
  
  const result = await saveDivisionalBudget(division, budgetYear, budgetData);
  
  // Invalidate cache after saving
  invalidateCache('aebf:*').catch(err => 
    logger.warn('Cache invalidation warning:', err.message)
  );
  
  successResponse(res, result);
}));

/**
 * DELETE /delete-divisional-budget/:division/:budgetYear
 * Delete divisional budget for specified division and year
 * 
 * @route DELETE /api/aebf/delete-divisional-budget/:division/:budgetYear
 * @param {string} division - Division (FP or HC)
 * @param {number} budgetYear - Budget year
 * @returns {object} 200 - Deletion result with record count
 */
router.delete('/delete-divisional-budget/:division/:budgetYear', validationRules.deleteDivisionalBudget, asyncHandler(async (req, res) => {
  const { division, budgetYear } = req.params;
  
  const divisionPool = getPoolForDivision(division);
  const tables = getTableNames(division);
  
  const deleteQuery = `
    DELETE FROM ${tables.divisionalBudget}
    WHERE UPPER(division) = UPPER($1) AND budget_year = $2
  `;
  
  const result = await divisionPool.query(deleteQuery, [division, parseInt(budgetYear)]);
  
  // Invalidate cache after deletion
  invalidateCache('aebf:*').catch(err => 
    logger.warn('Cache invalidation warning:', err.message)
  );
  
  successResponse(res, {
    message: `Deleted ${result.rowCount} divisional budget records`,
    division,
    budgetYear: parseInt(budgetYear),
    recordsDeleted: result.rowCount
  });
}));

module.exports = router;
