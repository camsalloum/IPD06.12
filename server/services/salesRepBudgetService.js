const { getDivisionPool } = require('../utils/divisionDatabaseManager');
const logger = require('../utils/logger');

const MAX_KGS_VALUE = 1_000_000_000; // 1 billion KGS limit per record
const UNIQUE_CONFLICT_FIELDS = 'division, budget_year, month, type, salesrepname, customername, countryname, productgroup, values_type';

const safeTrim = (value) => (value === null || value === undefined)
  ? ''
  : value.toString().trim();

/**
 * Convert string to Proper Case for consistent naming across all data
 * Examples: "JOHN DOE" -> "John Doe", "masafi llc" -> "Masafi Llc"
 */
const toProperCase = (str) => {
  if (!str) return '';
  return str.toString().trim().toLowerCase()
    .replace(/(?:^|\s|[-/])\w/g, (match) => match.toUpperCase());
};

const normalizeProductGroupKey = (value) => safeTrim(value).toLowerCase();

const extractDivisionCode = (division) => {
  const [code = ''] = safeTrim(division).split('-');
  return code.replace(/[^a-zA-Z]/g, '').toLowerCase();
};

/**
 * Helper function to get division-specific table names
 * ALL tables are division-prefixed (e.g., fp_sales_rep_budget)
 */
const getTableNames = (division) => {
  const code = extractDivisionCode(division);
  return {
    salesRepBudget: `${code}_sales_rep_budget`,
    salesRepBudgetDraft: `${code}_sales_rep_budget_draft`,
    pricingRounding: `${code}_product_group_pricing_rounding`,
    materialPercentages: `${code}_material_percentages`
  };
};

const buildLiveEntryFilename = ({ division, salesRep, budgetYear }) => {
  const safeDivision = safeTrim(division).replace(/[^a-zA-Z0-9]/g, '_');
  const safeSalesRep = safeTrim(salesRep).replace(/[^a-zA-Z0-9]/g, '_');
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  return `LIVE_BUDGET_${safeDivision}_${safeSalesRep}_${budgetYear}_${timestamp}.json`;
};

const sanitizeRecords = (records = []) => {
  const valid = [];
  const errors = [];
  records.forEach((record, index) => {
    const customer = safeTrim(record.customer);
    const country = safeTrim(record.country);
    const productGroup = safeTrim(record.productGroup);
    const month = Number(record.month);
    let rawValue = record.value;
    if (typeof rawValue === 'string') {
      const cleaned = rawValue.replace(/,/g, '').trim();
      if (cleaned === '') {
        errors.push({ 
          index, 
          reason: 'Value is required',
          field: 'value',
          suggestion: 'Enter a valid numeric value (e.g., 100 or 1,500)'
        });
        return;
      }
      rawValue = cleaned;
    }
    const value = Number(rawValue);

    if (!customer) {
      errors.push({ 
        index, 
        reason: `Missing customer name at row ${index + 1}`,
        field: 'customer',
        suggestion: 'Select a customer from the dropdown or add a new customer row'
      });
      return;
    }
    if (!country) {
      errors.push({ 
        index, 
        reason: `Missing country for customer "${customer}"`,
        field: 'country',
        suggestion: 'Select a country from the dropdown. Check Customer Master if country is not available.'
      });
      return;
    }
    if (!productGroup) {
      errors.push({ 
        index, 
        reason: `Missing product group for "${customer}"`,
        field: 'productGroup',
        suggestion: 'Select a product group. If not listed, add it in Product Group Management first.'
      });
      return;
    }
    if (!Number.isInteger(month) || month < 1 || month > 12) {
      errors.push({ 
        index, 
        reason: `Invalid month value "${month}" for "${customer}"`,
        field: 'month',
        suggestion: 'Month must be between 1 and 12'
      });
      return;
    }
    if (rawValue === null || rawValue === undefined || rawValue === '' || Number.isNaN(value)) {
      errors.push({ 
        index, 
        reason: `Invalid value "${rawValue}" for "${customer}" - ${productGroup} - Month ${month}`,
        field: 'value',
        suggestion: 'Enter a valid number. Remove any text or special characters except commas.'
      });
      return;
    }
    if (value < 0) {
      errors.push({ 
        index, 
        reason: `Negative value (${value}) not allowed for "${customer}" - ${productGroup}`,
        field: 'value',
        suggestion: 'Budget values must be zero or positive. Use zero to clear a budget entry.'
      });
      return;
    }
    if (value > MAX_KGS_VALUE) {
      errors.push({ 
        index, 
        reason: `Value ${value.toLocaleString()} exceeds 1 billion KGS limit`,
        field: 'value',
        suggestion: 'Maximum allowed value is 1,000,000,000 KGS. Check if value was entered in wrong units.'
      });
      return;
    }

    valid.push({
      customer,
      country,
      productGroup,
      month,
      value
    });
  });

  return { validRecords: valid, skippedRecords: errors.length, errors };
};

