/**
 * @fileoverview AEBF Reports Routes
 * @module routes/aebf/reports
 * @description Generates analytical reports for budget and actual data with pricing integration
 * 
 * @requires express
 * @requires shared For database pool and table management
 * 
 * @routes
 * - GET  /budget-sales-reps      - Get distinct sales reps with budget data
 * - POST /budget-product-groups  - Product group breakdown with pricing (supports __ALL__)
 * - POST /actual-product-groups  - Actual product group breakdown with month range
 * 
 * @features
 * - Pricing data join from pricingRounding and materialPercentages tables
 * - Previous year pricing lookup (budgetYear - 1)
 * - __ALL__ aggregation across all sales reps
 * - Product group filtering (excludes SERVICES CHARGES)
 * - Month range support for actual data
 * - Sales rep performance analytics
 * 
 * @validation All routes use express-validator middleware
 * @errorHandling Centralized error handler with query optimization
 */

const express = require('express');
const router = express.Router();
const logger = require('../../utils/logger');
const { cacheMiddleware, CacheTTL } = require('../../middleware/cache');
const { getPoolForDivision, getTableNames } = require('./shared');
const { asyncHandler, successResponse } = require('../../middleware/aebfErrorHandler');
const validationRules = require('../../middleware/aebfValidation');
const { queryLimiter } = require('../../middleware/rateLimiter');

/**
 * GET /budget-sales-reps
 * Get all distinct sales reps with budget data for a year
 * 
 * @route GET /api/aebf/budget-sales-reps
 * @query {string} division - Division (FP or HC)
 * @query {number} budgetYear - Budget year
 * @returns {object} 200 - Array of sales rep names
 */
router.get('/budget-sales-reps', queryLimiter, cacheMiddleware({ ttl: CacheTTL.LONG }), validationRules.getBudgetSalesReps, asyncHandler(async (req, res) => {
  const { division, budgetYear } = req.query;
    
    const divisionPool = getPoolForDivision(division);
    const tables = getTableNames(division);
    
    const query = `
      SELECT DISTINCT TRIM(salesrepname) as salesrep
      FROM ${tables.salesRepBudget}
      WHERE UPPER(division) = UPPER($1)
        AND budget_year = $2
        AND UPPER(type) = 'BUDGET'
        AND salesrepname IS NOT NULL
        AND TRIM(salesrepname) != ''
      ORDER BY TRIM(salesrepname)
    `;
    
    const result = await divisionPool.query(query, [division, parseInt(budgetYear)]);
    const salesReps = result.rows.map(row => row.salesrep);
    
    successResponse(res, { salesReps });
}));

/**
 * POST /budget-product-groups
 * Get product group breakdown with pricing for sales rep budget (supports __ALL__)
 * 
 * @route POST /api/aebf/budget-product-groups
 * @body {string} division - Division (FP or HC)
 * @body {number} budgetYear - Budget year
 * @body {string} [salesRep] - Sales rep name (use __ALL__ for all reps)
 * @returns {object} 200 - Product groups with KGS, Amount, MoRM, RM, Material, Process
 */
