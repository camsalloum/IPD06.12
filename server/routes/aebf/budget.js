/**
 * @fileoverview AEBF Budget Routes
 * @module routes/aebf/budget
 * @description Handles budget operations including uploads, estimates calculation, and sales rep recaps
 * 
 * @requires express
 * @requires multer File upload middleware for Excel files
 * @requires child_process For PowerShell script execution
 * 
 * @routes
 * - GET  /budget                   - Retrieve paginated budget data with search
 * - POST /upload-budget            - Upload budget Excel file via PowerShell
 * - POST /calculate-estimate       - Calculate estimates from actual base period
 * - POST /save-estimate            - Save estimates with proportional distribution
 * - GET  /budget-years             - Get available budget years from sales_rep_budget table
 * - POST /budget-sales-rep-recap   - Get sales rep budget totals (Amount, KGS, MoRM)
 * 
 * @algorithms
 * - Proportional Distribution: Calculates dimension share of base period total, applies to monthly estimate
 * - Simple Averaging: Total÷Months for uniform distribution
 * - Base Period Exclusion: Excludes selected months from actual base calculations
 * 
 * @features
 * - Transaction handling for data consistency
 * - Batch inserts (500 records per batch)
 * - PowerShell integration for Excel processing
 * - Multi-dimensional estimate distribution
 * - Sales rep performance recaps
 * 
 * @validation All routes use express-validator middleware
 * @errorHandling Centralized error handler with transaction rollback
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const logger = require('../../utils/logger');
const { getPoolForDivision, getTableNames, extractDivisionCode } = require('./shared');
const { asyncHandler, successResponse, ErrorCreators } = require('../../middleware/aebfErrorHandler');
const validationRules = require('../../middleware/aebfValidation');
const { queryLimiter, uploadLimiter } = require('../../middleware/rateLimiter');
const { cacheMiddleware, CacheTTL, invalidateCache } = require('../../middleware/cache');

// Valid divisions
const VALID_DIVISIONS = ['FP', 'HC'];

// Configure multer for file upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../../uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    const ext = path.extname(file.originalname);
    cb(null, `aebf-budget-${timestamp}${ext}`);
  }
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext !== '.xlsx' && ext !== '.xls') {
      return cb(new Error('Only Excel files are allowed'));
    }
    cb(null, true);
  },
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB max
  }
});

/**
 * GET /budget
 * Retrieve Budget data with pagination and filters
 * 
 * @route GET /api/aebf/budget
 * @query {string} division - Division (FP or HC)
 * @query {number} [year] - Filter by year
 * @query {number} [month] - Filter by month
 * @query {string} [search] - Search across multiple fields
 * @query {number} [page=1] - Page number
 * @query {number} [pageSize=50] - Records per page
 * @returns {object} 200 - Paginated budget data with summary
 */
