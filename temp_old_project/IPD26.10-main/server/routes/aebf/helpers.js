/**
 * AEBF Shared Helpers
 * Common utility functions used across all AEBF route modules
 */

const { getDivisionPool } = require('../../utils/divisionDatabaseManager');

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
 * Uses division-specific database (e.g., fp_database, pp_database)
 */
function getPoolForDivision(division) {
  const divisionCode = extractDivisionCode(division);
  return getDivisionPool(divisionCode.toUpperCase());
}

/**
 * Helper function to get table names for a division
 * ALL tables are division-prefixed: fp_data_excel, pp_data_excel, etc.
 * Only ip_auth_database tables are shared across divisions.
 */
function getTableNames(division) {
  const code = extractDivisionCode(division);
  return {
    dataExcel: `${code}_data_excel`,
    materialPercentages: `${code}_material_percentages`,
    divisionalBudget: `${code}_divisional_budget`,
    salesRepBudget: `${code}_sales_rep_budget`,
    salesRepBudgetDraft: `${code}_sales_rep_budget_draft`,
    pricingRounding: `${code}_product_group_pricing_rounding`,
    customerMergeRules: `${code}_customer_merge_rules`,
    mergeRuleSuggestions: `${code}_merge_rule_suggestions`,
    mergeRuleNotifications: `${code}_merge_rule_notifications`,
    mergeRuleRejections: `${code}_merge_rule_rejections`,
    databaseUploadLog: `${code}_database_upload_log`,
    customerSimilarityCache: `${code}_customer_similarity_cache`,
    budgetBulkImport: `${code}_budget_bulk_import`
  };
}

/**
 * Validate division parameter
 * @returns {object|null} Error response object if invalid, null if valid
 */
function validateDivision(division, res) {
  if (!division) {
    res.status(400).json({
      success: false,
      error: 'Division parameter is required'
    });
    return false;
  }
  
  const validDivisions = ['FP', 'HC'];
  if (!validDivisions.includes(division.toUpperCase())) {
    res.status(400).json({
      success: false,
      error: `Invalid division. Must be one of: ${validDivisions.join(', ')}`
    });
    return false;
  }
  
  return true;
}

module.exports = {
  extractDivisionCode,
  getPoolForDivision,
  getTableNames,
  validateDivision
};