router.post('/budget-product-groups', cacheMiddleware({ ttl: CacheTTL.MEDIUM }), validationRules.budgetProductGroups, asyncHandler(async (req, res) => {
  const { division, budgetYear, salesRep } = req.body;
    
    const divisionPool = getPoolForDivision(division);
    const tables = getTableNames(division);
    
    let query;
    let params;
    
    if (!salesRep || salesRep === '__ALL__') {
      query = `
        SELECT 
          TRIM(productgroup) as product_group,
          values_type,
          SUM(values) as total_values
        FROM ${tables.salesRepBudget}
        WHERE UPPER(division) = UPPER($1)
          AND budget_year = $2
          AND UPPER(type) = 'BUDGET'
          AND values_type IN ('Amount', 'KGS', 'MoRM')
          AND productgroup IS NOT NULL
          AND TRIM(productgroup) != ''
          AND UPPER(TRIM(productgroup)) != 'SERVICES CHARGES'
        GROUP BY TRIM(productgroup), values_type
        ORDER BY TRIM(productgroup), values_type
      `;
      params = [division, parseInt(budgetYear)];
    } else {
      query = `
        SELECT 
          TRIM(productgroup) as product_group,
          values_type,
          SUM(values) as total_values
        FROM ${tables.salesRepBudget}
        WHERE UPPER(division) = UPPER($1)
          AND budget_year = $2
          AND UPPER(TRIM(salesrepname)) = UPPER(TRIM($3))
          AND UPPER(type) = 'BUDGET'
          AND values_type IN ('Amount', 'KGS', 'MoRM')
          AND productgroup IS NOT NULL
          AND TRIM(productgroup) != ''
          AND UPPER(TRIM(productgroup)) != 'SERVICES CHARGES'
        GROUP BY TRIM(productgroup), values_type
        ORDER BY TRIM(productgroup), values_type
      `;
      params = [division, parseInt(budgetYear), salesRep];
    }
    
    const result = await divisionPool.query(query, params);
    
    const productGroupsMap = {};
    
    result.rows.forEach(row => {
      const pgName = row.product_group;
      if (!productGroupsMap[pgName]) {
        productGroupsMap[pgName] = {
          name: pgName,
          KGS: 0,
          Amount: 0,
          MoRM: 0
        };
      }
      productGroupsMap[pgName][row.values_type] = parseFloat(row.total_values) || 0;
    });
    
    const pricingYear = parseInt(budgetYear) - 1;
    const pricingQuery = `
      SELECT 
        TRIM(p.product_group) as product_group,
        p.rm_round,
        p.morm_round,
        COALESCE(m.material, '') as material,
        COALESCE(m.process, '') as process
      FROM ${tables.pricingRounding} p
      LEFT JOIN ${tables.materialPercentages} m 
        ON UPPER(TRIM(p.product_group)) = UPPER(TRIM(m.product_group))
        AND m.material IS NOT NULL 
        AND TRIM(m.material) != ''
      WHERE UPPER(p.division) = UPPER($1)
        AND p.year = $2
        AND p.product_group IS NOT NULL
        AND TRIM(p.product_group) != ''
    `;
    
    const pricingResult = await divisionPool.query(pricingQuery, [division, pricingYear]);
    
    const pricingMap = {};
    pricingResult.rows.forEach(row => {
      pricingMap[row.product_group] = {
        rm: parseFloat(row.rm_round) || 0,
        morm: parseFloat(row.morm_round) || 0,
        material: row.material || '',
        process: row.process || ''
      };
    });
    
    const productGroups = Object.values(productGroupsMap).map(pg => {
      const pricing = pricingMap[pg.name] || { rm: 0, morm: 0, material: '', process: '' };
      return {
        name: pg.name,
        KGS: pg.KGS,
        Amount: pg.Amount,
        MoRM: pg.MoRM,
        RM: pricing.rm,
        Material: pricing.material,
        Process: pricing.process
      };
    });
    
    successResponse(res, {
      productGroups,
      budgetYear: parseInt(budgetYear),
      salesRep: salesRep || '__ALL__'
    });
}));

/**
 * POST /actual-product-groups
 * Get product group breakdown with pricing for actual data (supports month range)
 * 
 * @route POST /api/aebf/actual-product-groups
 * @body {string} division - Division (FP or HC)
 * @body {number} actualYear - Actual year
 * @body {string} [salesRep] - Sales rep name (use __ALL__ for all reps)
 * @body {number} [fromMonth] - Start month for range
 * @body {number} [toMonth] - End month for range
 * @returns {object} 200 - Product groups with KGS, Amount, MoRM, RM, Material, Process
 */
