/**
 * @fileoverview AEBF Actual Data Routes
 * @module routes/aebf/actual
 * @description Handles all actual data operations including retrieval, upload, analysis, and export
 * 
 * @requires express
 * @requires multer File upload middleware for Excel files
 * @requires child_process For PowerShell script execution
 * 
 * @routes
 * - GET  /actual                 - Retrieve paginated actual data with comprehensive filters
 * - GET  /summary                - Get summary statistics by type and values_type
 * - GET  /year-summary           - Get year-specific summary with search
 * - GET  /filter-options         - Get all unique filter values
 * - GET  /distinct/:field        - Get distinct values for specific field
 * - GET  /export                 - Export data to CSV (max 10,000 records)
 * - GET  /available-months       - Get available actual months for estimation
 * - POST /upload-actual          - Upload Excel file via PowerShell processing
 * - POST /analyze-file           - Analyze Excel file to extract year/month combinations
 * 
 * @features
 * - Month name recognition (JANUARY/JAN → 1)
 * - Multi-field search with intelligent matching
 * - PowerShell integration for Excel processing
 * - Selective year/month upload support
 * - CSV export with comprehensive filtering
 * - Real-time file analysis
 * 
 * @validation All routes use express-validator middleware
 * @errorHandling Centralized error handler with standardized responses
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const logger = require('../../utils/logger');
const { getPoolForDivision, getTableNames, extractDivisionCode } = require('./shared');
const { asyncHandler, ErrorCreators, successResponse } = require('../../middleware/aebfErrorHandler');
const validationRules = require('../../middleware/aebfValidation');
const { queryLimiter, uploadLimiter, exportLimiter } = require('../../middleware/rateLimiter');
const { cacheMiddleware, CacheTTL, invalidateCache } = require('../../middleware/cache');
const { paginationHelper, buildPaginationSQL, buildPaginationMeta } = require('../../middleware/pagination');

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
    cb(null, `aebf-upload-${timestamp}${ext}`);
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
 * GET /actual
 * Retrieve actual data with comprehensive filtering and pagination
 * 
 * @route GET /api/aebf/actual
 * @query {string} division - Division (FP or HC)
 * @query {number} [page=1] - Page number
 * @query {number} [pageSize=100] - Records per page (max 1000)
 * @query {number} [year] - Filter by year
 * @query {number} [month] - Filter by month
 * @query {string} [values_type] - Filter by values type (AMOUNT, KGS, MORM)
 * @query {string} [salesrepname] - Filter by sales rep
 * @query {string} [customername] - Filter by customer
 * @query {string} [countryname] - Filter by country
 * @query {string} [productgroup] - Filter by product group
 * @query {string} [sortBy=year] - Sort field
 * @query {string} [sortOrder=desc] - Sort direction (asc/desc)
 * @query {string} [search] - Search term
 * @query {string} [types] - Comma-separated types to filter
 * @returns {object} 200 - Paginated actual data
 */
