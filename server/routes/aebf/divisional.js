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
const { generateDivisionalBudgetHtml } = require('../../utils/divisionalHtmlExport');

/**
 * POST /divisional-html-budget-data
 * Get divisional budget data - aggregated actual data by product group with pricing
 * Returns actual year data for display and any existing budget data for budgetYear
 * 
 * @route POST /api/aebf/divisional-html-budget-data
 * @body {string} division - Division (FP or HC)
 * @body {number} actualYear - Year to get actual data from
 * @returns {object} 200 - Divisional budget data with tableData, pricingData, budgetData
 */
router.post('/divisional-html-budget-data', queryLimiter, cacheMiddleware({ ttl: CacheTTL.MEDIUM }), asyncHandler(async (req, res) => {
  const { division, actualYear, budgetYear: requestedBudgetYear } = req.body;
  
  if (!division || !actualYear) {
    return res.status(400).json({ 
      success: false, 
      error: 'Division and actualYear are required' 
    });
  }
  
  const divisionPool = getPoolForDivision(division);
  const tables = getTableNames(division);
  // Use requested budgetYear if provided, otherwise default to actualYear + 1
  const budgetYear = requestedBudgetYear ? parseInt(requestedBudgetYear) : parseInt(actualYear) + 1;
  
  // 1. Get aggregated actual data by product group (excluding Services Charges)
  const actualQuery = `
    SELECT 
      TRIM(productgroup) as product_group,
      month,
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
    GROUP BY TRIM(productgroup), month, values_type
    ORDER BY TRIM(productgroup), month
  `;
  
  const actualResult = await divisionPool.query(actualQuery, [division, parseInt(actualYear)]);
  
  // Build table data structure - convert KGS to MT (divide by 1000)
  const productGroupsMap = {};
  actualResult.rows.forEach(row => {
    const pgName = row.product_group;
    if (!productGroupsMap[pgName]) {
      productGroupsMap[pgName] = {
        productGroup: pgName,
        monthlyActual: {}
      };
    }
    const month = row.month;
    if (!productGroupsMap[pgName].monthlyActual[month]) {
      productGroupsMap[pgName].monthlyActual[month] = { AMOUNT: 0, MT: 0, MORM: 0 };
    }
    const value = parseFloat(row.total_values) || 0;
    if (row.values_type === 'KGS') {
      // Convert KGS to MT
      productGroupsMap[pgName].monthlyActual[month].MT = value / 1000;
    } else {
      productGroupsMap[pgName].monthlyActual[month][row.values_type] = value;
    }
  });
  
  const tableData = Object.values(productGroupsMap);
  
  // 1b. Get Services Charges separately (has Amount/MoRM but no KGS)
  const servicesChargesQuery = `
    SELECT 
      month,
      values_type,
      SUM(values) as total_values
    FROM ${tables.dataExcel}
    WHERE UPPER(division) = UPPER($1)
      AND year = $2
      AND UPPER(type) = 'ACTUAL'
      AND values_type IN ('AMOUNT', 'MORM')
      AND UPPER(TRIM(productgroup)) = 'SERVICES CHARGES'
    GROUP BY month, values_type
    ORDER BY month
  `;
  
  const servicesResult = await divisionPool.query(servicesChargesQuery, [division, parseInt(actualYear)]);
  
  // Build Services Charges data
  const servicesChargesData = {
    productGroup: 'Services Charges',
    isServiceCharges: true, // Flag for frontend to handle differently
    monthlyActual: {}
  };
  
  servicesResult.rows.forEach(row => {
    const month = row.month;
    if (!servicesChargesData.monthlyActual[month]) {
      servicesChargesData.monthlyActual[month] = { AMOUNT: 0, MT: 0, MORM: 0 };
    }
    const value = parseFloat(row.total_values) || 0;
    servicesChargesData.monthlyActual[month][row.values_type] = value;
  });
  
  // 2. Get pricing data (asp_round = Amount per KG, morm_round = MoRM per KG)
  const pricingQuery = `
    SELECT 
      TRIM(p.product_group) as product_group,
      p.asp_round,
      p.morm_round,
      COALESCE(m.material, '') as material,
      COALESCE(m.process, '') as process
    FROM ${tables.pricingRounding} p
    LEFT JOIN ${tables.materialPercentages} m 
      ON UPPER(TRIM(p.product_group)) = UPPER(TRIM(m.product_group))
    WHERE UPPER(p.division) = UPPER($1)
      AND p.year = $2
      AND p.product_group IS NOT NULL
      AND TRIM(p.product_group) != ''
  `;
  
  const pricingResult = await divisionPool.query(pricingQuery, [division, parseInt(actualYear)]);
  
  const pricingData = {};
  pricingResult.rows.forEach(row => {
    pricingData[row.product_group] = {
      asp: parseFloat(row.asp_round) || 0,  // Amount per KG
      morm: parseFloat(row.morm_round) || 0, // MoRM per KG
      material: row.material || '',
      process: row.process || ''
    };
  });
  
  // 3. Get existing budget data (for budgetYear = actualYear + 1)
  // Table columns: division, year, month, product_group, metric, value, material, process
  let budgetData = {};
  let servicesChargesBudget = {};
  try {
    // Get regular product group budgets (stored as KGS, convert to MT)
    const budgetQuery = `
      SELECT 
        TRIM(product_group) as product_group,
        month,
        metric,
        value
      FROM ${tables.divisionalBudget}
      WHERE UPPER(division) = UPPER($1)
        AND year = $2
        AND UPPER(metric) = 'KGS'
        AND UPPER(TRIM(product_group)) != 'SERVICES CHARGES'
    `;
    
    const budgetResult = await divisionPool.query(budgetQuery, [division, budgetYear]);
    
    budgetResult.rows.forEach(row => {
      const key = `${row.product_group}|${row.month}`;
      // Convert KGS to MT for display (user enters in MT)
      budgetData[key] = (parseFloat(row.value) || 0) / 1000;
    });
    
    // Get Services Charges budget (stored as AMOUNT directly)
    const servicesBudgetQuery = `
      SELECT 
        month,
        metric,
        value
      FROM ${tables.divisionalBudget}
      WHERE UPPER(division) = UPPER($1)
        AND year = $2
        AND UPPER(TRIM(product_group)) = 'SERVICES CHARGES'
        AND UPPER(metric) IN ('AMOUNT', 'MORM')
    `;
    
    const servicesBudgetResult = await divisionPool.query(servicesBudgetQuery, [division, budgetYear]);
    
    servicesBudgetResult.rows.forEach(row => {
      const key = `Services Charges|${row.month}|${row.metric}`;
      // Database stores full value, frontend expects value in k (thousands)
      // Divide by 1000 to convert from full AED to k for frontend display
      servicesChargesBudget[key] = (parseFloat(row.value) || 0) / 1000;
    });
  } catch (error) {
    logger.warn('No existing budget data found:', error.message);
  }
  
  // Check if Services Charges has any data (actual or from pricing table)
  const hasServicesChargesData = Object.keys(servicesChargesData.monthlyActual).length > 0 || 
    pricingData['Services Charges'] !== undefined;
  
  successResponse(res, { 
    data: tableData, 
    servicesChargesData: hasServicesChargesData ? servicesChargesData : null,
    pricingData, 
    budgetData,
    servicesChargesBudget,
    actualYear: parseInt(actualYear),
    budgetYear
  });
}));