router.post('/actual-product-groups', cacheMiddleware({ ttl: CacheTTL.SHORT }), validationRules.actualProductGroups, asyncHandler(async (req, res) => {
  const { division, actualYear, salesRep, fromMonth, toMonth } = req.body;
    
    const divisionPool = getPoolForDivision(division);
    const tables = getTableNames(division);
    
    let query;
    let params;
    
    if (!salesRep || salesRep === '__ALL__') {
      query = `
        SELECT 
          TRIM(productgroup) as product_group,
          values_type,
          SUM(values) as total_values
        FROM ${tables.dataExcel}
        WHERE UPPER(division) = UPPER($1)
          AND year = $2
          AND UPPER(type) = 'ACTUAL'
          AND values_type IN ('AMOUNT', 'KGS', 'MORM')
          AND productgroup IS NOT NULL
          AND TRIM(productgroup) != ''
          AND UPPER(TRIM(productgroup)) != 'SERVICES CHARGES'
      `;
      params = [division, parseInt(actualYear)];
    } else {
      query = `
        SELECT 
          TRIM(productgroup) as product_group,
          values_type,
          SUM(values) as total_values
        FROM ${tables.dataExcel}
        WHERE UPPER(division) = UPPER($1)
          AND year = $2
          AND UPPER(TRIM(salesrepname)) = UPPER(TRIM($3))
          AND UPPER(type) = 'ACTUAL'
          AND values_type IN ('AMOUNT', 'KGS', 'MORM')
          AND productgroup IS NOT NULL
          AND TRIM(productgroup) != ''
          AND UPPER(TRIM(productgroup)) != 'SERVICES CHARGES'
      `;
      params = [division, parseInt(actualYear), salesRep];
    }
    
    if (fromMonth && toMonth) {
      query += ` AND month BETWEEN $${params.length + 1} AND $${params.length + 2}`;
      params.push(parseInt(fromMonth), parseInt(toMonth));
    }
    
    query += ' GROUP BY TRIM(productgroup), values_type ORDER BY TRIM(productgroup), values_type';
    
    const result = await divisionPool.query(query, params);
    
    const productGroupsMap = {};
    
    result.rows.forEach(row => {
      const pgName = row.product_group;
      if (!productGroupsMap[pgName]) {
        productGroupsMap[pgName] = {
          name: pgName,
          KGS: 0,
          AMOUNT: 0,
          MORM: 0
        };
      }
      productGroupsMap[pgName][row.values_type] = parseFloat(row.total_values) || 0;
    });
    
    const pricingQuery = `
      SELECT 
        TRIM(p.product_group) as product_group,
        p.rm_round,
        p.morm_round,
        COALESCE(m.material, '') as material,
        COALESCE(m.process, '') as process
      FROM ${tables.pricingRounding} p
      LEFT JOIN ${tables.materialPercentages} m 
        ON UPPER(TRIM(p.product_group)) = UPPER(TRIM(m.product_group))
        AND m.material IS NOT NULL 
        AND TRIM(m.material) != ''
      WHERE UPPER(p.division) = UPPER($1)
        AND p.year = $2
        AND p.product_group IS NOT NULL
        AND TRIM(p.product_group) != ''
    `;
    
    const pricingResult = await divisionPool.query(pricingQuery, [division, parseInt(actualYear)]);
    
    const pricingMap = {};
    pricingResult.rows.forEach(row => {
      pricingMap[row.product_group] = {
        rm: parseFloat(row.rm_round) || 0,
        morm: parseFloat(row.morm_round) || 0,
        material: row.material || '',
        process: row.process || ''
      };
    });
    
    const productGroups = Object.values(productGroupsMap).map(pg => {
      const pricing = pricingMap[pg.name] || { rm: 0, morm: 0, material: '', process: '' };
      return {
        name: pg.name,
        KGS: pg.KGS,
        Amount: pg.AMOUNT,
        MoRM: pg.MORM,
        RM: pricing.rm,
        Material: pricing.material,
        Process: pricing.process
      };
    });
    
    successResponse(res, {
      productGroups,
      actualYear: parseInt(actualYear),
      salesRep: salesRep || '__ALL__',
      fromMonth: fromMonth ? parseInt(fromMonth) : null,
      toMonth: toMonth ? parseInt(toMonth) : null
    });
}));

module.exports = router;