router.get('/actual', 
  queryLimiter, 
  cacheMiddleware({ ttl: CacheTTL.MEDIUM }), 
  paginationHelper,
  validationRules.getActual, 
  asyncHandler(async (req, res) => {
  const {
    division,
    page = 1,
    pageSize = 100,
    year,
    month,
    values_type,
    salesrepname,
    customername,
    countryname,
    productgroup,
    sortBy = 'year',
    sortOrder = 'desc',
    search,
    types
  } = req.query;
    
    const limit = Math.min(parseInt(pageSize) || 100, 1000);
    const offset = (parseInt(page) - 1) * limit;
    
    const conditions = ['UPPER(division) = $1'];
    const params = [division.toUpperCase()];
    let paramIndex = 2;
    
    // Handle type or types parameter
    if (types) {
      const typeArray = types.split(',').map(t => t.trim().toUpperCase());
      const typePlaceholders = typeArray.map((_, idx) => `$${paramIndex + idx}`).join(', ');
      conditions.push(`UPPER(type) IN (${typePlaceholders})`);
      params.push(...typeArray);
      paramIndex += typeArray.length;
    } else {
      conditions.push("UPPER(type) = 'ACTUAL'");
    }
    
    if (year) {
      conditions.push(`year = $${paramIndex}`);
      params.push(parseInt(year));
      paramIndex++;
    }
    
    if (month) {
      conditions.push(`month = $${paramIndex}`);
      params.push(parseInt(month));
      paramIndex++;
    }
    
    if (values_type) {
      conditions.push(`UPPER(values_type) = $${paramIndex}`);
      params.push(values_type.toUpperCase());
      paramIndex++;
    }
    
    if (salesrepname) {
      conditions.push(`UPPER(salesrepname) = $${paramIndex}`);
      params.push(salesrepname.toUpperCase());
      paramIndex++;
    }
    
    if (customername) {
      conditions.push(`UPPER(customername) LIKE $${paramIndex}`);
      params.push(`%${customername.toUpperCase()}%`);
      paramIndex++;
    }
    
    if (countryname) {
      conditions.push(`UPPER(countryname) = $${paramIndex}`);
      params.push(countryname.toUpperCase());
      paramIndex++;
    }
    
    if (productgroup) {
      conditions.push(`UPPER(productgroup) LIKE $${paramIndex}`);
      params.push(`%${productgroup.toUpperCase()}%`);
      paramIndex++;
    }
    
    // Global search with month name recognition
    if (search) {
      const searchUpper = search.toUpperCase().trim();
      const searchPattern = `%${searchUpper}%`;
      
      const monthMap = {
        'JANUARY': 1, 'JAN': 1,
        'FEBRUARY': 2, 'FEB': 2,
        'MARCH': 3, 'MAR': 3,
        'APRIL': 4, 'APR': 4,
        'MAY': 5,
        'JUNE': 6, 'JUN': 6,
        'JULY': 7, 'JUL': 7,
        'AUGUST': 8, 'AUG': 8,
        'SEPTEMBER': 9, 'SEP': 9, 'SEPT': 9,
        'OCTOBER': 10, 'OCT': 10,
        'NOVEMBER': 11, 'NOV': 11,
        'DECEMBER': 12, 'DEC': 12
      };
      
      const monthNumber = monthMap[searchUpper];
      
      if (monthNumber) {
        conditions.push(`month = $${paramIndex}`);
        params.push(monthNumber);
      } else {
        conditions.push(`(
          UPPER(customername) LIKE $${paramIndex} OR 
          UPPER(countryname) LIKE $${paramIndex} OR 
          UPPER(productgroup) LIKE $${paramIndex} OR
          UPPER(salesrepname) LIKE $${paramIndex} OR
          UPPER(material) LIKE $${paramIndex}
        )`);
        params.push(searchPattern);
      }
      paramIndex++;
    }
    
    const whereClause = conditions.join(' AND ');
    
    const validSortFields = ['year', 'month', 'values', 'customername', 'countryname', 'productgroup', 'salesrepname', 'values_type'];
    const sortField = validSortFields.includes(sortBy) ? sortBy : 'year';
    const sortDirection = sortOrder.toLowerCase() === 'asc' ? 'ASC' : 'DESC';
    const orderByClause = `ORDER BY ${sortField} ${sortDirection}, id DESC`;
    
    const divisionPool = getPoolForDivision(division);
    const tables = getTableNames(division);
    
    const countQuery = `
      SELECT COUNT(*) as total
      FROM public.${tables.dataExcel}
      WHERE ${whereClause}
    `;
    const countResult = await divisionPool.query(countQuery, params);
    const total = parseInt(countResult.rows[0].total);
    
    const dataQuery = `
      SELECT 
        id, division, year, month, type, salesrepname, customername,
        countryname, productgroup, material, process, values_type, values,
        updated_at, uploaded_by, sourcesheet
      FROM public.${tables.dataExcel}
      WHERE ${whereClause}
      ${orderByClause}
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    params.push(limit, offset);
    
    const dataResult = await divisionPool.query(dataQuery, params);
    
    const appliedFilters = { division };
    if (year) appliedFilters.year = year;
    if (month) appliedFilters.month = month;
    if (values_type) appliedFilters.values_type = values_type;
    if (salesrepname) appliedFilters.salesrepname = salesrepname;
    if (customername) appliedFilters.customername = customername;
    if (countryname) appliedFilters.countryname = countryname;
    if (productgroup) appliedFilters.productgroup = productgroup;
    if (search) appliedFilters.search = search;
    if (sortBy) appliedFilters.sortBy = sortBy;
    if (sortOrder) appliedFilters.sortOrder = sortOrder;
  
  successResponse(res, {
    data: dataResult.rows,
    pagination: {
      total,
      page: parseInt(page),
      pageSize: limit,
      totalPages: Math.ceil(total / limit)
    },
    filters: appliedFilters
  });
}));

/**
 * GET /summary
 * Get summary statistics aggregated by type and values_type
 * 
 * @route GET /api/aebf/summary
 * @query {string} division - Division (FP or HC)
 * @query {string} [type] - Filter by type
 * @returns {object} 200 - Summary statistics
 */
router.get('/summary', queryLimiter, cacheMiddleware({ ttl: CacheTTL.MEDIUM }), validationRules.getSummary, asyncHandler(async (req, res) => {
  const { division, type } = req.query;
  
  const conditions = ['UPPER(division) = $1'];
  const params = [division.toUpperCase()];
  
  if (type) {
    conditions.push("UPPER(type) = $2");
    params.push(type.toUpperCase());
  }
  
  const whereClause = conditions.join(' AND ');
  const divisionPool = getPoolForDivision(division);
  const tables = getTableNames(division);
  
  const summaryQuery = `
    SELECT 
      type,
      values_type,
      COUNT(*) as record_count,
      SUM(values) as total_values,
      AVG(values) as avg_values,
      MIN(values) as min_values,
      MAX(values) as max_values
    FROM public.${tables.dataExcel}
    WHERE ${whereClause}
    GROUP BY type, values_type
    ORDER BY values_type
  `;
  
  const result = await divisionPool.query(summaryQuery, params);
  
  successResponse(res, { summary: result.rows });
}));

/**
 * GET /year-summary
 * Get year-specific summary statistics with optional search
 * 
 * @route GET /api/aebf/year-summary
 * @query {string} division - Division (FP or HC)
 * @query {string} [type] - Filter by type
 * @query {number} [year] - Filter by year
 * @query {string} [search] - Search term
 * @returns {object} 200 - Year-specific summary
 */
router.get('/year-summary', queryLimiter, cacheMiddleware({ ttl: CacheTTL.MEDIUM }), validationRules.getYearSummary, asyncHandler(async (req, res) => {
  const { division, type, types, year, search } = req.query;
  
  let whereClause = `WHERE UPPER(division) = $1`;
  const queryParams = [division.toUpperCase()];
  let paramIndex = 2;
  
  if (types) {
    const typeArray = types.split(',').map(t => t.trim().toUpperCase());
    const typePlaceholders = typeArray.map((_, idx) => `$${paramIndex + idx}`).join(', ');
    whereClause += ` AND UPPER(type) IN (${typePlaceholders})`;
    queryParams.push(...typeArray);
    paramIndex += typeArray.length;
  } else if (type) {
    whereClause += ` AND UPPER(type) = $${paramIndex}`;
    queryParams.push(type.toUpperCase());
    paramIndex++;
  }
  
  if (year) {
    whereClause += ` AND year = $${paramIndex}`;
    queryParams.push(parseInt(year));
    paramIndex++;
  }
  
  if (search && search.trim()) {
    const searchPattern = `%${search.trim().toUpperCase()}%`;
    whereClause += ` AND (
      UPPER(customername) LIKE $${paramIndex} OR
      UPPER(countryname) LIKE $${paramIndex} OR
      UPPER(productgroup) LIKE $${paramIndex} OR
      UPPER(salesrepname) LIKE $${paramIndex} OR
      UPPER(material) LIKE $${paramIndex}
    )`;
    queryParams.push(searchPattern);
  }
  
  const summaryQuery = `
    SELECT 
      values_type,
      COUNT(*) as record_count,
      SUM(values) as total_values,
      AVG(values) as avg_values,
      MIN(values) as min_values,
      MAX(values) as max_values
    FROM public.${getTableNames(division).dataExcel}
    ${whereClause}
    GROUP BY values_type
    ORDER BY values_type
  `;
  
  const result = await getPoolForDivision(division).query(summaryQuery, queryParams);
  
  successResponse(res, { summary: result.rows });
}));

/**
 * GET /filter-options
 * Get all unique values for filterable columns
 * 
 * @route GET /api/aebf/filter-options
 * @query {string} division - Division (FP or HC)
 * @query {string} [type] - Filter by type
 * @returns {object} 200 - Filter options with all unique values
 */
router.get('/filter-options', queryLimiter, cacheMiddleware({ ttl: CacheTTL.LONG }), validationRules.getFilterOptions, asyncHandler(async (req, res) => {
  const { division, type } = req.query;
  
  const conditions = ['UPPER(division) = $1'];
  const params = [division.toUpperCase()];
  
  if (type) {
    conditions.push("UPPER(type) = $2");
    params.push(type.toUpperCase());
  }
  
  const whereClause = conditions.join(' AND ');
  const divisionPool = getPoolForDivision(division);
  const tables = getTableNames(division);
  
  const filterOptionsQuery = `
    SELECT 
      ARRAY_AGG(DISTINCT year ORDER BY year) FILTER (WHERE year IS NOT NULL) as years,
      ARRAY_AGG(DISTINCT month ORDER BY month) FILTER (WHERE month IS NOT NULL) as months,
      ARRAY_AGG(DISTINCT salesrepname ORDER BY salesrepname) FILTER (WHERE salesrepname IS NOT NULL) as salesreps,
      ARRAY_AGG(DISTINCT customername ORDER BY customername) FILTER (WHERE customername IS NOT NULL) as customers,
      ARRAY_AGG(DISTINCT countryname ORDER BY countryname) FILTER (WHERE countryname IS NOT NULL) as countries,
      ARRAY_AGG(DISTINCT productgroup ORDER BY productgroup) FILTER (WHERE productgroup IS NOT NULL) as productgroups,
      ARRAY_AGG(DISTINCT material ORDER BY material) FILTER (WHERE material IS NOT NULL) as materials,
      ARRAY_AGG(DISTINCT values_type ORDER BY values_type) FILTER (WHERE values_type IS NOT NULL) as valuetypes
    FROM public.${tables.dataExcel}
    WHERE ${whereClause}
  `;
  
  const result = await divisionPool.query(filterOptionsQuery, params);
  const row = result.rows[0];
  
  const filterOptions = {
    year: row.years || [],
    month: row.months || [],
    salesrepname: row.salesreps || [],
    customername: row.customers || [],
    countryname: row.countries || [],
    productgroup: row.productgroups || [],
    material: row.materials || [],
    values_type: row.valuetypes || []
  };
  
  successResponse(res, { filterOptions });
}));

/**
 * GET /distinct/:field
 * Get distinct values for a specific field
 * 
 * @route GET /api/aebf/distinct/:field
 * @param {string} field - Field name to get distinct values for
 * @query {string} division - Division (FP or HC)
 * @query {string} [type] - Filter by type
 * @returns {object} 200 - Distinct values for the field
 */
router.get('/distinct/:field', queryLimiter, cacheMiddleware({ ttl: CacheTTL.LONG }), validationRules.getDistinct, asyncHandler(async (req, res) => {
  const { field } = req.params;
  const { division, type } = req.query;
  
  const conditions = ['UPPER(division) = $1'];
  const params = [division.toUpperCase()];
  
  if (type) {
    conditions.push("UPPER(type) = $2");
    params.push(type.toUpperCase());
  }
  
  const whereClause = conditions.join(' AND ');
  const divisionPool = getPoolForDivision(division);
  const tables = getTableNames(division);
  
  const distinctQuery = `
    SELECT DISTINCT ${field}
    FROM public.${tables.dataExcel}
    WHERE ${whereClause} AND ${field} IS NOT NULL
    ORDER BY ${field}
  `;
  
  const result = await divisionPool.query(distinctQuery, params);
  
  successResponse(res, {
    field,
    values: result.rows.map(row => row[field])
  });
}));

/**
 * GET /export
 * Export actual data in CSV format (max 10,000 records)
 * 
 * @route GET /api/aebf/export
 * @query {string} division - Division (FP or HC)
 * @query {number} [year] - Filter by year
 * @query {number} [month] - Filter by month
 * @query {string} [values_type] - Filter by value type
 * @query {string} [types] - Comma-separated types filter
 * @query {string} [search] - Search across multiple fields
 * @query {string} [sortBy=year] - Field to sort by
 * @query {string} [sortOrder=desc] - Sort direction
 * @returns {file} 200 - CSV file download
 */
router.get('/export', exportLimiter, validationRules.exportData, asyncHandler(async (req, res) => {
  const {
    division, year, month, values_type, salesrepname, customername,
    countryname, productgroup, sortBy = 'year', sortOrder = 'desc',
    search, types
  } = req.query;
    
    const conditions = ['UPPER(division) = $1'];
    const params = [division.toUpperCase()];
    let paramIndex = 2;
    
    if (types) {
      const typeArray = types.split(',').map(t => t.trim().toUpperCase());
      const typePlaceholders = typeArray.map((_, idx) => `$${paramIndex + idx}`).join(', ');
      conditions.push(`UPPER(type) IN (${typePlaceholders})`);
      params.push(...typeArray);
      paramIndex += typeArray.length;
    } else {
      conditions.push("UPPER(type) = 'ACTUAL'");
    }
    
    if (year) {
      conditions.push(`year = $${paramIndex}`);
      params.push(parseInt(year));
      paramIndex++;
    }
    
    if (month) {
      conditions.push(`month = $${paramIndex}`);
      params.push(parseInt(month));
      paramIndex++;
    }
    
    if (values_type) {
      conditions.push(`UPPER(values_type) = $${paramIndex}`);
      params.push(values_type.toUpperCase());
      paramIndex++;
    }
    
    if (salesrepname) {
      conditions.push(`UPPER(salesrepname) = $${paramIndex}`);
      params.push(salesrepname.toUpperCase());
      paramIndex++;
    }
    
    if (customername) {
      conditions.push(`UPPER(customername) LIKE $${paramIndex}`);
      params.push(`%${customername.toUpperCase()}%`);
      paramIndex++;
    }
    
    if (countryname) {
      conditions.push(`UPPER(countryname) = $${paramIndex}`);
      params.push(countryname.toUpperCase());
      paramIndex++;
    }
    
    if (productgroup) {
      conditions.push(`UPPER(productgroup) LIKE $${paramIndex}`);
      params.push(`%${productgroup.toUpperCase()}%`);
      paramIndex++;
    }
    
    if (search) {
      const searchUpper = search.toUpperCase().trim();
      const searchPattern = `%${searchUpper}%`;
      
      const monthMap = {
        'JANUARY': 1, 'JAN': 1, 'FEBRUARY': 2, 'FEB': 2, 'MARCH': 3, 'MAR': 3,
        'APRIL': 4, 'APR': 4, 'MAY': 5, 'JUNE': 6, 'JUN': 6, 'JULY': 7, 'JUL': 7,
        'AUGUST': 8, 'AUG': 8, 'SEPTEMBER': 9, 'SEP': 9, 'SEPT': 9,
        'OCTOBER': 10, 'OCT': 10, 'NOVEMBER': 11, 'NOV': 11, 'DECEMBER': 12, 'DEC': 12
      };
      
      const monthNumber = monthMap[searchUpper];
      
      if (monthNumber) {
        conditions.push(`month = $${paramIndex}`);
        params.push(monthNumber);
      } else {
        conditions.push(`(
          UPPER(customername) LIKE $${paramIndex} OR 
          UPPER(countryname) LIKE $${paramIndex} OR 
          UPPER(productgroup) LIKE $${paramIndex} OR
          UPPER(salesrepname) LIKE $${paramIndex} OR
          UPPER(material) LIKE $${paramIndex}
        )`);
        params.push(searchPattern);
      }
      paramIndex++;
    }
    
    const whereClause = conditions.join(' AND ');
    
    const validSortFields = ['year', 'month', 'values', 'customername', 'countryname', 'productgroup', 'salesrepname', 'values_type'];
    const sortField = validSortFields.includes(sortBy) ? sortBy : 'year';
    const sortDirection = sortOrder.toLowerCase() === 'asc' ? 'ASC' : 'DESC';
    const orderByClause = `ORDER BY ${sortField} ${sortDirection}, id DESC`;
    
    const divisionPool = getPoolForDivision(division);
    const tables = getTableNames(division);
    
    const exportQuery = `
      SELECT 
        division, year, month, type, salesrepname, customername,
        countryname, productgroup, material, process, values_type, values,
        updated_at, uploaded_by, sourcesheet
      FROM public.${tables.dataExcel}
      WHERE ${whereClause}
      ${orderByClause}
      LIMIT 10000
    `;
    
    const result = await divisionPool.query(exportQuery, params);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'No data found for export'
      });
    }
    
    const headers = Object.keys(result.rows[0]);
    const csvRows = [
      headers.join(','),
      ...result.rows.map(row => 
        headers.map(header => {
          const value = row[header];
          if (value === null || value === undefined) return '';
          const stringValue = String(value);
          if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
            return `"${stringValue.replace(/"/g, '""')}"`;
          }
          return stringValue;
        }).join(',')
      )
    ];
    
    const csv = csvRows.join('\n');
    
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
    const timeStr = now.toTimeString().slice(0, 8).replace(/:/g, '');
    const dateTime = `${dateStr}-${timeStr}`;
    
    let typeLabel = 'Data';
    if (types) {
      const typeArray = types.split(',').map(t => t.trim());
      typeLabel = typeArray.length === 1 ? typeArray[0] : 'Multi';
    }
    
    let filename = `AEBF-${typeLabel}-${division.toUpperCase()}`;
    if (year) filename += `-${year}`;
    filename += `-${dateTime}.csv`;
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
}));

