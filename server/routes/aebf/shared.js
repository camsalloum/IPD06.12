/**
 * AEBF Shared Utilities
 * Common functions and helpers used across AEBF routes
 */

const { getDivisionPool } = require('../../utils/divisionDatabaseManager');

// Valid divisions list
const VALID_DIVISIONS = ['FP', 'HC'];

/**
 * Extract division code from full division name
 * @param {string} division - Full division name (e.g., "FP-UAE")
 * @returns {string} Division code (e.g., "fp")
 */
function extractDivisionCode(division) {
  if (!division) return 'fp';
  return division.split('-')[0].toLowerCase();
}

/**
 * Get the correct database pool for a division
 * @param {string} division - Division name
 * @returns {Pool} PostgreSQL pool
 */
function getPoolForDivision(division) {
  const divisionCode = extractDivisionCode(division);
  return getDivisionPool(divisionCode.toUpperCase());
}

/**
 * Get table names for a division
 * @param {string} division - Division name
 * @returns {Object} Table names object
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
 * Build WHERE clause for query filters
 * @param {Object} filters - Filter parameters
 * @returns {Object} { whereClause, params }
 */
function buildWhereClause(filters) {
  const conditions = [];
  const params = [];
  let paramIndex = 1;

  if (filters.division) {
    conditions.push(`division = $${paramIndex++}`);
    params.push(filters.division);
  }

  if (filters.year) {
    conditions.push(`year = $${paramIndex++}`);
    params.push(filters.year);
  }

  if (filters.month) {
    conditions.push(`month = $${paramIndex++}`);
    params.push(filters.month);
  }

  if (filters.values_type) {
    conditions.push(`values_type = $${paramIndex++}`);
    params.push(filters.values_type);
  }

  if (filters.salesrepname) {
    conditions.push(`salesrepname = $${paramIndex++}`);
    params.push(filters.salesrepname);
  }

  if (filters.customername) {
    conditions.push(`customername ILIKE $${paramIndex++}`);
    params.push(`%${filters.customername}%`);
  }

  if (filters.countryname) {
    conditions.push(`countryname = $${paramIndex++}`);
    params.push(filters.countryname);
  }

  if (filters.productgroup) {
    conditions.push(`productgroup = $${paramIndex++}`);
    params.push(filters.productgroup);
  }

  if (filters.search) {
    conditions.push(`(
      customername ILIKE $${paramIndex} OR 
      countryname ILIKE $${paramIndex} OR 
      productgroup ILIKE $${paramIndex}
    )`);
    params.push(`%${filters.search}%`);
    paramIndex++;
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  
  return { whereClause, params, nextParamIndex: paramIndex };
}

/**
 * Validate pagination parameters
 * @param {number} page - Page number
 * @param {number} pageSize - Page size
 * @returns {Object} Validated pagination params
 */
function validatePagination(page, pageSize) {
  const validPage = Math.max(1, parseInt(page) || 1);
  const validPageSize = Math.min(1000, Math.max(1, parseInt(pageSize) || 100));
  const offset = (validPage - 1) * validPageSize;
  
  return { page: validPage, pageSize: validPageSize, offset };
}

/**
 * Calculate pagination metadata
 * @param {number} total - Total records
 * @param {number} page - Current page
 * @param {number} pageSize - Page size
 * @returns {Object} Pagination metadata
 */
function calculatePagination(total, page, pageSize) {
  return {
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
    hasNextPage: page < Math.ceil(total / pageSize),
    hasPreviousPage: page > 1
  };
}

module.exports = {
  VALID_DIVISIONS,
  extractDivisionCode,
  getPoolForDivision,
  getTableNames,
  buildWhereClause,
  validatePagination,
  calculatePagination
};
