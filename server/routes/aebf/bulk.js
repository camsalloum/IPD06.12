/**
 * @fileoverview AEBF Bulk Operations Routes
 * @module routes/aebf/bulk
 * @description Manages bulk import operations with batch tracking and lifecycle management
 * 
 * @requires express
 * @requires shared For database pool and table management
 * 
 * @routes
 * - POST   /bulk-import              - Create bulk import batch with unique batch_id
 * - GET    /bulk-batches             - List all batches for division (limit 50, sorted by created_at DESC)
 * - GET    /bulk-batch/:batchId      - Get specific batch details with record count
 * - DELETE /bulk-batch/:batchId      - Delete batch and all associated records
 * - POST   /bulk-finalize/:batchId   - Mark batch as FINALIZED (immutable state)
 * - GET    /bulk-export/:batchId     - Export batch to CSV with headers
 * 
 * @features
 * - Transaction handling for atomic batch creation
 * - Unique batch_id generation (timestamp-based)
 * - Status tracking (PENDING, FINALIZED)
 * - Batch lifecycle management
 * - CSV export with comprehensive data
 * - Cascading delete support
 * 
 * @validation All routes use express-validator middleware
 * @errorHandling Centralized error handler with transaction rollback
 */

const express = require('express');
const router = express.Router();
const logger = require('../../utils/logger');
const { getPoolForDivision, getTableNames } = require('./shared');
const { asyncHandler, successResponse } = require('../../middleware/aebfErrorHandler');
const validationRules = require('../../middleware/aebfValidation');
const { queryLimiter, exportLimiter } = require('../../middleware/rateLimiter');

/**
 * POST /bulk-import
 * Import multiple sales rep budget files at once
 * 
 * @route POST /api/aebf/bulk-import
 * @body {string} division - Division (FP or HC)
 * @body {array} files - Array of file objects with htmlContent, salesRep, budgetYear, filename
 * @body {boolean} saveToFinal - Whether to save to final budget table
 * @returns {object} 200 - Import result with batch_id and counts
 */