const fetchExistingBudgetInfo = async (client, { division, salesRep, budgetYear }) => {
  const tables = getTableNames(division);
  const existingQuery = `
    SELECT 
      COUNT(*) as record_count,
      MAX(uploaded_at) as last_upload,
      MAX(uploaded_filename) as last_filename
    FROM ${tables.salesRepBudget}
    WHERE UPPER(division) = UPPER($1)
      AND UPPER(salesrepname) = UPPER($2)
      AND budget_year = $3
      AND UPPER(type) = 'BUDGET'
  `;

  const result = await client.query(existingQuery, [division, salesRep, budgetYear]);
  const row = result.rows[0] || {};
  return {
    recordCount: parseInt(row.record_count, 10) || 0,
    lastUpload: row.last_upload || null,
    lastFilename: row.last_filename || null
  };
};

const fetchMaterialProcessMap = async (client, divisionCode) => {
  if (!divisionCode) {
    return {};
  }

  const tableName = `${divisionCode}_material_percentages`;
  try {
    const result = await client.query(`
      SELECT product_group, material, process 
      FROM ${tableName}
    `);

    return result.rows.reduce((map, row) => {
      map[normalizeProductGroupKey(row.product_group)] = {
        material: row.material || '',
        process: row.process || ''
      };
      return map;
    }, {});
  } catch (error) {
    logger.warn(`⚠️ Material percentages lookup failed for table ${tableName}:`, error.message);
    return {};
  }
};

const fetchPricingMap = async (client, division, divisionCode, pricingYear) => {
  if (!divisionCode || !pricingYear) {
    return {};
  }

  const tables = getTableNames(division);
  try {
    const pricingResult = await client.query(`
      SELECT product_group, asp_round, morm_round
      FROM ${tables.pricingRounding}
      WHERE UPPER(division) = UPPER($1)
        AND year = $2
    `, [divisionCode, pricingYear]);

    return pricingResult.rows.reduce((map, row) => {
      const key = normalizeProductGroupKey(row.product_group);
      map[key] = {
        sellingPrice: row.asp_round !== null && row.asp_round !== undefined
          ? parseFloat(row.asp_round)
          : null,
        morm: row.morm_round !== null && row.morm_round !== undefined
          ? parseFloat(row.morm_round)
          : null
      };
      return map;
    }, {});
  } catch (error) {
    logger.warn(`⚠️ Pricing lookup failed for division ${divisionCode}, year ${pricingYear}:`, error.message);
    return {};
  }
};

const insertRecord = async (client, insertQuery, params) => client.query(insertQuery, params);