/**
 * POST /export-divisional-html-budget-form
 * Export divisional budget HTML form with actual data and editable budget fields
 * Now generates a dynamic HTML with embedded JavaScript for live calculations
 * 
 * @route POST /api/aebf/export-divisional-html-budget-form
 * @body {string} division - Division (FP or HC)
 * @body {number} actualYear - Actual year for reference data
 * @body {array} tableData - Table data with product groups and actual values
 * @body {object} budgetData - Current budget values
 * @body {object} servicesChargesData - Services Charges actual data
 * @body {object} servicesChargesBudget - Services Charges budget data
 * @body {object} pricingData - Pricing data for Amount/MoRM calculations
 * @returns {html} - Dynamic HTML form file for download
 */
router.post('/export-divisional-html-budget-form', asyncHandler(async (req, res) => {
  const { division, actualYear, tableData, budgetData, servicesChargesData, servicesChargesBudget, pricingData } = req.body;
  
  if (!division || !actualYear) {
    return res.status(400).json({ success: false, error: 'Division and actualYear are required' });
  }
  
  const budgetYear = parseInt(actualYear) + 1;
  
  logger.info(`Generating dynamic divisional budget HTML for ${division}, budget year ${budgetYear}`);
  
  // Generate the dynamic HTML using the generator
  const htmlContent = generateDivisionalBudgetHtml({
    division,
    actualYear: parseInt(actualYear),
    budgetYear,
    tableData: tableData || [],
    budgetData: budgetData || {},
    servicesChargesData,
    servicesChargesBudget: servicesChargesBudget || {},
    pricingData: pricingData || {}
  });
  
  // Generate filename with timestamp (no seconds, just HH:mm)
  const now = new Date();
  const dateStr = String(now.getDate()).padStart(2, '0') + String(now.getMonth() + 1).padStart(2, '0') + now.getFullYear();
  const timeStr = String(now.getHours()).padStart(2, '0') + String(now.getMinutes()).padStart(2, '0');
  const filename = `BUDGET_Divisional_${division}_${budgetYear}_${dateStr}_${timeStr}.html`;
  
  res.setHeader('Content-Type', 'text/html');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(htmlContent);
}));