router.get('/budget', queryLimiter, cacheMiddleware({ ttl: CacheTTL.LONG }), validationRules.getBudget, asyncHandler(async (req, res) => {
  const { division, year, month, search, page, pageSize } = req.query;
  
  logger.info('📊 Get budget data request:', { division, year, month, search, page, pageSize });
    
    let query = `
      SELECT 
        id, division, type, year, month, customername, salesrepname, 
        countryname, productgroup, material, process, values_type, values,
        sourcesheet, updated_at, uploaded_by
      FROM ${getTableNames(division).dataExcel}
      WHERE division = $1 AND type = 'Budget'
    `;
    const params = [division.toUpperCase()];
    let paramIndex = 2;
    
    if (year) {
      query += ` AND year = $${paramIndex}`;
      params.push(parseInt(year));
      paramIndex++;
    }
    
    if (month) {
      query += ` AND month = $${paramIndex}`;
      params.push(parseInt(month));
      paramIndex++;
    }
    
    if (search) {
      query += ` AND (
        UPPER(customername) LIKE $${paramIndex} OR
        UPPER(salesrepname) LIKE $${paramIndex} OR
        UPPER(countryname) LIKE $${paramIndex} OR
        UPPER(productgroup) LIKE $${paramIndex}
      )`;
      params.push(`%${search.toUpperCase()}%`);
      paramIndex++;
    }
    
    query += ' ORDER BY year DESC, month, customername';
    
    const currentPage = parseInt(page) || 1;
    const limit = parseInt(pageSize) || 50;
    const offset = (currentPage - 1) * limit;
    
    const divisionPool = getPoolForDivision(division);
    
    // Build count query - remove ORDER BY which is invalid for COUNT
    const countQuery = query
      .replace(/SELECT[\s\S]+FROM/, 'SELECT COUNT(*) FROM')
      .replace(/ORDER BY[\s\S]+$/, '');
    const countResult = await divisionPool.query(countQuery, params);
    const totalRecords = parseInt(countResult.rows[0].count);
    
    query += ` LIMIT ${limit} OFFSET ${offset}`;
    
    const result = await divisionPool.query(query, params);
    
    const summary = {
      totalAmount: result.rows.filter(r => r.values_type === 'AMOUNT').reduce((sum, row) => sum + (parseFloat(row.values) || 0), 0),
      totalKgs: result.rows.filter(r => r.values_type === 'KGS').reduce((sum, row) => sum + (parseFloat(row.values) || 0), 0),
      totalMorm: result.rows.filter(r => r.values_type === 'MORM').reduce((sum, row) => sum + (parseFloat(row.values) || 0), 0),
      recordCount: result.rows.length
    };
    
    logger.info(`✅ Found ${result.rows.length} budget records (page ${currentPage} of ${Math.ceil(totalRecords / limit)})`);
    
    successResponse(res, {
      data: result.rows,
      summary,
      pagination: {
        page: currentPage,
        pageSize: limit,
        total: totalRecords
      }
    });
}));

/**
 * POST /upload-budget
 * Upload budget Excel file and process via PowerShell script
 * 
 * @route POST /api/aebf/upload-budget
 * @body {string} division - Division (FP or HC)
 * @body {string} [uploadMode=replace] - Upload mode (upsert or replace)
 * @body {string} uploadedBy - User performing the upload
 * @body {string} [selectedYearMonths] - Selective year-month combinations
 * @file {file} file - Excel file to upload
 * @returns {object} 200 - Upload success with processing details
 */
router.post('/upload-budget', uploadLimiter, upload.single('file'), validationRules.uploadBudget, asyncHandler(async (req, res) => {
  const { division, uploadMode, uploadedBy, selectedYearMonths } = req.body;
  const filePath = req.file.path;
  
  logger.info('📤 Budget upload request received:', {
    division,
    uploadMode: uploadMode || 'replace',
    uploadedBy,
    selectedYearMonths,
    fileName: req.file.originalname,
    fileSize: req.file.size
  });
  
  const mode = uploadMode ? uploadMode.toLowerCase() : 'replace';
    
    const scriptPath = path.join(__dirname, '../../../scripts/transform-budget-to-sql.ps1');
    
    if (!fs.existsSync(scriptPath)) {
      return res.status(500).json({
        success: false,
        error: 'Budget transform script not found'
      });
    }
    
    logger.info('🔄 Executing Budget PowerShell script...');
    
    const psArgs = [
      '-ExecutionPolicy', 'Bypass',
      '-File', scriptPath,
      '-ExcelPath', filePath,
      '-Division', division.toUpperCase(),
      '-UploadMode', mode,
      '-UploadedBy', uploadedBy
    ];
    
    if (selectedYearMonths) {
      psArgs.push('-SelectiveYearMonths', selectedYearMonths);
    }
    
    const psProcess = spawn('powershell.exe', psArgs);
    
    let stdout = '';
    let stderr = '';
    
    psProcess.stdout.on('data', (data) => {
      const output = data.toString();
      stdout += output;
      logger.info(output);
    });
    
    psProcess.stderr.on('data', (data) => {
      const output = data.toString();
      stderr += output;
      logger.error(output);
    });
    
    psProcess.on('close', (code) => {
      try {
        fs.unlinkSync(filePath);
        logger.info('🗑️ Cleaned up uploaded file');
      } catch (err) {
        logger.error('Failed to clean up file:', err);
      }
      
      if (code === 0) {
        logger.info('✅ Budget upload completed successfully');
        
        // Invalidate cache after successful upload
        invalidateCache('aebf:*').catch(err => 
          logger.warn('Cache invalidation warning:', err.message)
        );
        
        res.json({
          success: true,
          message: 'Budget data uploaded successfully',
          output: stdout,
          mode: mode
        });
      } else {
        logger.error('❌ Budget upload failed with exit code:', code);
        res.status(500).json({
          success: false,
          error: 'Budget upload failed',
          details: stderr || stdout,
          exitCode: code
        });
      }
    });
    
    psProcess.on('error', (error) => {
      logger.error('❌ PowerShell process error:', error);
      
      try {
        fs.unlinkSync(filePath);
      } catch (err) {
        logger.error('Failed to clean up file:', err);
      }
      
      res.status(500).json({
        success: false,
        error: 'Failed to execute budget transform script',
        details: error.message
      });
    });
}));