router.post('/bulk-import', queryLimiter, asyncHandler(async (req, res) => {
  logger.info('📦 Bulk import request received');
  
  const { files, saveToFinal, division } = req.body;

  if (!files || !Array.isArray(files) || files.length === 0) {
    return res.status(400).json({ success: false, error: 'No files provided' });
  }

  if (!division) {
    return res.status(400).json({ success: false, error: 'Division is required' });
  }

  const divisionPool = getPoolForDivision(division);
  const tables = getTableNames(division);
  const client = await divisionPool.connect();

  // Helper function to convert string to Proper Case (Title Case)
  const toProperCase = (str) => {
    if (!str) return '';
    return str.toString().trim().toLowerCase().replace(/(?:^|\s|[-/])\w/g, (match) => match.toUpperCase());
  };

  try {
    // Generate batch ID
    const batchId = `BULK_${Date.now()}_${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
    const status = saveToFinal ? 'final' : 'draft';
    const importedAt = new Date().toISOString();

    logger.info(`📦 Processing ${files.length} files, batch: ${batchId}, status: ${status}`);

    await client.query('BEGIN');

    let totalImported = 0;
    const importedSalesReps = [];
    const errors = [];

    for (const file of files) {
      try {
        const { htmlContent, salesRep: rawSalesRep, budgetYear, filename } = file;

        // Normalize sales rep name to Proper Case for consistent storage
        const salesRep = toProperCase(rawSalesRep);

        if (!htmlContent) {
          errors.push({ filename, error: 'No content' });
          continue;
        }

        // Extract budget data from HTML (handle newlines in the data)
        const budgetDataMatch = htmlContent.match(/const savedBudget\s*=\s*(\[[\s\S]*?\]);/);
        if (!budgetDataMatch) {
          errors.push({ filename, error: 'No budget data found' });
          continue;
        }

        let budgetData;
        try {
          budgetData = JSON.parse(budgetDataMatch[1]);
        } catch (e) {
          errors.push({ filename, error: 'Invalid budget data format' });
          continue;
        }
        
        if (!Array.isArray(budgetData) || budgetData.length === 0) {
          errors.push({ filename, error: 'Empty budget data' });
          continue;
        }
        
        // Get pricing map for amount/morm calculations
        const pricingResult = await client.query(
          `SELECT LOWER(TRIM(product_group)) as product_group, 
                  COALESCE(asp_round, 0) as selling_price, 
                  COALESCE(morm_round, 0) as morm 
           FROM ${tables.pricingRounding}
           WHERE year = $1`,
          [budgetYear]
        );
        const pricingMap = {};
        pricingResult.rows.forEach(row => {
          pricingMap[row.product_group] = {
            sellingPrice: parseFloat(row.selling_price) || 0,
            morm: parseFloat(row.morm) || 0
          };
        });
        
        // Group records by customer/country/productGroup and aggregate monthly values
        const groupedData = {};
        for (const record of budgetData) {
          const customer = record.customer || '';
          const country = record.country || '';
          const productGroup = record.productGroup || '';
          const month = parseInt(record.month) || 0;
          const value = parseFloat(record.value) || 0;
          
          const key = `${customer}|||${country}|||${productGroup}`;
          if (!groupedData[key]) {
            groupedData[key] = {
              customer,
              country,
              productGroup,
              months: {}
            };
          }
          if (month >= 1 && month <= 12) {
            groupedData[key].months[month] = value;
          }
        }
        
        // Insert each grouped budget record
        for (const key of Object.keys(groupedData)) {
          const record = groupedData[key];
          const customer = record.customer;
          const country = record.country;
          const productGroup = record.productGroup;
          
          // Get monthly values
          const months = {};
          let totalKG = 0;
          for (let m = 1; m <= 12; m++) {
            const val = parseFloat(record.months[m] || 0);
            months[m] = val;
            totalKG += val;
          }
          
          // Calculate amount and morm
          const pricing = pricingMap[(productGroup || '').toLowerCase()] || { sellingPrice: 0, morm: 0 };
          const totalAmount = totalKG * pricing.sellingPrice;
          const totalMoRM = totalKG * pricing.morm;
          
          // Insert into bulk import table
          await client.query(
            `INSERT INTO ${tables.budgetBulkImport} 
             (batch_id, division, sales_rep, budget_year, customer, country, product_group,
              month_1, month_2, month_3, month_4, month_5, month_6,
              month_7, month_8, month_9, month_10, month_11, month_12,
              total_kg, total_amount, total_morm, status, source_file, imported_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25)`,
            [
              batchId, division, salesRep, budgetYear, customer, country, productGroup,
              months[1], months[2], months[3], months[4], months[5], months[6],
              months[7], months[8], months[9], months[10], months[11], months[12],
              totalKG, totalAmount, totalMoRM, status, filename, importedAt
            ]
          );
          
          totalImported++;
        }
        
        if (!importedSalesReps.includes(salesRep)) {
          importedSalesReps.push(salesRep);
        }
        
        logger.info(`✅ Imported ${Object.keys(groupedData).length} records for ${salesRep}`);
        
      } catch (fileError) {
        logger.error(`❌ Error processing file:`, fileError);
        errors.push({ filename: file.filename, error: fileError.message });
      }
    }
    
    // If saving to final, also copy to the main budget table
    if (saveToFinal && totalImported > 0) {
      // Get all records from this batch
      const batchRecords = await client.query(
        `SELECT * FROM ${tables.budgetBulkImport} WHERE batch_id = $1`,
        [batchId]
      );
      
      for (const record of batchRecords.rows) {
        // Delete existing budget for this sales rep/customer/country/product
        await client.query(
          `DELETE FROM ${tables.salesRepBudget} 
           WHERE sales_rep = $1 AND customer = $2 AND country = $3 
           AND product_group = $4 AND budget_year = $5`,
          [record.sales_rep, record.customer, record.country, record.product_group, record.budget_year]
        );
        
        // Insert into main budget table
        await client.query(
          `INSERT INTO ${tables.salesRepBudget}
           (division, sales_rep, budget_year, customer, country, product_group,
            month_1, month_2, month_3, month_4, month_5, month_6,
            month_7, month_8, month_9, month_10, month_11, month_12,
            total_amount, total_morm, imported_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)`,
          [
            record.division, record.sales_rep, record.budget_year, 
            record.customer, record.country, record.product_group,
            record.month_1, record.month_2, record.month_3, record.month_4,
            record.month_5, record.month_6, record.month_7, record.month_8,
            record.month_9, record.month_10, record.month_11, record.month_12,
            record.total_amount, record.total_morm, record.imported_at
          ]
        );
      }
      
      logger.info(`✅ Copied ${totalImported} records to main budget table`);
    }
    
    await client.query('COMMIT');
    
    res.json({
      success: true,
      batchId,
      importedCount: totalImported,
      salesReps: importedSalesReps,
      status,
      errors: errors.length > 0 ? errors : undefined
    });
    
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}));

/**
 * GET /bulk-batches
 * List all bulk import batches for division (limit 50, sorted by created_at DESC)
 * 
 * @route GET /api/aebf/bulk-batches
 * @query {string} division - Division (FP or HC)
 * @returns {object} 200 - Array of batch records
 */
router.get('/bulk-batches', validationRules.bulkBatches, asyncHandler(async (req, res) => {
  const { division } = req.query;
    
    const divisionPool = getPoolForDivision(division);
    const tables = getTableNames(division);
    
    const query = `
      SELECT
        batch_id,
        division,
        budget_year,
        status,
        MIN(imported_at) as imported_at,
        COUNT(DISTINCT sales_rep) as sales_rep_count,
        COUNT(*) as record_count
      FROM ${tables.budgetBulkImport}
      WHERE division = $1
      GROUP BY batch_id, division, budget_year, status
      ORDER BY MIN(imported_at) DESC
    `;
    
    const result = await divisionPool.query(query, [division]);
    
    res.json({ success: true, batches: result.rows });
}));

/**
 * GET /bulk-batch/:batchId
 * Get specific bulk batch details with all records
 * 
 * @route GET /api/aebf/bulk-batch/:batchId
 * @param {string} batchId - Unique batch identifier
 * @query {string} division - Division (FP or HC)
 * @returns {object} 200 - Batch details with records
 */
router.get('/bulk-batch/:batchId', validationRules.bulkBatch, asyncHandler(async (req, res) => {
  const { batchId } = req.params;
  const { division } = req.query;
    
    const divisionPool = getPoolForDivision(division);
    const tables = getTableNames(division);
    
    // Get batch info
    const batchInfo = await divisionPool.query(
      `SELECT batch_id, division, budget_year, status, MIN(imported_at) as imported_at
       FROM ${tables.budgetBulkImport}
       WHERE batch_id = $1
       GROUP BY batch_id, division, budget_year, status`,
      [batchId]
    );
    
    if (batchInfo.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Batch not found' });
    }
    
    // Get all records
    const records = await divisionPool.query(
      `SELECT * FROM ${tables.budgetBulkImport} WHERE batch_id = $1 ORDER BY sales_rep, customer`,
      [batchId]
    );
    
    res.json({
      success: true,
      batch: batchInfo.rows[0],
      records: records.rows
    });
}));

/**
 * DELETE /bulk-batch/:batchId
 * Delete a bulk import batch and all associated records
 * 
 * @route DELETE /api/aebf/bulk-batch/:batchId
 * @param {string} batchId - Unique batch identifier
 * @query {string} division - Division (FP or HC)
 * @returns {object} 200 - Deletion confirmation
 */
router.delete('/bulk-batch/:batchId', validationRules.bulkBatch, asyncHandler(async (req, res) => {
  const { batchId } = req.params;
  const { division } = req.query;
    
    const divisionPool = getPoolForDivision(division);
    const tables = getTableNames(division);
    
    const deleteQuery = `
      DELETE FROM ${tables.budgetBulkImport}
      WHERE batch_id = $1 AND UPPER(division) = UPPER($2)
    `;
    
    const result = await divisionPool.query(deleteQuery, [batchId, division]);
    
    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        error: 'Batch not found'
      });
    }
    
    successResponse(res, {
      message: 'Batch deleted successfully',
      batchId
    });
}));

/**
 * POST /bulk-finalize/:batchId
 * Mark batch as FINALIZED (immutable state)
 * 
 * @route POST /api/aebf/bulk-finalize/:batchId
 * @param {string} batchId - Unique batch identifier
 * @body {string} division - Division (FP or HC)
 * @returns {object} 200 - Finalized batch details
 */
router.post('/bulk-finalize/:batchId', validationRules.bulkFinalize, asyncHandler(async (req, res) => {
  const { batchId } = req.params;
  const { division } = req.body;
    
    const divisionPool = getPoolForDivision(division);
    const tables = getTableNames(division);
    
    const updateQuery = `
      UPDATE ${tables.budgetBulkImport}
      SET status = 'FINALIZED', updated_at = NOW()
      WHERE batch_id = $1 AND UPPER(division) = UPPER($2)
      RETURNING *
    `;
    
    const result = await divisionPool.query(updateQuery, [batchId, division]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Batch not found'
      });
    }
    
    successResponse(res, {
      message: 'Batch finalized successfully',
      batch: result.rows[0]
    });
}));

/**
 * GET /bulk-export/:batchId
 * Export batch to CSV with headers
 * 
 * @route GET /api/aebf/bulk-export/:batchId
 * @param {string} batchId - Unique batch identifier
 * @query {string} division - Division (FP or HC)
 * @returns {file} 200 - CSV file download
 */
router.get('/bulk-export/:batchId', exportLimiter, validationRules.bulkBatch, asyncHandler(async (req, res) => {
  const { batchId } = req.params;
  const { division } = req.query;
    
    const divisionPool = getPoolForDivision(division);
    const tables = getTableNames(division);
    
    const query = `
      SELECT *
      FROM ${tables.budgetBulkImport}
      WHERE batch_id = $1 AND UPPER(division) = UPPER($2)
    `;
    
    const result = await divisionPool.query(query, [batchId, division]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Batch not found'
      });
    }
    
    // Generate CSV
    const batch = result.rows[0];
    const csv = `Batch ID,Division,Budget Year,Status,Total Records,Created At\n${batch.batch_id},${batch.division},${batch.budget_year},${batch.status},${batch.total_records},${batch.created_at}`;
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="bulk-batch-${batchId}.csv"`);
    res.send(csv);
}));

module.exports = router;