/**
 * POST /upload-actual
 * Upload actual data Excel file and process via PowerShell script
 * 
 * @route POST /api/aebf/upload-actual
 * @body {string} division - Division (FP or HC)
 * @body {string} uploadMode - Upload mode (upsert or replace)
 * @body {string} uploadedBy - User performing the upload
 * @body {string} [selectiveMode] - Enable selective year/month upload
 * @body {string} [selectedYearMonths] - JSON array of selected year-month combinations
 * @file {file} file - Excel file to upload
 * @returns {object} 200 - Upload success with processing details
 */
router.post('/upload-actual', uploadLimiter, upload.single('file'), validationRules.uploadActual, asyncHandler(async (req, res) => {
  const { division, uploadMode, uploadedBy } = req.body;
  const filePath = req.file.path;
  
  logger.info('📤 Upload request received:', {
    division,
    uploadMode,
    uploadedBy,
    fileName: req.file.originalname,
    fileSize: req.file.size
  });
    
    const scriptPath = path.join(__dirname, '../../../scripts/transform-actual-to-sql.ps1');
    
    if (!fs.existsSync(scriptPath)) {
      return res.status(500).json({
        success: false,
        error: 'Transform script not found'
      });
    }
    
    logger.info('🔄 Executing PowerShell script...');
    
    const psArgs = [
      '-ExecutionPolicy', 'Bypass',
      '-File', scriptPath,
      '-ExcelPath', filePath,
      '-Division', division.toUpperCase(),
      '-UploadMode', uploadMode.toLowerCase(),
      '-UploadedBy', uploadedBy
    ];
    
    if (req.body.selectiveMode === 'true' && req.body.selectedYearMonths) {
      const selectedYearMonths = JSON.parse(req.body.selectedYearMonths);
      psArgs.push('-SelectiveYearMonths', selectedYearMonths.join(','));
      logger.info('📅 Selective mode enabled:', selectedYearMonths);
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
      const error = data.toString();
      stderr += error;
      logger.error(error);
    });
    
    psProcess.on('close', (code) => {
      logger.info(`PowerShell script exited with code ${code}`);
      
      try {
        fs.unlinkSync(filePath);
        logger.info('✅ Cleaned up uploaded file');
      } catch (err) {
        logger.error('⚠️  Failed to clean up file:', err);
      }
      
      if (code === 0) {
        const recordsMatch = stdout.match(/Total records processed: (\d+)/);
        const recordsAffected = recordsMatch ? parseInt(recordsMatch[1]) : 0;
        
        // Invalidate cache after successful upload
        invalidateCache('aebf:*').catch(err => 
          logger.warn('Cache invalidation warning:', err.message)
        );
        
        res.json({
          success: true,
          message: 'Upload completed successfully',
          division: division.toUpperCase(),
          uploadMode,
          uploadedBy,
          recordsAffected,
          output: stdout,
          logFile: stdout.match(/Log file: (.+)/)?.[1]
        });
      } else {
        res.status(500).json({
          success: false,
          error: 'PowerShell script failed',
          details: stderr || stdout,
          exitCode: code
        });
      }
    });
    
    psProcess.on('error', (error) => {
      logger.error('❌ Failed to start PowerShell script:', error);
      
      try {
        fs.unlinkSync(filePath);
      } catch (err) {
        logger.error('Failed to clean up file:', err);
      }
      
      res.status(500).json({
        success: false,
        error: 'Failed to execute transform script',
        details: error.message
      });
    });
}));

