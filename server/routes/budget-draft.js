/**
 * Budget Draft API Routes
 * Handles draft budget operations for live React version
 */

const express = require('express');
const logger = require('../utils/logger');
const router = express.Router();
const { pool } = require('../database/config');
const { getDivisionPool } = require('../utils/divisionDatabaseManager');

/**
 * Helper function to extract division code from full division name
 * e.g., "FP-UAE" -> "fp", "PP-KSA" -> "pp"
 */
function extractDivisionCode(division) {
  if (!division) return 'fp'; // Default to FP for backward compatibility
  return division.split('-')[0].toLowerCase();
}

/**
 * Helper function to get the correct database pool for a division
 */
function getPoolForDivision(division) {
  const divisionCode = extractDivisionCode(division);
  return getDivisionPool(divisionCode.toUpperCase());
}

/**
 * Helper function to get table names for a division
 * ALL tables are division-prefixed
 */
function getTableNames(division) {
  const code = extractDivisionCode(division);
  return {
    salesRepBudget: `${code}_sales_rep_budget`,
    salesRepBudgetDraft: `${code}_sales_rep_budget_draft`,
    pricingRounding: `${code}_product_group_pricing_rounding`,
    materialPercentages: `${code}_material_percentages`
  };
}

// ============================================================================
// SAVE DRAFT (Auto-save from live React version)
// ============================================================================

router.post('/save-draft', async (req, res) => {
  logger.info('💾 Save draft request received:', {
    division: req.body.division,
    salesRep: req.body.salesRep,
    budgetYear: req.body.budgetYear,
    budgetDataKeys: Object.keys(req.body.budgetData || {}).length,
    customRowsCount: (req.body.customRows || []).length
  });
  
  try {
    const { division, salesRep, budgetYear, customRows, budgetData } = req.body;
    
    if (!division || !salesRep || !budgetYear) {
      logger.error('❌ Missing required fields:', { division, salesRep, budgetYear });
      return res.status(400).json({
        success: false,
        error: 'division, salesRep, and budgetYear are required'
      });
    }
    
    logger.info('📋 Sample budget data entries:', Object.entries(budgetData || {}).slice(0, 3));
    
    // Get division-specific pool and table names
    const divisionPool = getPoolForDivision(division);
    const tables = getTableNames(division);
    logger.info('📋 Using table:', tables.salesRepBudgetDraft);
    const client = await divisionPool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Delete existing draft for this sales rep/division/year
      await client.query(`
        DELETE FROM ${tables.salesRepBudgetDraft}
        WHERE UPPER(division) = UPPER($1) 
        AND UPPER(salesrepname) = UPPER($2) 
        AND budget_year = $3
      `, [division, salesRep, budgetYear]);
      
      // Insert new draft data (only KGS values)
      let insertedCount = 0;
      let skippedCount = 0;
      let errorCount = 0;
      
      const entries = Object.entries(budgetData || {});
      logger.info(`📝 Processing ${entries.length} budget entries...`);
      
      for (const [key, value] of entries) {
        // Allow zero values for budget reset functionality
        if (value === null || value === undefined || value === '') {
          skippedCount++;
          continue;
        }
        const numValue = parseFloat(value.toString().replace(/,/g, ''));
        if (isNaN(numValue)) {
          skippedCount++;
          continue;
        }
        
        // Parse key to extract customer, country, productGroup, month
        // Key format: "customer|country|productGroup|month" (standardized)
        let customer, country, productGroup, month;
        
        if (key.includes('|')) {
          // Standardized format: "customer|country|productGroup|month"
          const parts = key.split('|');
          if (parts.length !== 4) {
            logger.warn(`⚠️ Invalid key format: ${key}`);
            skippedCount++;
            continue;
          }
          
          customer = parts[0];
          country = parts[1];
          productGroup = parts[2];
          month = parseInt(parts[3]);
        } else if (key.startsWith('custom_')) {
          // Legacy format for custom rows: "custom_rowId_month"
          const parts = key.split('_');
          month = parseInt(parts[parts.length - 1]);
          
          const rowId = parts[1];
          const row = customRows?.find(r => r.id.toString() === rowId);
          if (!row || !row.customer || !row.country || !row.productGroup) {
            logger.warn(`⚠️ Custom row not found or incomplete: ${rowId}`);
            skippedCount++;
            continue;
          }
          customer = row.customer;
          country = row.country;
          productGroup = row.productGroup;
        } else {
          // Unknown format
          logger.warn(`⚠️ Unknown key format: ${key}`);
          skippedCount++;
          continue;
        }
        
        if (isNaN(month) || month < 1 || month > 12) {
          logger.warn(`⚠️ Invalid month: ${month} for key ${key}`);
          skippedCount++;
          continue;
        }
        if (!customer || !country || !productGroup) {
          logger.warn(`⚠️ Missing required fields for key ${key}:`, { customer, country, productGroup });
          skippedCount++;
          continue;
        }
        
        const kgsValue = parseFloat(value.toString().replace(/,/g, '')) * 1000; // MT to KGS
        
        // Allow zero values for budget reset functionality
        // Only skip if NaN (already checked above, but double-check after conversion)
        if (isNaN(kgsValue)) {
          skippedCount++;
          continue;
        }
        
        try {
          await client.query(`
            INSERT INTO ${tables.salesRepBudgetDraft} (
              division, budget_year, month, salesrepname,
              customername, countryname, productgroup, values, updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP)
            ON CONFLICT (division, budget_year, month, salesrepname, customername, countryname, productgroup)
            DO UPDATE SET 
              values = EXCLUDED.values, 
              updated_at = CURRENT_TIMESTAMP
          `, [division, budgetYear, month, salesRep, customer, country, productGroup, kgsValue]);
          
          insertedCount++;
        } catch (insertError) {
          errorCount++;
          logger.error(`❌ Error inserting record for key ${key}:`, {
            error: insertError.message,
            code: insertError.code,
            detail: insertError.detail,
            params: { division, budgetYear, month, salesRep, customer, country, productGroup, kgsValue }
          });
          // Continue processing other records
        }
      }
      
      logger.info(`✅ Draft save complete: inserted=${insertedCount}, skipped=${skippedCount}, errors=${errorCount}`);
      
      await client.query('COMMIT');
      
      const result = {
        success: true,
        message: 'Draft saved successfully',
        recordsSaved: insertedCount,
        recordsSkipped: skippedCount,
        recordsWithErrors: errorCount,
        savedAt: new Date().toISOString()
      };
      
      logger.info('✅ Sending success response:', result);
      res.json(result);
      
    } catch (error) {
      logger.error('❌ Error in transaction:', error);
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
    
  } catch (error) {
    logger.error('❌ Error saving draft:', error);
    logger.error('Error stack:', error.stack);
    logger.error('Error details:', {
      message: error.message,
      code: error.code,
      detail: error.detail,
      constraint: error.constraint,
      table: error.table
    });
    res.status(500).json({
      success: false,
      error: error.message,
      errorCode: error.code,
      errorDetail: error.detail
    });
  }
});