/**
 * DELETE /clear-estimates
 * Clear all estimate records for a specific year
 * 
 * @route DELETE /api/aebf/clear-estimates
 * @query {string} division - Division (FP or HC)
 * @query {number} year - Year to clear estimates for
 * @returns {object} 200 - Delete result with count
 */
router.delete('/clear-estimates', queryLimiter, asyncHandler(async (req, res) => {
  const { division, year } = req.query;
  
  if (!division || !year) {
    return res.status(400).json({
      success: false,
      error: 'Division and year are required'
    });
  }
  
  logger.info('🗑️ Clear estimates request:', { division, year });
  
  const divisionPool = getPoolForDivision(division);
  const tables = getTableNames(division);
  
  // Get count before delete
  const countQuery = `
    SELECT COUNT(*) as count
    FROM public.${tables.dataExcel}
    WHERE UPPER(division) = $1 AND UPPER(type) = 'ESTIMATE' AND year = $2
  `;
  const countResult = await divisionPool.query(countQuery, [division.toUpperCase(), parseInt(year)]);
  const existingCount = parseInt(countResult.rows[0].count);
  
  if (existingCount === 0) {
    return successResponse(res, {
      deletedCount: 0,
      message: 'No estimate records found for this year'
    });
  }
  
  // Delete all estimates for the year
  const deleteQuery = `
    DELETE FROM public.${tables.dataExcel}
    WHERE UPPER(division) = $1 AND UPPER(type) = 'ESTIMATE' AND year = $2
  `;
  const deleteResult = await divisionPool.query(deleteQuery, [division.toUpperCase(), parseInt(year)]);
  
  logger.info(`🗑️ Deleted ${deleteResult.rowCount} estimate records for ${division} ${year}`);
  
  successResponse(res, {
    deletedCount: deleteResult.rowCount,
    message: `Successfully cleared ${deleteResult.rowCount} estimate records for ${year}`
  });
}));

/**
 * POST /calculate-estimate
 * Calculate estimates based on actual data using proportional distribution
 * 
 * @route POST /api/aebf/calculate-estimate
 * @body {string} division - Division (FP or HC)
 * @body {number} year - Year to calculate estimates for
 * @body {array} selectedMonths - Months to estimate
 * @body {string} createdBy - User creating the estimate
 * @returns {object} 200 - Calculated estimates with monthly aggregates
 */
