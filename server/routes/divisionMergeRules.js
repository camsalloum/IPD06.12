/**
 * Division-Level Customer Merge Rules API Routes
 *
 * Endpoints for managing AI-powered customer merge rules
 */

const express = require('express');
const logger = require('../utils/logger');
const router = express.Router();
const { pool } = require('../database/config');
const { getDivisionPool } = require('../utils/divisionDatabaseManager');
const CustomerMergingAI = require('../services/CustomerMergingAI');

/**
 * Helper function to extract division code from full division name
 * e.g., "FP-UAE" -> "fp", "FP" -> "fp"
 */
function extractDivisionCode(division) {
  if (!division) return 'fp';
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
 * Helper function to get division-specific table names
 */
function getTableNames(division) {
  const code = extractDivisionCode(division);
  return {
    divisionMergeRules: `${code}_division_customer_merge_rules`,
    mergeRuleSuggestions: `${code}_merge_rule_suggestions`,
    mergeRuleNotifications: `${code}_merge_rule_notifications`,
    dataExcel: `${code}_data_excel`
  };
}

// ========================================================================
// AI SUGGESTIONS ENDPOINTS
// ========================================================================

/**
 * POST /api/division-merge-rules/scan
 * Run AI scan to find duplicate customers
 */
router.post('/scan', async (req, res) => {
  try {
    const { division, minConfidence, maxGroupSize } = req.body;

    if (!division) {
      return res.status(400).json({
        success: false,
        error: 'Division is required'
      });
    }

    logger.info(`🤖 Running AI scan for division: ${division}`);

    const suggestions = await CustomerMergingAI.scanAndSuggestMerges(division, {
      minConfidence: minConfidence || 0.75,
      maxGroupSize: maxGroupSize || 5
    });

    res.json({
      success: true,
      data: suggestions,
      count: suggestions.length
    });

  } catch (error) {
    logger.error('AI scan error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/division-merge-rules/suggestions
 * Get all AI suggestions for a division
 */
router.get('/suggestions', async (req, res) => {
  try {
    const { division, status } = req.query;

    if (!division) {
      return res.status(400).json({
        success: false,
        error: 'Division is required'
      });
    }

    // Get division-specific pool and tables
    const divisionPool = getPoolForDivision(division);
    const tables = getTableNames(division);

    let query = `
      SELECT
        id,
        suggested_merge_name,
        customer_group,
        confidence_score,
        match_details,
        admin_action,
        suggested_at,
        reviewed_at,
        reviewed_by
      FROM ${tables.mergeRuleSuggestions}
      WHERE division = $1
    `;

    const params = [division];

    if (status) {
      query += ` AND admin_action = $2`;
      params.push(status);
    }

    query += ` ORDER BY confidence_score DESC, suggested_at DESC`;

    const result = await divisionPool.query(query, params);

    res.json({
      success: true,
      data: result.rows
    });

  } catch (error) {
    logger.error('Error fetching suggestions:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/division-merge-rules/suggestions/:id/approve
 * Approve an AI suggestion and create active rule
 */
router.post('/suggestions/:id/approve', async (req, res) => {
  try {
    const { id } = req.params;
    const { approvedBy, division } = req.body;

    if (!division) {
      return res.status(400).json({
        success: false,
        error: 'Division is required'
      });
    }

    const divisionPool = getPoolForDivision(division);
    const tables = getTableNames(division);
    const client = await divisionPool.connect();

    try {
      await client.query('BEGIN');

      // 1. Get suggestion
      const suggestionResult = await client.query(
        `SELECT * FROM ${tables.mergeRuleSuggestions} WHERE id = $1`,
        [id]
      );

      if (suggestionResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({
          success: false,
          error: 'Suggestion not found'
        });
      }

      const suggestion = suggestionResult.rows[0];

      // 2. Create active merge rule
      // Ensure original_customers is valid JSON string
      const originalCustomersJson = (() => {
        const cg = suggestion.customer_group;
        if (Array.isArray(cg)) return JSON.stringify(cg);
        try {
          // If it's already a JSON string resembling an array/object, return as-is
          if (typeof cg === 'string') {
            JSON.parse(cg);
            return cg;
          }
        } catch (_) {
          // fallthrough
        }
        // Fallback: wrap single value into array
        return JSON.stringify([cg].filter(Boolean));
      })();

      const ruleResult = await client.query(`
        INSERT INTO ${tables.divisionMergeRules} (
          division,
          merged_customer_name,
          original_customers,
          rule_source,
          confidence_score,
          status,
          created_by,
          approved_by,
          approved_at,
          validation_status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP, $9)
        RETURNING id
      `, [
        suggestion.division,
        suggestion.suggested_merge_name,
        originalCustomersJson,
        'AI_SUGGESTED',
        suggestion.confidence_score,
        'ACTIVE',
        'AI_ENGINE',
        approvedBy || 'Admin',
        'VALID'
      ]);

      const createdRuleId = ruleResult.rows[0].id;

      // 3. Update suggestion status
      await client.query(`
        UPDATE ${tables.mergeRuleSuggestions}
        SET
          admin_action = 'APPROVED',
          reviewed_at = CURRENT_TIMESTAMP,
          reviewed_by = $1,
          was_correct = true,
          created_rule_id = $2
        WHERE id = $3
      `, [approvedBy || 'Admin', createdRuleId, id]);

      await client.query('COMMIT');

      logger.info(`✅ Suggestion #${id} approved, created rule #${createdRuleId}`);

      res.json({
        success: true,
        message: 'Suggestion approved and rule created',
        ruleId: createdRuleId
      });

    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Error approving suggestion:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    } finally {
      client.release();
    }
  } catch (outerError) {
    logger.error('Error in approve suggestion endpoint:', outerError);
    res.status(500).json({
      success: false,
      error: outerError.message
    });
  }
});

/**
 * POST /api/division-merge-rules/suggestions/:id/reject
 * Reject an AI suggestion
 */
router.post('/suggestions/:id/reject', async (req, res) => {
  try {
    const { id } = req.params;
    const { rejectedBy, reason, division } = req.body;

    if (!division) {
      return res.status(400).json({
        success: false,
        error: 'Division is required'
      });
    }

    const divisionPool = getPoolForDivision(division);
    const tables = getTableNames(division);

    await divisionPool.query(`
      UPDATE ${tables.mergeRuleSuggestions}
      SET
        admin_action = 'REJECTED',
        reviewed_at = CURRENT_TIMESTAMP,
        reviewed_by = $1,
        feedback_notes = $2,
        was_correct = false
      WHERE id = $3
    `, [rejectedBy || 'Admin', reason || '', id]);

    logger.info(`❌ Suggestion #${id} rejected`);

    res.json({
      success: true,
      message: 'Suggestion rejected'
    });

  } catch (error) {
    logger.error('Error rejecting suggestion:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/division-merge-rules/suggestions/:id/edit-approve
 * Edit and approve a suggestion
 */
router.post('/suggestions/:id/edit-approve', async (req, res) => {
  const { id } = req.params;
  const { mergedName, originalCustomers, approvedBy, division } = req.body;

  if (!division) {
    return res.status(400).json({
      success: false,
      error: 'Division is required'
    });
  }

  const divisionPool = getPoolForDivision(division);
  const tables = getTableNames(division);
  const client = await divisionPool.connect();

  try {
    await client.query('BEGIN');

    // Get original suggestion
    const suggestionResult = await client.query(
      `SELECT * FROM ${tables.mergeRuleSuggestions} WHERE id = $1`,
      [id]
    );

    if (suggestionResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        error: 'Suggestion not found'
      });
    }

    const suggestion = suggestionResult.rows[0];

    // Check if a rule with this name already exists
    const existingRule = await client.query(
      `SELECT id FROM ${tables.divisionMergeRules} WHERE division = $1 AND merged_customer_name = $2 AND is_active = true`,
      [suggestion.division, mergedName]
    );

    if (existingRule.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({
        success: false,
        error: `A merge rule with the name "${mergedName}" already exists. Please choose a different name.`
      });
    }

    // Create rule with edited values
    const ruleResult = await client.query(`
      INSERT INTO ${tables.divisionMergeRules} (
        division,
        merged_customer_name,
        original_customers,
        rule_source,
        confidence_score,
        status,
        created_by,
        approved_by,
        approved_at,
        validation_status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP, $9)
      RETURNING id
    `, [
      suggestion.division,
      mergedName,
      JSON.stringify(originalCustomers),
      'ADMIN_EDITED',
      suggestion.confidence_score,
      'ACTIVE',
      'AI_ENGINE',
      approvedBy || 'Admin',
      'VALID'
    ]);

    const createdRuleId = ruleResult.rows[0].id;

    // Update suggestion as modified
    await client.query(`
      UPDATE ${tables.mergeRuleSuggestions}
      SET
        admin_action = 'MODIFIED',
        reviewed_at = CURRENT_TIMESTAMP,
        reviewed_by = $1,
        was_correct = false,
        created_rule_id = $2,
        feedback_notes = 'Admin edited before approval'
      WHERE id = $3
    `, [approvedBy || 'Admin', createdRuleId, id]);

    await client.query('COMMIT');

    logger.info(`✏️ Suggestion #${id} edited and approved, created rule #${createdRuleId}`);

    res.json({
      success: true,
      message: 'Suggestion edited and approved',
      ruleId: createdRuleId
    });

  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Error editing suggestion:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  } finally {
    client.release();
  }
});

/**
 * POST /api/division-merge-rules/suggestions/manual
 * Create a manual suggestion from user-selected customers
 */
router.post('/suggestions/manual', async (req, res) => {
  try {
    const { division, mergedName, customerGroup, createdBy } = req.body;

    if (!division) {
      return res.status(400).json({
        success: false,
        error: 'Division is required'
      });
    }

    if (!Array.isArray(customerGroup) || customerGroup.length < 2) {
      return res.status(400).json({
        success: false,
        error: 'At least two customers are required to create a suggestion'
      });
    }

    // Clean and deduplicate customer names (case-insensitive)
    const cleanedCustomersMap = new Map();
    customerGroup.forEach(customer => {
      if (!customer) return;
      const trimmed = customer.toString().trim();
      if (!trimmed) return;
      const normalized = trimmed.toLowerCase();
      if (!cleanedCustomersMap.has(normalized)) {
        cleanedCustomersMap.set(normalized, trimmed);
      }
    });

    const cleanedCustomers = Array.from(cleanedCustomersMap.values());

    if (cleanedCustomers.length < 2) {
      return res.status(400).json({
        success: false,
        error: 'After removing duplicates, at least two unique customers are required'
      });
    }

    const suggestedMergeName = (mergedName || cleanedCustomers[0] || '').toString().trim();

    if (!suggestedMergeName) {
      return res.status(400).json({
        success: false,
        error: 'A merged customer name is required'
      });
    }

    // Get division-specific pool and tables
    const divisionPool = getPoolForDivision(division);
    const tables = getTableNames(division);

    // Ensure no active rule already exists with this merged name
    const existingRule = await divisionPool.query(
      `
        SELECT id
        FROM ${tables.divisionMergeRules}
        WHERE division = $1
          AND merged_customer_name = $2
          AND is_active = true
      `,
      [division, suggestedMergeName]
    );

    if (existingRule.rows.length > 0) {
      return res.status(409).json({
        success: false,
        error: `A merge rule named "${suggestedMergeName}" already exists`
      });
    }

    // Insert manual suggestion
    const insertResult = await divisionPool.query(
      `
        INSERT INTO ${tables.mergeRuleSuggestions} (
          division,
          suggested_merge_name,
          customer_group,
          confidence_score,
          matching_algorithm,
          match_details,
          admin_action,
          feedback_notes
        ) VALUES ($1, $2, $3, $4, $5, $6, 'PENDING', $7)
        RETURNING id
      `,
      [
        division,
        suggestedMergeName,
        JSON.stringify(cleanedCustomers),
        null,
        'MANUAL',
        JSON.stringify({
          source: 'MANUAL',
          createdBy: createdBy || 'Admin',
          createdAt: new Date().toISOString()
        }),
        createdBy ? `Manual suggestion provided by ${createdBy}` : 'Manual suggestion created via UI'
      ]
    );

    res.json({
      success: true,
      message: 'Manual suggestion created successfully',
      suggestionId: insertResult.rows[0]?.id
    });
  } catch (error) {
    logger.error('Error creating manual suggestion:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to create manual suggestion'
    });
  }
});

// ========================================================================
// ACTIVE RULES ENDPOINTS
// ========================================================================

/**
 * GET /api/division-merge-rules/rules
 * Get all active merge rules for a division
 */
router.get('/rules', async (req, res) => {
  try {
    const { division } = req.query;

    if (!division) {
      return res.status(400).json({
        success: false,
        error: 'Division is required'
      });
    }

    const divisionPool = getPoolForDivision(division);
    const tables = getTableNames(division);

    const result = await divisionPool.query(`
      SELECT
        id,
        merged_customer_name,
        original_customers,
        rule_source,
        confidence_score,
        status,
        validation_status,
        validation_notes,
        created_by,
        approved_by,
        created_at,
        last_validated_at
      FROM ${tables.divisionMergeRules}
      WHERE division = $1 AND is_active = true
      ORDER BY
        CASE validation_status
          WHEN 'ORPHANED' THEN 1
          WHEN 'NEEDS_UPDATE' THEN 2
          WHEN 'NOT_VALIDATED' THEN 3
          WHEN 'VALID' THEN 4
        END,
        merged_customer_name
    `, [division]);

    res.json({
      success: true,
      data: result.rows
    });

  } catch (error) {
    logger.error('Error fetching rules:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/division-merge-rules/rules/needs-validation
 * Get rules that need validation
 */
router.get('/rules/needs-validation', async (req, res) => {
  try {
    const { division } = req.query;

    if (!division) {
      return res.status(400).json({
        success: false,
        error: 'Division is required'
      });
    }

    const divisionPool = getPoolForDivision(division);
    const tables = getTableNames(division);

    const result = await divisionPool.query(`
      SELECT
        id,
        merged_customer_name,
        original_customers,
        validation_status,
        validation_notes,
        last_validated_at
      FROM ${tables.divisionMergeRules}
      WHERE division = $1
      AND is_active = true
      AND validation_status IN ('NEEDS_UPDATE', 'ORPHANED', 'NOT_VALIDATED')
      ORDER BY
        CASE validation_status
          WHEN 'ORPHANED' THEN 1
          WHEN 'NEEDS_UPDATE' THEN 2
          WHEN 'NOT_VALIDATED' THEN 3
        END
    `, [division]);

    res.json({
      success: true,
      data: result.rows
    });

  } catch (error) {
    logger.error('Error fetching rules needing validation:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/division-merge-rules/rules/:id/apply-fix
 * Apply AI suggestion to fix a broken rule
 */
router.post('/rules/:id/apply-fix', async (req, res) => {
  try {
    const { id } = req.params;
    const { suggestionIndex, approvedBy, division } = req.body;

    if (!division) {
      return res.status(400).json({
        success: false,
        error: 'Division is required'
      });
    }

    const divisionPool = getPoolForDivision(division);
    const tables = getTableNames(division);

    // Get rule with validation notes
    const ruleResult = await divisionPool.query(
      `SELECT * FROM ${tables.divisionMergeRules} WHERE id = $1`,
      [id]
    );

    if (ruleResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Rule not found'
      });
    }

    const rule = ruleResult.rows[0];
    const validationNotes = rule.validation_notes;

    if (!validationNotes || !validationNotes.suggestions || !validationNotes.suggestions[suggestionIndex]) {
      return res.status(400).json({
        success: false,
        error: 'Invalid suggestion index'
      });
    }

    const suggestion = validationNotes.suggestions[suggestionIndex];

    // Update rule with new customer name
    const updatedCustomers = rule.original_customers.map(c =>
      c === suggestion.missing ? suggestion.replacement : c
    );

    await divisionPool.query(`
      UPDATE ${tables.divisionMergeRules}
      SET
        original_customers = $1,
        validation_status = 'VALID',
        last_validated_at = CURRENT_TIMESTAMP,
        validation_notes = NULL,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
    `, [JSON.stringify(updatedCustomers), id]);

    logger.info(`🔧 Rule #${id} fixed: "${suggestion.missing}" → "${suggestion.replacement}"`);

    res.json({
      success: true,
      message: 'Rule updated successfully'
    });

  } catch (error) {
    logger.error('Error applying fix:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/division-merge-rules/rules/manual
 * Create a manual merge rule
 */
router.post('/rules/manual', async (req, res) => {
  try {
    const { division, mergedName, originalCustomers, createdBy } = req.body;

    if (!division || !mergedName || !originalCustomers || originalCustomers.length < 2) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request. Division, mergedName, and at least 2 customers required.'
      });
    }

    const divisionPool = getPoolForDivision(division);
    const tables = getTableNames(division);

    const result = await divisionPool.query(`
      INSERT INTO ${tables.divisionMergeRules} (
        division,
        merged_customer_name,
        original_customers,
        rule_source,
        status,
        created_by,
        validation_status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id
    `, [
      division,
      mergedName,
      JSON.stringify(originalCustomers),
      'ADMIN_CREATED',
      'ACTIVE',
      createdBy || 'Admin',
      'VALID'
    ]);

    logger.info(`✨ Manual rule created: "${mergedName}" (${originalCustomers.length} customers)`);

    res.json({
      success: true,
      message: 'Manual rule created successfully',
      ruleId: result.rows[0].id
    });

  } catch (error) {
    logger.error('Error creating manual rule:', error);

    if (error.code === '23505') { // Unique constraint violation
      return res.status(409).json({
        success: false,
        error: 'A rule with this merged customer name already exists'
      });
    }

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * PUT /api/division-merge-rules/rules/:id
 * Update an existing rule
 */
router.put('/rules/:id', async (req, res) => {
  const { id } = req.params;
  const { mergedName, originalCustomers, updatedBy, division } = req.body;

  if (!division) {
    return res.status(400).json({
      success: false,
      error: 'Division is required'
    });
  }

  const divisionPool = getPoolForDivision(division);
  const tables = getTableNames(division);
  const client = await divisionPool.connect();

  try {
    await client.query('BEGIN');

    // Get the current rule to check division
    const currentRule = await client.query(
      `SELECT division, merged_customer_name FROM ${tables.divisionMergeRules} WHERE id = $1`,
      [id]
    );

    if (currentRule.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        error: 'Rule not found'
      });
    }

    const ruleDivision = currentRule.rows[0].division;
    const oldName = currentRule.rows[0].merged_customer_name;

    // If name is changing, check if new name already exists
    if (mergedName !== oldName) {
      const existingRule = await client.query(
        `SELECT id FROM ${tables.divisionMergeRules} WHERE division = $1 AND merged_customer_name = $2 AND is_active = true AND id != $3`,
        [ruleDivision, mergedName, id]
      );

      if (existingRule.rows.length > 0) {
        await client.query('ROLLBACK');
        return res.status(409).json({
          success: false,
          error: `A merge rule with the name "${mergedName}" already exists. Please choose a different name.`
        });
      }
    }

    // Update the rule
    await client.query(`
      UPDATE ${tables.divisionMergeRules}
      SET
        merged_customer_name = $1,
        original_customers = $2,
        rule_source = 'ADMIN_EDITED',
        validation_status = 'VALID',
        last_validated_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $3
    `, [mergedName, JSON.stringify(originalCustomers), id]);

    await client.query('COMMIT');

    logger.info(`✏️ Rule #${id} updated by ${updatedBy || 'Admin'}`);

    res.json({
      success: true,
      message: 'Rule updated successfully'
    });

  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Error updating rule:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  } finally {
    client.release();
  }
});

/**
 * DELETE /api/division-merge-rules/rules/:id
 * Delete a merge rule
 */
router.delete('/rules/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { division } = req.query;

    if (!division) {
      return res.status(400).json({
        success: false,
        error: 'Division is required'
      });
    }

    const divisionPool = getPoolForDivision(division);
    const tables = getTableNames(division);

    await divisionPool.query(
      `UPDATE ${tables.divisionMergeRules} SET is_active = false WHERE id = $1`,
      [id]
    );

    logger.info(`🗑️ Rule #${id} deleted`);

    res.json({
      success: true,
      message: 'Rule deleted successfully'
    });

  } catch (error) {
    logger.error('Error deleting rule:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ========================================================================
// VALIDATION ENDPOINTS
// ========================================================================

/**
 * POST /api/division-merge-rules/validate
 * Validate all merge rules for a division
 */
router.post('/validate', async (req, res) => {
  try {
    const { division } = req.body;

    if (!division) {
      return res.status(400).json({
        success: false,
        error: 'Division is required'
      });
    }

    logger.info(`🔍 Validating merge rules for ${division}...`);

    // Get current customers
    const customers = await CustomerMergingAI.getAllCustomers(division);

    // Validate all rules
    const validationResults = await CustomerMergingAI.validateMergeRules(division, customers);

    res.json({
      success: true,
      data: validationResults,
      summary: {
        total: validationResults.length,
        valid: validationResults.filter(r => r.status === 'VALID').length,
        needsUpdate: validationResults.filter(r => r.status === 'NEEDS_UPDATE').length,
        orphaned: validationResults.filter(r => r.status === 'ORPHANED').length
      }
    });

  } catch (error) {
    logger.error('Error validating rules:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/division-merge-rules/stats
 * Get statistics for division merge rules
 */
router.get('/stats', async (req, res) => {
  try {
    const { division } = req.query;

    if (!division) {
      return res.status(400).json({
        success: false,
        error: 'Division is required'
      });
    }

    const divisionPool = getPoolForDivision(division);
    const tables = getTableNames(division);

    const stats = await divisionPool.query(`
      SELECT
        COUNT(*) FILTER (WHERE status = 'ACTIVE' AND validation_status = 'VALID') as active_rules,
        COUNT(*) FILTER (WHERE validation_status = 'NEEDS_UPDATE') as needs_update,
        COUNT(*) FILTER (WHERE validation_status = 'ORPHANED') as orphaned,
        COUNT(*) FILTER (WHERE validation_status = 'NOT_VALIDATED') as not_validated
      FROM ${tables.divisionMergeRules}
      WHERE division = $1 AND is_active = true
    `, [division]);

    const suggestions = await divisionPool.query(`
      SELECT
        COUNT(*) FILTER (WHERE admin_action = 'PENDING') as pending,
        COUNT(*) FILTER (WHERE admin_action = 'APPROVED') as approved,
        COUNT(*) FILTER (WHERE admin_action = 'REJECTED') as rejected
      FROM ${tables.mergeRuleSuggestions}
      WHERE division = $1
    `, [division]);

    res.json({
      success: true,
      data: {
        rules: stats.rows[0],
        suggestions: suggestions.rows[0]
      }
    });

  } catch (error) {
    logger.error('Error fetching stats:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ========================================================================
// CUSTOMER LIST ENDPOINTS
// ========================================================================

/**
 * GET /api/customers/list
 * Get all unique customers for a division
 */
router.get('/customers/list', async (req, res) => {
  try {
    const { division } = req.query;

    if (!division) {
      return res.status(400).json({
        success: false,
        error: 'Division is required'
      });
    }

    const customers = await CustomerMergingAI.getAllCustomers(division);

    res.json({
      success: true,
      customers: customers,
      count: customers.length
    });

  } catch (error) {
    logger.error('Error fetching customers:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