// ============================================================================
// LOAD DRAFT
// ============================================================================

router.get('/load-draft/:division/:salesRep/:budgetYear', async (req, res) => {
  try {
    const { division, salesRep, budgetYear } = req.params;
    
    // Get division-specific pool and table names
    const divisionPool = getPoolForDivision(division);
    const tables = getTableNames(division);
    
    const result = await divisionPool.query(`
      SELECT * FROM ${tables.salesRepBudgetDraft}
      WHERE UPPER(division) = UPPER($1) 
      AND UPPER(salesrepname) = UPPER($2) 
      AND budget_year = $3
      ORDER BY customername, countryname, productgroup, month
    `, [division, salesRep, parseInt(budgetYear)]);
    
    res.json({
      success: true,
      draftData: result.rows,
      hasDraft: result.rows.length > 0,
      lastSaved: result.rows.length > 0 ? result.rows[0].updated_at : null
    });
    
  } catch (error) {
    logger.error('Error loading draft:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============================================================================
// SUBMIT FINAL BUDGET (Convert draft to final with calculations)
// ============================================================================

router.post('/submit-final', async (req, res) => {
  logger.info('📤 Submit final budget request received:', req.body);
  let client = null;
  
  try {
    const { division, salesRep, budgetYear } = req.body;
    
    if (!division || !salesRep || !budgetYear) {
      logger.error('❌ Missing required fields');
      return res.status(400).json({
        success: false,
        error: 'division, salesRep, and budgetYear are required'
      });
    }
    
    logger.info('✅ Validating request:', { division, salesRep, budgetYear });
    
    // Get division-specific pool
    const divisionPool = getPoolForDivision(division);
    client = await divisionPool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Get division code
      const divisionCode = division.split('-')[0].toLowerCase();
      logger.info('📋 Division code:', divisionCode);
      
      // Fetch material/process data
      const materialTableName = `${divisionCode}_material_percentages`;
      logger.info('📋 Material table:', materialTableName);
      
      let materialProcessResult;
      try {
        materialProcessResult = await client.query(`
          SELECT product_group, material, process 
          FROM ${materialTableName}
        `);
        logger.info(`✅ Found ${materialProcessResult.rows.length} material/process records`);
      } catch (tableError) {
        logger.error('❌ Error querying material table:', tableError);
        throw new Error(`Material percentages table not found: ${materialTableName}. Please ensure the table exists for division ${division}.`);
      }
      
      const materialProcessMap = {};
      materialProcessResult.rows.forEach(row => {
        materialProcessMap[row.product_group.toLowerCase()] = {
          material: row.material || '',
          process: row.process || ''
        };
      });
      
      // Fetch pricing data (previous year)
      const pricingYear = budgetYear - 1;
      logger.info(`📊 Fetching pricing data for division: ${divisionCode}, year: ${pricingYear}`);
      
      // Get division-specific table names
      const tables = getTableNames(division);
      
      let pricingResult;
      try {
        pricingResult = await client.query(`
          SELECT product_group, asp_round, morm_round
          FROM ${tables.pricingRounding}
          WHERE UPPER(division) = UPPER($1) AND year = $2
        `, [divisionCode, pricingYear]);
        logger.info(`✅ Found ${pricingResult.rows.length} pricing records`);
      } catch (pricingError) {
        logger.error('❌ Error querying pricing table:', pricingError);
        throw new Error(`Pricing table query failed: ${pricingError.message}. Please ensure the ${tables.pricingRounding} table exists.`);
      }
      
      const pricingMap = {};
      pricingResult.rows.forEach(row => {
        pricingMap[row.product_group.toLowerCase()] = {
          sellingPrice: row.asp_round ? Math.round(parseFloat(row.asp_round)) : null,
          morm: row.morm_round ? Math.round(parseFloat(row.morm_round)) : null
        };
      });
      
      // Check pricing data availability
      const warnings = [];
      if (Object.keys(pricingMap).length === 0) {
        warnings.push(`No pricing data found for year ${pricingYear}. Only KGS records will be created.`);
        logger.warn(`⚠️ No pricing data available for year ${pricingYear}`);
      }
      
      // Get draft data
      logger.info('🔍 Fetching draft data for:', { division, salesRep, budgetYear });
      const draftResult = await client.query(`
        SELECT * FROM ${tables.salesRepBudgetDraft}
        WHERE UPPER(division) = UPPER($1) 
        AND UPPER(salesrepname) = UPPER($2) 
        AND budget_year = $3
      `, [division, salesRep, budgetYear]);
      
      logger.info(`📊 Found ${draftResult.rows.length} draft records`);
      
      if (draftResult.rows.length === 0) {
        logger.error('❌ No draft data found');
        await client.query('ROLLBACK');
        // Don't release here - let finally block handle it
        return res.status(400).json({
          success: false,
          error: 'No draft data found to submit. Please enter budget values and wait for auto-save (every 30 seconds) before submitting.'
        });
      }
      
      // Delete existing final budget
      await client.query(`
        DELETE FROM ${tables.salesRepBudget}
        WHERE UPPER(division) = UPPER($1) 
        AND UPPER(salesrepname) = UPPER($2) 
        AND budget_year = $3
      `, [division, salesRep, budgetYear]);
      
      // Insert final budget (KGS, Amount, MoRM)
      let insertedKGS = 0, insertedAmount = 0, insertedMoRM = 0;
      
      logger.info(`📝 Processing ${draftResult.rows.length} draft records...`);
      
      // Log first few rows for debugging
      if (draftResult.rows.length > 0) {
        logger.info('📋 Sample draft row:', {
          division: draftResult.rows[0].division,
          budget_year: draftResult.rows[0].budget_year,
          month: draftResult.rows[0].month,
          salesrepname: draftResult.rows[0].salesrepname,
          customername: draftResult.rows[0].customername,
          countryname: draftResult.rows[0].countryname,
          productgroup: draftResult.rows[0].productgroup,
          values: draftResult.rows[0].values,
          values_type: draftResult.rows[0].values_type
        });
      }
      
      for (let i = 0; i < draftResult.rows.length; i++) {
        const draftRow = draftResult.rows[i];
        
        try {
          const productGroupKey = (draftRow.productgroup || '').toLowerCase();
          const materialProcess = materialProcessMap[productGroupKey] || { material: '', process: '' };
          const pricing = pricingMap[productGroupKey] || { sellingPrice: null, morm: null };
          
          const kgsValue = parseFloat(draftRow.values) || 0;
          
          // Allow zero values - users may want to clear/reset budgets
          // Only skip if value is NaN or missing required fields
          if (isNaN(kgsValue)) {
            logger.warn(`⚠️ Skipping record ${i + 1}: Invalid KGS value (${draftRow.values})`);
            continue;
          }
          
          if (!draftRow.customername || !draftRow.countryname || !draftRow.productgroup) {
            logger.warn(`⚠️ Skipping record ${i + 1}: Missing required fields`, draftRow);
            continue;
          }
          
          // Insert KGS
          try {
            await client.query(`
              INSERT INTO ${tables.salesRepBudget} (
                division, budget_year, month, type, salesrepname,
                customername, countryname, productgroup,
                values_type, values, material, process
              ) VALUES ($1, $2, $3, 'Budget', $4, $5, $6, $7, 'KGS', $8, $9, $10)
            `, [division, budgetYear, draftRow.month, salesRep, draftRow.customername,
                draftRow.countryname, draftRow.productgroup, kgsValue,
                materialProcess.material, materialProcess.process]);
            insertedKGS++;
          } catch (insertError) {
            logger.error(`❌ Error inserting KGS record ${i + 1}:`, insertError);
            logger.error('Insert parameters:', {
              division, budgetYear, month: draftRow.month, salesRep,
              customer: draftRow.customername, country: draftRow.countryname,
              productGroup: draftRow.productgroup, kgsValue,
              material: materialProcess.material, process: materialProcess.process
            });
            throw insertError; // Re-throw to be caught by outer catch
          }
        
          // Insert Amount
          if (pricing.sellingPrice !== null) {
            await client.query(`
              INSERT INTO ${tables.salesRepBudget} (
                division, budget_year, month, type, salesrepname,
                customername, countryname, productgroup,
                values_type, values, material, process
              ) VALUES ($1, $2, $3, 'Budget', $4, $5, $6, $7, 'Amount', $8, $9, $10)
            `, [division, budgetYear, draftRow.month, salesRep, draftRow.customername,
                draftRow.countryname, draftRow.productgroup, kgsValue * pricing.sellingPrice,
                materialProcess.material, materialProcess.process]);
            insertedAmount++;
          }
          
          // Insert MoRM
          if (pricing.morm !== null) {
            await client.query(`
              INSERT INTO ${tables.salesRepBudget} (
                division, budget_year, month, type, salesrepname,
                customername, countryname, productgroup,
                values_type, values, material, process
              ) VALUES ($1, $2, $3, 'Budget', $4, $5, $6, $7, 'MoRM', $8, $9, $10)
            `, [division, budgetYear, draftRow.month, salesRep, draftRow.customername,
                draftRow.countryname, draftRow.productgroup, kgsValue * pricing.morm,
                materialProcess.material, materialProcess.process]);
            insertedMoRM++;
          }
        } catch (rowError) {
          logger.error(`❌ Error processing draft row ${i + 1}:`, rowError);
          logger.error('Row data:', draftRow);
          // Continue with next row instead of failing completely
        }
      }
      
      logger.info(`✅ Processed all records: KGS=${insertedKGS}, Amount=${insertedAmount}, MoRM=${insertedMoRM}`);
      
      // Validate that at least some records were inserted
      if (insertedKGS === 0) {
        logger.error('❌ No records were inserted. All rows may have failed validation.');
        await client.query('ROLLBACK');
        // Don't release here - let finally block handle it
        return res.status(400).json({
          success: false,
          error: 'No records were inserted. Please check that your budget data has valid customer, country, and product group values.'
        });
      }
      
      await client.query('COMMIT');
      
      logger.info('✅ Budget submitted successfully:', {
        kgs: insertedKGS,
        amount: insertedAmount,
        morm: insertedMoRM,
        total: insertedKGS + insertedAmount + insertedMoRM
      });
      
      res.json({
        success: true,
        message: 'Budget submitted successfully',
        recordsInserted: {
          kgs: insertedKGS,
          amount: insertedAmount,
          morm: insertedMoRM,
          total: insertedKGS + insertedAmount + insertedMoRM
        },
        pricingYear,
        warnings: warnings.length > 0 ? warnings : undefined
      });
      
    } catch (error) {
      logger.error('❌ Database error in submit-final:', error);
      logger.error('Error stack:', error.stack);
      try { await client.query('ROLLBACK'); } catch (rbErr) { logger.error('Rollback failed:', rbErr); }
      throw error;
    }
    
  } catch (error) {
    logger.error('❌ Error submitting final budget:', error);
    logger.error('Error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name,
      code: error.code,
      detail: error.detail,
      constraint: error.constraint,
      table: error.table,
      column: error.column
    });
    
    // Provide more detailed error message
    let errorMessage = error.message || 'Failed to submit budget.';
    
    // Add SQL-specific error details if available
    if (error.code) {
      errorMessage += ` (Error Code: ${error.code})`;
    }
    if (error.detail) {
      errorMessage += ` Details: ${error.detail}`;
    }
    if (error.constraint) {
      errorMessage += ` Constraint: ${error.constraint}`;
    }
    
    res.status(500).json({
      success: false,
      error: errorMessage,
      errorCode: error.code,
      errorDetail: error.detail,
      errorConstraint: error.constraint,
      errorTable: error.table,
      errorColumn: error.column
    });
  }
  finally {
    try {
      if (client && typeof client.release === 'function') {
        client.release();
      }
    } catch (releaseErr) {
      logger.error('Error releasing DB client in submit-final finally block:', releaseErr);
    }
  }
});

// ============================================================================
// DELETE DRAFT
// ============================================================================

router.delete('/delete-draft/:division/:salesRep/:budgetYear', async (req, res) => {
  try {
    const { division, salesRep, budgetYear } = req.params;
    
    // Get division-specific pool and table names
    const divisionPool = getPoolForDivision(division);
    const tables = getTableNames(division);
    
    const result = await divisionPool.query(`
      DELETE FROM ${tables.salesRepBudgetDraft}
      WHERE UPPER(division) = UPPER($1) 
      AND UPPER(salesrepname) = UPPER($2) 
      AND budget_year = $3
    `, [division, salesRep, parseInt(budgetYear)]);
    
    res.json({
      success: true,
      message: 'Draft deleted successfully',
      recordsDeleted: result.rowCount
    });
    
  } catch (error) {
    logger.error('Error deleting draft:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.delete('/delete-final/:division/:salesRep/:budgetYear', async (req, res) => {
  logger.info('🗑️ DELETE budget request received:', req.params);
  try {
    const { division, salesRep, budgetYear } = req.params;
    
    logger.info(`Deleting budget for: Division=${division}, SalesRep=${salesRep}, Year=${budgetYear}`);
    
    // Get division-specific pool and table names
    const divisionPool = getPoolForDivision(division);
    const tables = getTableNames(division);
    
    // Delete from both final and draft tables
    const finalResult = await divisionPool.query(`
      DELETE FROM ${tables.salesRepBudget}
      WHERE UPPER(division) = UPPER($1) 
      AND UPPER(salesrepname) = UPPER($2) 
      AND budget_year = $3
    `, [division, salesRep, parseInt(budgetYear)]);
    
    logger.info(`✅ Deleted ${finalResult.rowCount} records from ${tables.salesRepBudget}`);
    
    const draftResult = await divisionPool.query(`
      DELETE FROM ${tables.salesRepBudgetDraft}
      WHERE UPPER(division) = UPPER($1) 
      AND UPPER(salesrepname) = UPPER($2) 
      AND budget_year = $3
    `, [division, salesRep, parseInt(budgetYear)]);
    
    logger.info(`✅ Deleted ${draftResult.rowCount} records from ${tables.salesRepBudgetDraft}`);
    
    const totalDeleted = finalResult.rowCount + draftResult.rowCount;
    logger.info(`✅ Total deleted: ${totalDeleted} records`);
    
    res.json({
      success: true,
      message: 'Budget deleted successfully',
      deletedCount: totalDeleted,
      finalRecords: finalResult.rowCount,
      draftRecords: draftResult.rowCount
    });
    
  } catch (error) {
    logger.error('❌ Error deleting final budget:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;