router.post('/calculate-estimate', queryLimiter, validationRules.calculateEstimate, asyncHandler(async (req, res) => {
  const { division, year, selectedMonths, createdBy } = req.body;
  
  logger.info('📊 Calculate estimate request:', { division, year, selectedMonths, createdBy });
    const divisionPool = getPoolForDivision(division);
    const tables = getTableNames(division);
    
    const allMonthsQuery = `
      SELECT DISTINCT month
      FROM public.${tables.dataExcel}
      WHERE UPPER(division) = $1 AND UPPER(type) = 'ACTUAL' AND year = $2
      ORDER BY month
    `;
    
    const allMonthsResult = await divisionPool.query(allMonthsQuery, [division.toUpperCase(), year]);
    const allActualMonths = allMonthsResult.rows.map(row => row.month);
    
    logger.info('📅 All Actual months:', allActualMonths);
    
    const basePeriodMonths = allActualMonths.filter(m => !selectedMonths.includes(m));
    
    if (basePeriodMonths.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No base period months available for calculation. All Actual months are selected for estimation.'
      });
    }
    
    logger.info('📊 Base period months (for averaging):', basePeriodMonths);
    logger.info('🎯 Estimate months:', selectedMonths);
    
    const totalsQuery = `
      SELECT 
        values_type,
        SUM(values) as total_value,
        COUNT(*) as record_count
      FROM public.${tables.dataExcel}
      WHERE UPPER(division) = $1 
        AND UPPER(type) = 'ACTUAL' 
        AND year = $2 
        AND month = ANY($3)
      GROUP BY values_type
      ORDER BY values_type
    `;
    
    const totalsResult = await divisionPool.query(totalsQuery, [
      division.toUpperCase(),
      year,
      basePeriodMonths
    ]);
    
    logger.info(`✅ Base period totals:`, totalsResult.rows);
    
    const monthlyAverages = {};
    totalsResult.rows.forEach(row => {
      const avgPerMonth = parseFloat(row.total_value) / basePeriodMonths.length;
      monthlyAverages[row.values_type] = {
        average: Math.round(avgPerMonth),
        totalRecords: parseInt(row.record_count)
      };
    });
    
    logger.info('📊 Monthly averages (Simple method - Total÷Months):', monthlyAverages);
    
    const monthlyAggregates = [];
    
    for (const month of selectedMonths.sort((a, b) => a - b)) {
      monthlyAggregates.push({
        month,
        amount: monthlyAverages['AMOUNT']?.average || 0,
        kgs: monthlyAverages['KGS']?.average || 0,
        morm: monthlyAverages['MORM']?.average || 0,
        recordCount: Math.round((monthlyAverages['AMOUNT']?.totalRecords || 0) / basePeriodMonths.length)
      });
    }
    
    logger.info('📈 Monthly aggregates calculated:', monthlyAggregates);
    
    successResponse(res, {
      estimates: monthlyAggregates,
      basePeriodMonths,
      estimatedMonths: selectedMonths.sort((a, b) => a - b),
      baseMonthCount: basePeriodMonths.length
    });
}));

/**
 * POST /save-estimate
 * Save approved estimates to database with proportional distribution
 * 
 * @route POST /api/aebf/save-estimate
 * @body {string} division - Division (FP or HC)
 * @body {number} year - Year for estimates
 * @body {object} estimates - Estimates object with month keys
 * @body {string} approvedBy - User approving the estimates
 * @returns {object} 200 - Save success with record counts
 */
