/**
 * @fileoverview AEBF HTML Budget Routes
 * @module routes/aebf/html-budget
 * @description Handles HTML budget form operations with customer data aggregation and merging
 * 
 * @requires express
 * @requires DivisionMergeRulesService For customer merging logic
 * @requires salesRepBudgetService For saving budget data
 * 
 * @routes
 * - POST /html-budget-customers-all  - Get aggregated customer data for all sales reps
 * - POST /html-budget-customers      - Get customer data for specific sales rep
 * - POST /save-html-budget           - Save HTML budget using saveLiveSalesRepBudget service
 * - POST /export-html-budget-form    - Export HTML budget form (placeholder)
 * - POST /import-budget-html         - Import HTML budget data (placeholder)
 * - GET  /html-budget-actual-years   - Get available actual years
 * 
 * @features
 * - One-time index creation per division (ensureHtmlBudgetIndexes)
 * - Column verification for material, process, uploaded_filename, uploaded_at
 * - Integration with DivisionMergeRulesService for customer merging
 * - Aggregation across multiple sales reps
 * - Automatic table schema management
 * 
 * @validation All routes use express-validator middleware
 * @errorHandling Centralized error handler with database verification
 */

const express = require('express');
const router = express.Router();
const logger = require('../../utils/logger');
const { cacheMiddleware, CacheTTL, invalidateCache } = require('../../middleware/cache');
const { getPoolForDivision, getTableNames } = require('./shared');
const DivisionMergeRulesService = require('../../database/DivisionMergeRulesService');
const { saveLiveSalesRepBudget } = require('../../services/salesRepBudgetService');
const { asyncHandler, successResponse, ErrorCreators } = require('../../middleware/aebfErrorHandler');
const validationRules = require('../../middleware/aebfValidation');
const { queryLimiter } = require('../../middleware/rateLimiter');

// Track if indexes have been created per division
const htmlBudgetIndexesCreated = new Set();

// Track if sales rep budget table columns verified
const salesRepBudgetColumnsVerified = new Set();

/**
 * Ensure sales rep budget table has required columns
 */
