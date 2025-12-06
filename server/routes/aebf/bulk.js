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
 * Create a bulk import batch with unique batch_id
 * 
 * @route POST /api/aebf/bulk-import
 * @body {string} division - Division (FP or HC)
 * @body {number} budgetYear - Budget year
 * @body {array} records - Array of records for bulk import
 * @returns {object} 200 - Batch creation result with batch_id
 */
router.post('/bulk-import', queryLimiter, validationRules.bulkImport, asyncHandler(async (req, res) => {
  const { division, budgetYear, records } = req.body;
    
    const divisionPool = getPoolForDivision(division);
    const tables = getTableNames(division);
    
    const client = await divisionPool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Create batch ID
      const batchId = `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Insert into bulk import table
      const insertQuery = `
        INSERT INTO ${tables.bulkImport || 'fp_bulk_import'} (
          batch_id, division, budget_year, status, total_records, created_at
        ) VALUES ($1, $2, $3, 'PENDING', $4, NOW())
        RETURNING id
      `;
      
      const result = await client.query(insertQuery, [
        batchId,
        division.toUpperCase(),
        parseInt(budgetYear),
        records.length
      ]);
      
      await client.query('COMMIT');
      
      successResponse(res, {
        batchId,
        id: result.rows[0].id,
        totalRecords: records.length,
        message: 'Bulk import batch created'
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
        id, batch_id, division, budget_year, status, 
        total_records, processed_records, created_at, updated_at
      FROM ${tables.bulkImport || 'fp_bulk_import'}
      WHERE UPPER(division) = UPPER($1)
      ORDER BY created_at DESC
      LIMIT 50
    `;
    
    const result = await divisionPool.query(query, [division]);
    
    successResponse(res, { batches: result.rows });
}));

/**
 * GET /bulk-batch/:batchId
 * Get specific bulk batch details with record count
 * 
 * @route GET /api/aebf/bulk-batch/:batchId
 * @param {string} batchId - Unique batch identifier
 * @query {string} division - Division (FP or HC)
 * @returns {object} 200 - Batch details
 */
router.get('/bulk-batch/:batchId', validationRules.bulkBatch, asyncHandler(async (req, res) => {
  const { batchId } = req.params;
  const { division } = req.query;
    
    const divisionPool = getPoolForDivision(division);
    const tables = getTableNames(division);
    
    const query = `
      SELECT 
        id, batch_id, division, budget_year, status, 
        total_records, processed_records, created_at, updated_at
      FROM ${tables.bulkImport || 'fp_bulk_import'}
      WHERE batch_id = $1 AND UPPER(division) = UPPER($2)
    `;
    
    const result = await divisionPool.query(query, [batchId, division]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Batch not found'
      });
    }
    
    successResponse(res, { batch: result.rows[0] });
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
      DELETE FROM ${tables.bulkImport || 'fp_bulk_import'}
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
      UPDATE ${tables.bulkImport || 'fp_bulk_import'}
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
      FROM ${tables.bulkImport || 'fp_bulk_import'}
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