router.post('/save-estimate', queryLimiter, validationRules.saveEstimate, asyncHandler(async (req, res) => {
  const { division, year, estimates, approvedBy } = req.body;
  
  logger.info('💾 Save estimate request:', { division, year, estimateMonths: Object.keys(estimates), approvedBy });
  
  const divisionPool = getPoolForDivision(division);
  const tables = getTableNames(division);
  
  const client = await divisionPool.connect();
  
  try {
    await client.query('BEGIN');
    
    const months = Object.keys(estimates).map(Number).sort((a, b) => a - b);
    logger.info('📅 Saving estimates for months:', months);
    
    const basePeriodQuery = `
      SELECT DISTINCT month
      FROM public.${tables.dataExcel}
      WHERE UPPER(division) = $1 AND UPPER(type) = 'ACTUAL' AND year = $2
      ORDER BY month
    `;
    
    const basePeriodResult = await client.query(basePeriodQuery, [division.toUpperCase(), year]);
    const allActualMonths = basePeriodResult.rows.map(row => row.month);
    const basePeriodMonths = allActualMonths.filter(m => !months.includes(m));
    
    if (basePeriodMonths.length === 0) {
      throw new Error('No base period months available');
    }
    
    logger.info('📊 Base period months:', basePeriodMonths);
    
    const dimensionQuery = `
      SELECT 
        salesrepname, customername, countryname, productgroup, material, process,
        values_type, SUM(values) as total_value
      FROM public.${tables.dataExcel}
      WHERE UPPER(division) = $1 AND UPPER(type) = 'ACTUAL' AND year = $2 AND month = ANY($3)
      GROUP BY salesrepname, customername, countryname, productgroup, material, process, values_type
    `;
    
    const dimensionResult = await client.query(dimensionQuery, [division.toUpperCase(), year, basePeriodMonths]);
    
    logger.info(`✅ Found ${dimensionResult.rows.length} dimension combinations to replicate`);
    
    const deleteQuery = `
      DELETE FROM public.${tables.dataExcel}
      WHERE UPPER(division) = $1 AND UPPER(type) = 'ESTIMATE' AND year = $2 AND month = ANY($3)
    `;
    
    const deleteResult = await client.query(deleteQuery, [division.toUpperCase(), year, months]);
    logger.info(`🗑️ Deleted ${deleteResult.rowCount} existing estimate records`);
    
    const totalsByType = { AMOUNT: 0, KGS: 0, MORM: 0 };
    
    dimensionResult.rows.forEach(row => {
      const valuesType = row.values_type;
      if (totalsByType[valuesType] !== undefined) {
        totalsByType[valuesType] += parseFloat(row.total_value) || 0;
      }
    });
    
    logger.info(`📊 Base period totals by values_type:`, totalsByType);
    
    let totalInserted = 0;
    const batchSize = 500;
    
    for (const month of months) {
      const monthEstimates = estimates[month];
      const recordsForMonth = [];
      
      dimensionResult.rows.forEach(row => {
        const basePeriodTotal = totalsByType[row.values_type];
        const dimensionTotal = parseFloat(row.total_value) || 0;
        const monthlyEstimateTotal = row.values_type === 'AMOUNT' ? monthEstimates.amount :
                                     row.values_type === 'KGS' ? monthEstimates.kgs :
                                     monthEstimates.morm;
        
        const proportion = basePeriodTotal > 0 ? dimensionTotal / basePeriodTotal : 0;
        const dimensionMonthlyValue = monthlyEstimateTotal * proportion;
        
        recordsForMonth.push({
          division: division.toUpperCase(),
          year, month, type: 'Estimate',
          salesrepname: row.salesrepname, customername: row.customername,
          countryname: row.countryname, productgroup: row.productgroup,
          material: row.material, process: row.process,
          sourcesheet: 'Calculated', values_type: row.values_type,
          values: dimensionMonthlyValue, uploaded_by: approvedBy
        });
      });
      
      for (let i = 0; i < recordsForMonth.length; i += batchSize) {
        const batch = recordsForMonth.slice(i, i + batchSize);
        
        const insertQuery = `
          INSERT INTO public.${tables.dataExcel} (
            division, year, month, type, salesrepname, customername, countryname,
            productgroup, material, process, sourcesheet, values_type, values, uploaded_by, updated_at
          ) VALUES ${batch.map((_, idx) => {
            const base = idx * 14;
            return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7}, $${base + 8}, $${base + 9}, $${base + 10}, $${base + 11}, $${base + 12}, $${base + 13}, $${base + 14}, NOW())`;
          }).join(', ')}
        `;
        
        const insertValues = batch.flatMap(record => [
          record.division, record.year, record.month, record.type,
          record.salesrepname, record.customername, record.countryname,
          record.productgroup, record.material, record.process,
          record.sourcesheet, record.values_type, record.values, record.uploaded_by
        ]);
        
        const insertResult = await client.query(insertQuery, insertValues);
        totalInserted += insertResult.rowCount;
      }
      
      logger.info(`✅ Inserted ${recordsForMonth.length} records for month ${month}`);
    }
    
    await client.query('COMMIT');
    
    logger.info(`✅ Total inserted: ${totalInserted} estimate records`);
    
    successResponse(res, {
      recordsInserted: totalInserted,
      months,
      message: `Successfully saved estimates for ${months.length} months`
    });
    
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}));

/**
 * GET /budget-years
 * Get available budget years from sales_rep_budget table
 * 
 * @route GET /api/aebf/budget-years
 * @query {string} division - Division (FP or HC)
 * @returns {object} 200 - Available budget years
 */
router.get('/budget-years', queryLimiter, cacheMiddleware({ ttl: CacheTTL.VERY_LONG }), validationRules.getBudgetYears, asyncHandler(async (req, res) => {
  const { division } = req.query;
    
    const divisionPool = getPoolForDivision(division);
    const tables = getTableNames(division);
    
    const query = `
      SELECT DISTINCT budget_year
      FROM ${tables.salesRepBudget}
      WHERE UPPER(division) = UPPER($1) AND UPPER(type) = 'BUDGET'
      ORDER BY budget_year DESC
    `;
    
    const result = await divisionPool.query(query, [division]);
    const years = result.rows.map(row => row.budget_year);
    
    // Return in legacy format (not using successResponse wrapper)
    res.json({ success: true, years });
}));

/**
 * POST /budget-sales-rep-recap
 * Get sales rep budget recap with totals by value type
 * 
 * @route POST /api/aebf/budget-sales-rep-recap
 * @body {string} division - Division (FP or HC)
 * @body {number} budgetYear - Budget year
 * @body {string} salesRep - Sales rep name
 * @returns {object} 200 - Budget recap with Amount, KGS, and MoRM totals
 */
router.post('/budget-sales-rep-recap', queryLimiter, validationRules.budgetSalesRepRecap, asyncHandler(async (req, res) => {
  const { division, budgetYear, salesRep } = req.body;
    
    const divisionPool = getPoolForDivision(division);
    const tables = getTableNames(division);
    
    const query = `
      SELECT 
        values_type,
        SUM(values) as total_values,
        COUNT(*) as record_count
      FROM ${tables.salesRepBudget}
      WHERE UPPER(division) = UPPER($1)
        AND budget_year = $2
        AND UPPER(TRIM(salesrepname)) = UPPER(TRIM($3))
        AND UPPER(type) = 'BUDGET'
        AND values_type IN ('Amount', 'KGS', 'MoRM')
      GROUP BY values_type
      ORDER BY 
        CASE values_type
          WHEN 'Amount' THEN 1
          WHEN 'KGS' THEN 2
          WHEN 'MoRM' THEN 3
        END
    `;
    
    const result = await divisionPool.query(query, [division, parseInt(budgetYear), salesRep]);
    
    // Build recap in legacy format (array of objects with values_type, total_values, record_count)
    const recapMap = {
      'Amount': { values_type: 'Amount', total_values: 0, record_count: 0 },
      'KGS': { values_type: 'KGS', total_values: 0, record_count: 0 },
      'MoRM': { values_type: 'MoRM', total_values: 0, record_count: 0 }
    };
    
    result.rows.forEach(row => {
      recapMap[row.values_type] = {
        values_type: row.values_type,
        total_values: parseFloat(row.total_values) || 0,
        record_count: parseInt(row.record_count) || 0
      };
    });
    
    const recap = [
      recapMap['Amount'],
      recapMap['KGS'],
      recapMap['MoRM']
    ];
    
    // Return in legacy format (not using successResponse wrapper)
    res.json({
      success: true,
      recap,
      salesRep,
      budgetYear: parseInt(budgetYear)
    });
}));

module.exports = router;