/**
 * POST /analyze-file
 * Analyze Excel file to extract year/month combinations before upload
 * 
 * @route POST /api/aebf/analyze-file
 * @file {file} file - Excel file to analyze
 * @returns {object} 200 - Year/month combinations with record counts
 */
router.post('/analyze-file', uploadLimiter, upload.single('file'), validationRules.analyzeFile, asyncHandler(async (req, res) => {
  if (!req.file) {
    throw ErrorCreators.validationError('No file uploaded');
  }
  
  const filePath = req.file.path;
  logger.info('📊 Analyzing file:', filePath);
  
  const XLSX = require('xlsx');
  const workbook = XLSX.readFile(filePath);
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
  const data = XLSX.utils.sheet_to_json(firstSheet);
    
    const yearMonthMap = new Map();
    
    data.forEach(row => {
      if (row.year && row.month && row.customername) {
        const key = `${row.year}-${row.month}`;
        if (yearMonthMap.has(key)) {
          yearMonthMap.set(key, yearMonthMap.get(key) + 1);
        } else {
          yearMonthMap.set(key, 1);
        }
      }
    });
    
    const yearMonths = Array.from(yearMonthMap.entries())
      .map(([key, count]) => {
        const [year, month] = key.split('-').map(Number);
        return { year, month, count };
      })
      .sort((a, b) => {
        if (a.year !== b.year) return a.year - b.year;
        return a.month - b.month;
      });
    
    try {
      fs.unlinkSync(filePath);
    } catch (err) {
      logger.error('Failed to clean up file:', err);
    }
    
    successResponse(res, {
      yearMonths,
      totalRecords: data.length,
      totalPeriods: yearMonths.length
    });
}));

/**
 * GET /available-months
 * Get available actual months for estimation purposes
 * 
 * @route GET /api/aebf/available-months
 * @query {string} division - Division (FP or HC)
 * @query {number} year - Year to get months for
 * @returns {object} 200 - Available months array
 */
router.get('/available-months', queryLimiter, cacheMiddleware({ ttl: CacheTTL.LONG }), validationRules.getAvailableMonths, asyncHandler(async (req, res) => {
  const { division, year } = req.query;
  
  logger.info('📅 Get available months request:', { division, year });
  
  const divisionPool = getPoolForDivision(division);
  const tables = getTableNames(division);
  
  const query = `
    SELECT DISTINCT month
    FROM public.${tables.dataExcel}
    WHERE UPPER(division) = $1 AND UPPER(type) = 'ACTUAL' AND year = $2
    ORDER BY month
  `;
  
  const result = await divisionPool.query(query, [division.toUpperCase(), parseInt(year)]);
  const months = result.rows.map(row => row.month);
  
  logger.info(`✅ Found ${months.length} Actual months:`, months);
  
  successResponse(res, { months });
}));

module.exports = router;