const saveLiveSalesRepBudget = async (client, payload) => {
  const {
    division,
    budgetYear,
    salesRep,
    records
  } = payload;

  if (!Array.isArray(records)) {
    throw new Error('records array is required');
  }

  const metadata = {
    division: safeTrim(division),
    budgetYear: parseInt(budgetYear, 10),
    salesRep: safeTrim(salesRep),
    savedAt: new Date().toISOString()
  };

  if (!metadata.division || !metadata.salesRep || Number.isNaN(metadata.budgetYear)) {
    const invalidMetadataError = new Error('division, salesRep, and budgetYear are required');
    invalidMetadataError.details = { division, budgetYear, salesRep };
    throw invalidMetadataError;
  }

  const { validRecords, skippedRecords, errors } = sanitizeRecords(records);
  if (validRecords.length === 0) {
    const errorMessage = skippedRecords > 0
      ? 'All records were invalid. Please review the data and try again.'
      : 'No budget records to save.';
    const validationError = new Error(errorMessage);
    validationError.details = errors;
    throw validationError;
  }

  const divisionCode = extractDivisionCode(metadata.division);
  const pricingYear = metadata.budgetYear - 1;
  const tables = getTableNames(metadata.division);

  const existingBudget = await fetchExistingBudgetInfo(client, metadata);
  const deleteResult = await client.query(`
    DELETE FROM ${tables.salesRepBudget}
    WHERE UPPER(division) = UPPER($1)
      AND UPPER(salesrepname) = UPPER($2)
      AND budget_year = $3
      AND UPPER(type) = 'BUDGET'
  `, [metadata.division, metadata.salesRep, metadata.budgetYear]);

  const materialProcessMap = await fetchMaterialProcessMap(client, divisionCode);
  const pricingMap = await fetchPricingMap(client, metadata.division, divisionCode, pricingYear);
  const warnings = [];
  const missingPricingProducts = new Set();
  let insertedKGS = 0;
  let insertedAmount = 0;
  let insertedMoRM = 0;

  const insertQuery = `
    INSERT INTO ${tables.salesRepBudget} (
      division,
      budget_year,
      month,
      type,
      salesrepname,
      customername,
      countryname,
      productgroup,
      values_type,
      values,
      material,
      process,
      uploaded_filename
    ) VALUES ($1, $2, $3, 'Budget', $4, $5, $6, $7, $8, $9, $10, $11, $12)
    ON CONFLICT (${UNIQUE_CONFLICT_FIELDS})
    DO UPDATE SET 
      values = EXCLUDED.values,
      material = EXCLUDED.material,
      process = EXCLUDED.process,
      uploaded_at = CURRENT_TIMESTAMP,
      uploaded_filename = EXCLUDED.uploaded_filename
  `;

  const uploadedFilename = buildLiveEntryFilename(metadata);

  // Normalize sales rep name once for all records
  const normalizedSalesRep = toProperCase(metadata.salesRep);
  
  for (const record of validRecords) {
    // Normalize all text fields to Proper Case for consistency with actual data
    const normalizedCustomer = toProperCase(record.customer);
    const normalizedCountry = toProperCase(record.country);
    const normalizedProductGroup = toProperCase(record.productGroup);
    
    const productGroupKey = normalizeProductGroupKey(record.productGroup);
    const materialProcess = materialProcessMap[productGroupKey] || { material: '', process: '' };
    const pricing = pricingMap[productGroupKey] || { sellingPrice: null, morm: null };

    await insertRecord(client, insertQuery, [
      metadata.division,
      metadata.budgetYear,
      record.month,
      normalizedSalesRep,
      normalizedCustomer,
      normalizedCountry,
      normalizedProductGroup,
      'KGS',
      record.value,
      materialProcess.material,
      materialProcess.process,
      uploadedFilename
    ]);
    insertedKGS++;

    if (pricing.sellingPrice !== null) {
      await insertRecord(client, insertQuery, [
        metadata.division,
        metadata.budgetYear,
        record.month,
        normalizedSalesRep,
        normalizedCustomer,
        normalizedCountry,
        normalizedProductGroup,
        'Amount',
        record.value * pricing.sellingPrice,
        materialProcess.material,
        materialProcess.process,
        uploadedFilename
      ]);
      insertedAmount++;
    } else {
      missingPricingProducts.add(record.productGroup);
    }

    if (pricing.morm !== null) {
      await insertRecord(client, insertQuery, [
        metadata.division,
        metadata.budgetYear,
        record.month,
        normalizedSalesRep,
        normalizedCustomer,
        normalizedCountry,
        normalizedProductGroup,
        'MoRM',
        record.value * pricing.morm,
        materialProcess.material,
        materialProcess.process,
        uploadedFilename
      ]);
      insertedMoRM++;
    } else {
      missingPricingProducts.add(record.productGroup);
    }
  }

  if (missingPricingProducts.size > 0) {
    warnings.push(`Missing pricing data for ${missingPricingProducts.size} product group(s). Amount/MoRM rows were skipped.`);
  }

  return {
    metadata,
    existingBudget: existingBudget.recordCount > 0 ? {
      ...existingBudget,
      wasReplaced: deleteResult.rowCount > 0
    } : null,
    recordsDeleted: deleteResult.rowCount,
    recordsProcessed: validRecords.length,
    skippedRecords,
    validationErrors: errors.slice(0, 10),
    recordsInserted: {
      kgs: insertedKGS,
      amount: insertedAmount,
      morm: insertedMoRM,
      total: insertedKGS + insertedAmount + insertedMoRM
    },
    pricingYear,
    pricingDataAvailable: Object.keys(pricingMap).length,
    warnings: warnings.length > 0 ? warnings : undefined
  };
};

module.exports = {
  saveLiveSalesRepBudget
};