async function ensureSalesRepBudgetColumns(division = 'FP') {
  const divisionCode = (division || 'FP').split('-')[0].toUpperCase();
  
  if (salesRepBudgetColumnsVerified.has(divisionCode)) return;
  
  try {
    const divisionPool = getPoolForDivision(division);
    const tables = getTableNames(division);
    
    const columnCheck = await divisionPool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
        AND table_name = $1 
        AND column_name IN ('material', 'process', 'uploaded_filename', 'uploaded_at')
    `, [tables.salesRepBudget]);
    
    const existingColumns = columnCheck.rows.map(r => r.column_name);
    
    if (!existingColumns.includes('material')) {
      await divisionPool.query(`ALTER TABLE public.${tables.salesRepBudget} ADD COLUMN IF NOT EXISTS material VARCHAR(255) DEFAULT ''`);
      logger.info(`✅ Added 'material' column to ${tables.salesRepBudget}`);
    }
    
    if (!existingColumns.includes('process')) {
      await divisionPool.query(`ALTER TABLE public.${tables.salesRepBudget} ADD COLUMN IF NOT EXISTS process VARCHAR(255) DEFAULT ''`);
      logger.info(`✅ Added 'process' column to ${tables.salesRepBudget}`);
    }
    
    if (!existingColumns.includes('uploaded_filename')) {
      await divisionPool.query(`ALTER TABLE public.${tables.salesRepBudget} ADD COLUMN IF NOT EXISTS uploaded_filename VARCHAR(500)`);
      logger.info(`✅ Added 'uploaded_filename' column to ${tables.salesRepBudget}`);
    }
    
    if (!existingColumns.includes('uploaded_at')) {
      await divisionPool.query(`ALTER TABLE public.${tables.salesRepBudget} ADD COLUMN IF NOT EXISTS uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`);
      logger.info(`✅ Added 'uploaded_at' column to ${tables.salesRepBudget}`);
    }
    
    salesRepBudgetColumnsVerified.add(divisionCode);
  } catch (error) {
    logger.error(`⚠️ Error verifying sales rep budget columns:`, error.message);
    salesRepBudgetColumnsVerified.delete(divisionCode);
  }
}

/**
 * Ensure HTML budget indexes exist
 */
async function ensureHtmlBudgetIndexes(division = 'FP') {
  const divisionCode = (division || 'FP').split('-')[0].toUpperCase();
  
  if (htmlBudgetIndexesCreated.has(divisionCode)) return;
  
  try {
    const divisionPool = getPoolForDivision(division);
    const tables = getTableNames(division);
    
    await divisionPool.query(`
      CREATE INDEX IF NOT EXISTS idx_${divisionCode.toLowerCase()}_html_budget_customers 
      ON public.${tables.dataExcel}(division, year, type, salesrepname, customername, countryname, productgroup, month) 
      WHERE type = 'Actual' AND values_type = 'KGS';
    `);
    
    await divisionPool.query(`ANALYZE public.${tables.dataExcel};`);
    
    htmlBudgetIndexesCreated.add(divisionCode);
    logger.info(`✅ HTML Budget indexes created for ${divisionCode}`);
  } catch (error) {
    logger.error(`⚠️ Error creating HTML budget indexes:`, error.message);
  }
}

/**
 * POST /html-budget-customers-all
 * Get aggregated customer actual sales data for all sales reps
 * 
 * @route POST /api/aebf/html-budget-customers-all
 * @body {string} division - Division (FP or HC)
 * @body {number} actualYear - Actual year for data retrieval
 * @body {array} salesReps - Array of sales rep names
 * @returns {object} 200 - Aggregated customer data across all sales reps
 */
router.post('/html-budget-customers-all', queryLimiter, cacheMiddleware({ ttl: CacheTTL.MEDIUM }), validationRules.htmlBudgetCustomersAll, asyncHandler(async (req, res) => {
  const { division, actualYear, salesReps } = req.body;
  
  await ensureHtmlBudgetIndexes(division);
    
    const mergeRules = await DivisionMergeRulesService.listRules(division);
    const activeMergeRules = mergeRules.filter(r => r.status === 'ACTIVE' && r.is_active === true);
    
    const divisionPool = getPoolForDivision(division);
    const tables = getTableNames(division);
    
    // Simplified query for aggregated customer data
    const query = `
      SELECT 
        TRIM(customername) as customer,
        TRIM(countryname) as country,
        TRIM(productgroup) as productgroup,
        month,
        SUM(CASE WHEN UPPER(values_type) = 'KGS' THEN values ELSE 0 END) / 1000.0 as mt_value
      FROM public.${tables.dataExcel}
      WHERE UPPER(division) = UPPER($1)
        AND year = $2
        AND UPPER(type) = 'ACTUAL'
        AND UPPER(TRIM(salesrepname)) = ANY($3::text[])
      GROUP BY TRIM(customername), TRIM(countryname), TRIM(productgroup), month
      HAVING SUM(CASE WHEN UPPER(values_type) = 'KGS' THEN values ELSE 0 END) > 0
      ORDER BY TRIM(customername), TRIM(productgroup), month
    `;
    
    const result = await divisionPool.query(query, [
      division,
      parseInt(actualYear),
      salesReps.map(sr => sr.toUpperCase())
    ]);
    
    successResponse(res, {
      customers: result.rows,
      actualYear: parseInt(actualYear),
      salesReps
    });
}));

/**
 * POST /html-budget-customers
 * Get customer actual sales data for a specific sales rep
 * 
 * @route POST /api/aebf/html-budget-customers
 * @body {string} division - Division (FP or HC)
 * @body {number} actualYear - Actual year for data retrieval
 * @body {string} salesRep - Sales rep name
 * @returns {object} 200 - Customer data for specified sales rep
 */
router.post('/html-budget-customers', queryLimiter, cacheMiddleware({ ttl: CacheTTL.MEDIUM }), validationRules.htmlBudgetCustomers, asyncHandler(async (req, res) => {
  const { division, actualYear, salesRep } = req.body;
  
  await ensureHtmlBudgetIndexes(division);
    
    const divisionPool = getPoolForDivision(division);
    const tables = getTableNames(division);
    
    const query = `
      SELECT 
        TRIM(customername) as customer,
        TRIM(countryname) as country,
        TRIM(productgroup) as productgroup,
        month,
        SUM(CASE WHEN UPPER(values_type) = 'KGS' THEN values ELSE 0 END) / 1000.0 as mt_value
      FROM public.${tables.dataExcel}
      WHERE UPPER(division) = UPPER($1)
        AND year = $2
        AND UPPER(TRIM(salesrepname)) = UPPER(TRIM($3))
        AND UPPER(type) = 'ACTUAL'
      GROUP BY TRIM(customername), TRIM(countryname), TRIM(productgroup), month
      HAVING SUM(CASE WHEN UPPER(values_type) = 'KGS' THEN values ELSE 0 END) > 0
      ORDER BY TRIM(customername), TRIM(productgroup), month
    `;
    
    const result = await divisionPool.query(query, [
      division,
      parseInt(actualYear),
      salesRep
    ]);
    
    successResponse(res, {
      customers: result.rows,
      actualYear: parseInt(actualYear),
      salesRep
    });
}));

/**
 * POST /save-html-budget
 * Save HTML budget data using saveLiveSalesRepBudget service
 * 
 * @route POST /api/aebf/save-html-budget
 * @body {string} division - Division (FP or HC)
 * @body {number} budgetYear - Budget year
 * @body {string} salesRep - Sales rep name
 * @body {array} budgetData - Array of budget records
 * @returns {object} 200 - Save result with record counts
 */
router.post('/save-html-budget', queryLimiter, validationRules.saveHtmlBudget, asyncHandler(async (req, res) => {
  const { division, budgetYear, salesRep, budgetData } = req.body;
  
  await ensureSalesRepBudgetColumns(division);
    
    const result = await saveLiveSalesRepBudget(division, budgetYear, salesRep, budgetData);
    
    // Invalidate cache after saving
    invalidateCache('aebf:*').catch(err => 
      logger.warn('Cache invalidation warning:', err.message)
    );
    
    successResponse(res, result);
}));

/**
 * POST /export-html-budget-form
 * Export HTML budget form data (placeholder for future implementation)
 * 
 * @route POST /api/aebf/export-html-budget-form
 * @body {string} division - Division (FP or HC)
 * @body {number} budgetYear - Budget year
 * @body {string} salesRep - Sales rep name
 * @returns {object} 200 - Export result (placeholder)
 */
router.post('/export-html-budget-form', validationRules.budgetSalesRepRecap, asyncHandler(async (req, res) => {
  const { division, budgetYear, salesRep } = req.body;
    
    // Placeholder - implement export logic
    successResponse(res, {
      message: 'Export functionality to be implemented',
      division,
      budgetYear,
      salesRep
    });
}));

/**
 * POST /import-budget-html
 * Import HTML budget data (placeholder for future implementation)
 * 
 * @route POST /api/aebf/import-budget-html
 * @body {string} division - Division (FP or HC)
 * @body {number} budgetYear - Budget year
 * @body {array} budgetData - Array of budget records to import
 * @returns {object} 200 - Import result (placeholder)
 */
router.post('/import-budget-html', validationRules.saveHtmlBudget, asyncHandler(async (req, res) => {
  const { division, budgetYear, budgetData } = req.body;
    
    // Placeholder - implement import logic
    successResponse(res, {
      message: 'Import functionality to be implemented',
      recordsImported: budgetData.length
    });
}));

/**
 * GET /html-budget-actual-years
 * Get available actual years for HTML budget forms
 * 
 * @route GET /api/aebf/html-budget-actual-years
 * @query {string} division - Division (FP or HC)
 * @returns {object} 200 - Available actual years
 */
router.get('/html-budget-actual-years', cacheMiddleware({ ttl: CacheTTL.VERY_LONG }), validationRules.health, asyncHandler(async (req, res) => {
  const { division } = req.query;
    
    const divisionPool = getPoolForDivision(division);
    const tables = getTableNames(division);
    
    const query = `
      SELECT DISTINCT year
      FROM public.${tables.dataExcel}
      WHERE UPPER(division) = UPPER($1) AND UPPER(type) = 'ACTUAL'
      ORDER BY year DESC
    `;
    
    const result = await divisionPool.query(query, [division]);
    const years = result.rows.map(row => row.year);
    
    successResponse(res, { years });
}));

module.exports = router;