/**
 * POST /import-divisional-budget-html
 * Import divisional budget from HTML file
 * Parses the HTML to extract budget values and saves to database
 * 
 * @route POST /api/aebf/import-divisional-budget-html
 * @body {string} htmlContent - The HTML content to parse
 * @body {boolean} forceUpdate - If true, update existing records without confirmation
 * @returns {object} 200 - Import result with record counts
 */
router.post('/import-divisional-budget-html', asyncHandler(async (req, res) => {
  const { htmlContent, forceUpdate, confirmReplace } = req.body;
  const shouldForceUpdate = forceUpdate || confirmReplace;
  
  if (!htmlContent) {
    return res.status(400).json({ success: false, error: 'htmlContent is required' });
  }
  
  // Parse metadata from HTML
  const divisionMatch = htmlContent.match(/<meta\s+name="division"\s+content="([^"]+)"/i);
  const actualYearMatch = htmlContent.match(/<meta\s+name="actualYear"\s+content="(\d+)"/i);
  const budgetYearMatch = htmlContent.match(/<meta\s+name="budgetYear"\s+content="(\d+)"/i);
  
  if (!divisionMatch || !budgetYearMatch) {
    return res.status(400).json({ 
      success: false, 
      error: 'Invalid HTML file - missing division or budgetYear metadata. Please use a file exported from this system.' 
    });
  }
  
  const division = divisionMatch[1];
  const budgetYear = parseInt(budgetYearMatch[1]);
  const actualYear = actualYearMatch ? parseInt(actualYearMatch[1]) : budgetYear - 1;
  
  // Parse budget values - handle both input elements and static TD elements
  // Structure: actual-row with data-pg="ProductGroup" followed by budget-row with 12 monthly values
  const parsedRecords = [];
  const servicesChargesRecords = [];
  
  // Method 1: Parse from input elements (unfilled/editable HTML)
  const inputPattern = /<input[^>]*data-group="([^"]+)"[^>]*data-month="(\d+)"[^>]*value="([^"]*)"[^>]*\/?>/gi;
  let match;
  
  while ((match = inputPattern.exec(htmlContent)) !== null) {
    const productGroup = match[1];
    const month = parseInt(match[2]);
    const value = match[3].trim();
    
    // Check if this is a Services Charges input with AMOUNT metric
    const isServicesCharges = productGroup.toUpperCase() === 'SERVICES CHARGES';
    const hasAmountMetric = match[0].includes('data-metric="AMOUNT"');
    
    if (isServicesCharges && hasAmountMetric) {
      if (value && !isNaN(parseFloat(value))) {
        servicesChargesRecords.push({
          month,
          amountValue: Math.round(parseFloat(value) * 1000)
        });
      }
    } else if (!isServicesCharges && value && !isNaN(parseFloat(value))) {
      parsedRecords.push({
        productGroup,
        month,
        value: Math.round(parseFloat(value) * 1000) // Convert MT to KGS
      });
    }
  }
  
  // Method 2: Parse from static HTML (filled/saved HTML with static TD elements)
  // Pattern: <tr class="actual-row" data-pg="ProductGroup"> followed by <tr class="budget-row">
  if (parsedRecords.length === 0) {
    const actualRowPattern = /<tr[^>]*class="actual-row"[^>]*data-pg="([^"]+)"[^>]*>[\s\S]*?<\/tr>\s*<tr[^>]*class="budget-row"[^>]*(?:data-pg="[^"]*")?[^>]*>([\s\S]*?)<\/tr>/gi;
    
    while ((match = actualRowPattern.exec(htmlContent)) !== null) {
      const productGroup = match[1];
      const budgetRowContent = match[2];
      
      // Skip Services Charges - handled separately
      if (productGroup.toUpperCase() === 'SERVICES CHARGES') continue;
      
      // Extract monthly values from TD elements (first 12 TDs are months)
      // Handle both plain text and formatted text in static HTML
      const tdPattern = /<td[^>]*>([\s\S]*?)<\/td>/gi;
      let tdMatch;
      let month = 1;
      
      while ((tdMatch = tdPattern.exec(budgetRowContent)) !== null && month <= 12) {
        let tdContent = tdMatch[1].trim();
        // Strip HTML tags to get plain value
        let value = tdContent.replace(/<[^>]*>/g, '').trim().replace(/,/g, '');
        // Skip if empty or zero
        if (value && !isNaN(parseFloat(value)) && parseFloat(value) !== 0) {
          parsedRecords.push({
            productGroup,
            month,
            value: Math.round(parseFloat(value) * 1000) // Convert MT to KGS
          });
        }
        month++;
      }
    }
  }
  
  // Parse Services Charges from static HTML if not found in inputs
  if (servicesChargesRecords.length === 0) {
    // Look for Services Charges budget row - now has proper class
    const scPattern = /<tr[^>]*class="[^"]*services-charges-budget-row[^"]*"[^>]*>([\s\S]*?)<\/tr>/gi;
    const scMatch = scPattern.exec(htmlContent);
    
    if (scMatch) {
      const scRowContent = scMatch[1];
      // Updated pattern to handle:
      // 1. Input elements: <input ... value="100" ...>
      // 2. Static spans: <span ...>100</span> <span>k</span>
      // 3. Plain text: 100
      const tdPattern = /<td[^>]*>(?:<div[^>]*>)?(?:<input[^>]*value="([^"]*)"[^>]*>|<span[^>]*>([^<]*)<\/span>|([^<\s][^<]*))/gi;
      let tdMatch;
      let month = 1;
      
      while ((tdMatch = tdPattern.exec(scRowContent)) !== null && month <= 12) {
        // Get value from input value, span content, or plain text
        const value = (tdMatch[1] || tdMatch[2] || tdMatch[3] || '').trim().replace(/,/g, '');
        if (value && !isNaN(parseFloat(value)) && parseFloat(value) !== 0) {
          servicesChargesRecords.push({
            month,
            amountValue: Math.round(parseFloat(value) * 1000)
          });
        }
        month++;
      }
    }
  }
  
  if (parsedRecords.length === 0 && servicesChargesRecords.length === 0) {
    return res.status(400).json({ 
      success: false, 
      error: 'No valid budget values found in the HTML file. Please fill in at least one budget value.' 
    });
  }
  
  const divisionPool = getPoolForDivision(division);
  const tables = getTableNames(division);
  
  // Check for existing budget
  const existingResult = await divisionPool.query(`
    SELECT COUNT(*) as count, MAX(uploaded_at) as last_upload
    FROM ${tables.divisionalBudget}
    WHERE UPPER(division) = UPPER($1) AND year = $2
  `, [division, budgetYear]);
  
  const existingCount = parseInt(existingResult.rows[0]?.count || 0);
  const lastUpload = existingResult.rows[0]?.last_upload;
  
  // If existing budget found and no forceUpdate/confirmReplace, ask for confirmation
  if (existingCount > 0 && !shouldForceUpdate) {
    return successResponse(res, {
      needsConfirmation: true,
      existingBudget: {
        recordCount: existingCount,
        lastUpload
      },
      metadata: {
        division,
        budgetYear,
        actualYear
      },
      recordsToImport: parsedRecords.length + servicesChargesRecords.length
    });
  }
  
  // Proceed with import using the existing save function
  const result = await saveDivisionalBudget(divisionPool, {
    division,
    budgetYear,
    records: parsedRecords
  });
  
  // Save Services Charges records (AMOUNT and MORM) using upsert
  let servicesChargesCount = 0;
  if (servicesChargesRecords.length > 0) {
    // Insert new Services Charges records
    for (const record of servicesChargesRecords) {
      // Insert AMOUNT record with ON CONFLICT
      await divisionPool.query(`
        INSERT INTO ${tables.divisionalBudget} 
        (division, year, month, product_group, metric, value, material, process, uploaded_filename, uploaded_at)
        VALUES ($1, $2, $3, 'Services Charges', 'AMOUNT', $4, '', '', 'Divisional_HTML_Import', NOW())
        ON CONFLICT (UPPER(division), year, month, product_group, UPPER(metric))
        DO UPDATE SET value = EXCLUDED.value, uploaded_filename = EXCLUDED.uploaded_filename, uploaded_at = NOW()
      `, [division, budgetYear, record.month, record.amountValue]);
      
      // Insert MORM record (same as AMOUNT for Services Charges - 100% margin)
      await divisionPool.query(`
        INSERT INTO ${tables.divisionalBudget} 
        (division, year, month, product_group, metric, value, material, process, uploaded_filename, uploaded_at)
        VALUES ($1, $2, $3, 'Services Charges', 'MORM', $4, '', '', 'Divisional_HTML_Import', NOW())
        ON CONFLICT (UPPER(division), year, month, product_group, UPPER(metric))
        DO UPDATE SET value = EXCLUDED.value, uploaded_filename = EXCLUDED.uploaded_filename, uploaded_at = NOW()
      `, [division, budgetYear, record.month, record.amountValue]);
      
      servicesChargesCount++;;
    }
  }
  
  // Calculate Services Charges total (sum of amountValue)
  const servicesChargesTotal = servicesChargesRecords.reduce((sum, r) => sum + (r.amountValue || 0), 0);
  
  // Invalidate cache
  invalidateCache('aebf:*').catch(err => 
    logger.warn('Cache invalidation warning:', err.message)
  );
  
  // Calculate combined totals including Services Charges
  const budgetTotals = result.budgetTotals || { volumeMT: 0, volumeKGS: 0, amount: 0, morm: 0 };
  const combinedTotals = {
    volumeMT: budgetTotals.volumeMT,
    volumeKGS: budgetTotals.volumeKGS,
    amount: budgetTotals.amount + servicesChargesTotal,
    morm: budgetTotals.morm + servicesChargesTotal, // Services Charges MoRM = 100% of Amount
    servicesCharges: servicesChargesTotal
  };
  
  successResponse(res, {
    success: true,
    metadata: {
      division,
      budgetYear,
      actualYear
    },
    recordsInserted: result.recordsInserted,
    recordsProcessed: result.recordsProcessed,
    servicesChargesRecords: servicesChargesCount,
    budgetTotals: combinedTotals,
    skippedRecords: result.skippedRecords,
    validationErrors: result.validationErrors,
    warnings: result.warnings || [],
    pricingYear: result.pricingYear
  });
}));

/**
 * POST /save-divisional-budget
 * Save divisional budget via saveDivisionalBudget service
 * 
 * @route POST /api/aebf/save-divisional-budget
 * @body {string} division - Division (FP or HC)
 * @body {number} budgetYear - Budget year
 * @body {array} records - Array of budget records (regular product groups)
 * @body {array} servicesChargesRecords - Array of Services Charges records (optional)
 * @returns {object} 200 - Save result with record counts
 */
router.post('/save-divisional-budget', validationRules.saveDivisionalBudget, asyncHandler(async (req, res) => {
  const { division, budgetYear, records, servicesChargesRecords } = req.body;
  
  const divisionPool = getPoolForDivision(division);
  const tables = getTableNames(division);
  
  // Save regular product group budget records
  const result = await saveDivisionalBudget(divisionPool, {
    division,
    budgetYear,
    records: records || []
  });
  
  // Save Services Charges records separately (stored as AMOUNT, not KGS) using upsert
  let servicesChargesCount = 0;
  if (servicesChargesRecords && servicesChargesRecords.length > 0) {
    // Insert new Services Charges records
    for (const record of servicesChargesRecords) {
      // Insert AMOUNT record with ON CONFLICT
      await divisionPool.query(`
        INSERT INTO ${tables.divisionalBudget} 
        (division, year, month, product_group, metric, value, material, process, uploaded_filename, uploaded_at)
        VALUES ($1, $2, $3, $4, $5, $6, '', '', 'Divisional_Live_Save', NOW())
        ON CONFLICT (UPPER(division), year, month, product_group, UPPER(metric))
        DO UPDATE SET value = EXCLUDED.value, uploaded_filename = EXCLUDED.uploaded_filename, uploaded_at = NOW()
      `, [
        division.toUpperCase(),
        parseInt(budgetYear),
        record.month,
        'Services Charges',
        'AMOUNT',
        record.value
      ]);
      
      // Also insert MORM record (100% of Amount for Services Charges)
      await divisionPool.query(`
        INSERT INTO ${tables.divisionalBudget} 
        (division, year, month, product_group, metric, value, material, process, uploaded_filename, uploaded_at)
        VALUES ($1, $2, $3, $4, $5, $6, '', '', 'Divisional_Live_Save', NOW())
        ON CONFLICT (UPPER(division), year, month, product_group, UPPER(metric))
        DO UPDATE SET value = EXCLUDED.value, uploaded_filename = EXCLUDED.uploaded_filename, uploaded_at = NOW()
      `, [
        division.toUpperCase(),
        parseInt(budgetYear),
        record.month,
        'Services Charges',
        'MORM',
        record.value  // MoRM = 100% of Amount
      ]);
      
      servicesChargesCount++;
    }
    
    logger.info(`Saved ${servicesChargesCount} Services Charges records for ${division} ${budgetYear}`);
  }
  
  // Invalidate cache after saving
  invalidateCache('aebf:*').catch(err => 
    logger.warn('Cache invalidation warning:', err.message)
  );
  
  successResponse(res, {
    ...result,
    servicesChargesRecords: servicesChargesCount
  });
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
    WHERE UPPER(division) = UPPER($1) AND year = $2
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
