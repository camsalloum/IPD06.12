const { pool } = require('./config');
const logger = require('../utils/logger');

class FPDataService {
  constructor() {
    this.pool = pool;
  }

  // Existing methods (keeping for compatibility)
  async getProductGroups() {
    try {
      const result = await this.pool.query(
        'SELECT DISTINCT INITCAP(LOWER(productgroup)) as productgroup FROM fp_data_excel WHERE productgroup IS NOT NULL AND productgroup != \'\' ORDER BY productgroup'
      );
      return result.rows.map(row => row.productgroup);
    } catch (error) {
      logger.error('Error fetching product groups:', error);
      throw error;
    }
  }

  async getProductGroupsBySalesRep(salesRep) {
    try {
      const result = await this.pool.query(
        'SELECT DISTINCT INITCAP(LOWER(productgroup)) as productgroup FROM fp_data_excel WHERE TRIM(UPPER(salesrepname)) = TRIM(UPPER($1)) AND productgroup IS NOT NULL AND productgroup != \'\' ORDER BY productgroup',
        [salesRep]
      );
      return result.rows.map(row => row.productgroup);
    } catch (error) {
      logger.error('Error fetching product groups by sales rep:', error);
      throw error;
    }
  }

  async getSalesData(salesRep, productGroup, valueType, year, month) {
    try {
      const result = await this.pool.query(
        'SELECT * FROM fp_data_excel WHERE salesrepname = $1 AND productgroup = $2 AND values_type = $3 AND year = $4 AND month = $5',
        [salesRep, productGroup, valueType, year, month]
      );
      return result.rows;
    } catch (error) {
      logger.error('Error fetching sales data:', error);
      throw error;
    }
  }

  /**
   * Get sales data by value type for a specific sales rep, product group, and period
   */
  async getSalesDataByValueType(salesRep, productGroup, valueType, year, month, dataType = 'Actual') {
    try {
      // Handle "Estimate" or "FY Estimate" type - query both Actual and Estimate
      const normalizedDataType = dataType.toUpperCase();
      const isEstimateType = normalizedDataType.includes('ESTIMATE');
      
      const typeCondition = isEstimateType 
        ? `AND UPPER(type) IN ('ACTUAL', 'ESTIMATE')`
        : `AND UPPER(type) = UPPER($6)`;
      
      const query = `
        SELECT SUM(values) as total_value 
        FROM fp_data_excel 
        WHERE TRIM(UPPER(salesrepname)) = TRIM(UPPER($1)) 
        AND UPPER(TRIM(productgroup)) = UPPER(TRIM($2)) 
        AND UPPER(values_type) = UPPER($3) 
        AND year = $4 
        AND month = $5 
        ${typeCondition}
      `;
      
      const params = isEstimateType
        ? [salesRep, productGroup, valueType, year, month]
        : [salesRep, productGroup, valueType, year, month, dataType];
      
      const result = await this.pool.query(query, params);
      return parseFloat(result.rows[0]?.total_value || 0);
    } catch (error) {
      logger.error('Error fetching sales data by value type:', error);
      throw error;
    }
  }

  /**
   * Get sales data for a group of sales reps
   */
  async getSalesDataForGroup(groupMembers, productGroup, valueType, year, month, dataType = 'Actual') {
    try {
      // Handle "Estimate" or "FY Estimate" type - query both Actual and Estimate
      const normalizedDataType = dataType.toUpperCase();
      const isEstimateType = normalizedDataType.includes('ESTIMATE');
      
      const placeholders = groupMembers.map((_, index) => `$${index + 1}`).join(', ');
      const typeCondition = isEstimateType 
        ? `AND UPPER(type) IN ('ACTUAL', 'ESTIMATE')`
        : `AND UPPER(type) = UPPER($${groupMembers.length + 5})`;
      
      const query = `
        SELECT SUM(values) as total_value 
        FROM fp_data_excel 
        WHERE TRIM(UPPER(salesrepname)) IN (${placeholders}) 
        AND UPPER(TRIM(productgroup)) = UPPER(TRIM($${groupMembers.length + 1}))
        AND UPPER(values_type) = UPPER($${groupMembers.length + 2})
        AND year = $${groupMembers.length + 3}
        AND month = $${groupMembers.length + 4}
        ${typeCondition}
      `;
      
      const params = isEstimateType
        ? [
            ...groupMembers.map(n => String(n).trim().toUpperCase()),
            productGroup,
            valueType,
            year,
            month
          ]
        : [
            ...groupMembers.map(n => String(n).trim().toUpperCase()),
            productGroup,
            valueType,
            year,
            month,
            dataType
          ];
      
      const result = await this.pool.query(query, params);
      return parseFloat(result.rows[0]?.total_value || 0);
    } catch (error) {
      logger.error('Error fetching sales data for group:', error);
      throw error;
    }
  }

  /**
   * Get customers by sales rep
   */
  async getCustomersBySalesRep(salesRep) {
    try {
      const result = await this.pool.query(
        'SELECT DISTINCT customername FROM fp_data_excel WHERE TRIM(UPPER(salesrepname)) = TRIM(UPPER($1)) AND customername IS NOT NULL AND TRIM(customername) != \'\' ORDER BY customername',
        [salesRep]
      );
      return result.rows.map(row => row.customername);
    } catch (error) {
      logger.error('Error fetching customers by sales rep:', error);
      throw error;
    }
  }

  /**
   * Get customers for a group of sales reps
   */
  async getCustomersForGroup(groupMembers) {
    try {
      const placeholders = groupMembers.map((_, index) => `$${index + 1}`).join(', ');
      const query = `
        SELECT DISTINCT customername 
        FROM fp_data_excel 
        WHERE TRIM(UPPER(salesrepname)) IN (${placeholders}) 
        AND customername IS NOT NULL 
        AND TRIM(customername) != ''
        ORDER BY customername
      `;
      
      const params = groupMembers.map(n => String(n).trim().toUpperCase());
      const result = await this.pool.query(query, params);
      return result.rows.map(row => row.customername);
    } catch (error) {
      logger.error('Error fetching customers for group:', error);
      throw error;
    }
  }

  /**
   * Get customer sales data by value type for a specific sales rep
   */
  async getCustomerSalesDataByValueType(salesRep, customer, valueType, year, month, dataType = 'Actual') {
    try {
      // Handle "Estimate" or "FY Estimate" type - query both Actual and Estimate
      const normalizedDataType = dataType.toUpperCase();
      const isEstimateType = normalizedDataType.includes('ESTIMATE');

      const typeCondition = isEstimateType
        ? `AND UPPER(type) IN ('ACTUAL', 'ESTIMATE')`
        : `AND UPPER(type) = UPPER($6)`;

      const query = `
        SELECT SUM(values) as total_value
        FROM fp_data_excel
        WHERE TRIM(UPPER(salesrepname)) = TRIM(UPPER($1))
        AND customername = $2
        AND UPPER(values_type) = UPPER($3)
        AND year = $4
        AND month = $5
        ${typeCondition}
      `;

      const params = isEstimateType
        ? [salesRep, customer, valueType, year, month]
        : [salesRep, customer, valueType, year, month, dataType];

      const result = await this.pool.query(query, params);
      return parseFloat(result.rows[0]?.total_value || 0);
    } catch (error) {
      logger.error('Error fetching customer sales data by value type:', error);
      throw error;
    }
  }

  /**
   * Get customer sales data for a group of sales reps
   */
  async getCustomerSalesDataForGroup(groupMembers, customer, valueType, year, month, dataType = 'Actual') {
    try {
      // Handle "Estimate" or "FY Estimate" type - query both Actual and Estimate
      const normalizedDataType = dataType.toUpperCase();
      const isEstimateType = normalizedDataType.includes('ESTIMATE');

      const placeholders = groupMembers.map((_, index) => `$${index + 1}`).join(', ');

      const typeCondition = isEstimateType
        ? `AND UPPER(type) IN ('ACTUAL', 'ESTIMATE')`
        : `AND UPPER(type) = UPPER($${groupMembers.length + 5})`;

      const query = `
        SELECT SUM(values) as total_value
        FROM fp_data_excel
        WHERE TRIM(UPPER(salesrepname)) IN (${placeholders})
        AND customername = $${groupMembers.length + 1}
        AND UPPER(values_type) = UPPER($${groupMembers.length + 2})
        AND year = $${groupMembers.length + 3}
        AND month = $${groupMembers.length + 4}
        ${typeCondition}
      `;

      const params = isEstimateType
        ? [
            ...groupMembers.map(n => String(n).trim().toUpperCase()),
            customer,
            valueType,
            year,
            month
          ]
        : [
            ...groupMembers.map(n => String(n).trim().toUpperCase()),
            customer,
            valueType,
            year,
            month,
            dataType
          ];

      const result = await this.pool.query(query, params);
      return parseFloat(result.rows[0]?.total_value || 0);
    } catch (error) {
      logger.error('Error fetching customer sales data for group:', error);
      throw error;
    }
  }

  // NEW: Master Data Methods

  /**
   * Get unique product groups from fp_data_excel, excluding specified categories
   */
  async getProductGroupsForMasterData() {
    try {
      // First get excluded categories from config
      const excludedCategories = await this.getExcludedProductGroups();
      
      // Build query with exclusions and case-insensitive filtering
      let query = `
        SELECT DISTINCT productgroup 
        FROM fp_data_excel 
        WHERE productgroup IS NOT NULL 
        AND productgroup != ''
        AND LOWER(productgroup) NOT IN (${excludedCategories.map(cat => `LOWER('${cat}')`).join(', ')})
        ORDER BY productgroup
      `;
      
      const result = await this.pool.query(query);
      
      // Format product group names to proper case
      return result.rows.map(row => this.formatProductGroupName(row.productgroup));
    } catch (error) {
      logger.error('Error fetching product groups for master data:', error);
      throw error;
    }
  }

  /**
   * Get available years (descending) that contain Actual data
   */
  async getProductGroupPricingYears() {
    try {
      const result = await this.pool.query(`
        SELECT DISTINCT year
        FROM fp_data_excel
        WHERE year IS NOT NULL
          AND UPPER(type) = 'ACTUAL'
        ORDER BY year DESC
      `);
      return result.rows.map(row => row.year);
    } catch (error) {
      logger.error('Error fetching product group pricing years:', error);
      throw error;
    }
  }

  /**
   * Get average ASP and MoRM/Kg per product group for a specific year (Actual only)
   * Average is calculated only across months that have Actual data
   */
  async getProductGroupPricingAverages(year) {
    if (!year) {
      throw new Error('Year is required to fetch product group pricing averages');
    }

    try {
      const query = `
        WITH monthly_data AS (
          SELECT 
            INITCAP(LOWER(productgroup)) AS product_group,
            year,
            month,
            SUM(CASE WHEN UPPER(values_type) = 'KGS' THEN values ELSE 0 END) AS total_kgs,
            SUM(CASE WHEN UPPER(values_type) = 'AMOUNT' THEN values ELSE 0 END) AS total_amount,
            SUM(CASE WHEN UPPER(values_type) = 'MORM' THEN values ELSE 0 END) AS total_morm
          FROM fp_data_excel
          WHERE productgroup IS NOT NULL
            AND TRIM(productgroup) != ''
            AND UPPER(type) = 'ACTUAL'
            AND year = $1
            AND month IS NOT NULL
          GROUP BY productgroup, year, month
        )
        SELECT 
          product_group,
          SUM(total_kgs) AS total_kgs,
          SUM(total_amount) AS total_amount,
          SUM(total_morm) AS total_morm,
          COUNT(*) FILTER (WHERE total_kgs > 0) AS months_with_data
        FROM monthly_data
        GROUP BY product_group
        ORDER BY product_group
      `;

      const result = await this.pool.query(query, [year]);

      return result.rows.map(row => {
        const totalKgs = parseFloat(row.total_kgs) || 0;
        const totalAmount = parseFloat(row.total_amount) || 0;
        const totalMorm = parseFloat(row.total_morm) || 0;
        return {
          productGroup: row.product_group,
          avgSellingPrice: totalKgs > 0 ? totalAmount / totalKgs : 0,
          avgMarginOverRM: totalKgs > 0 ? totalMorm / totalKgs : 0,
          monthsWithData: parseInt(row.months_with_data, 10) || 0
        };
      });
    } catch (error) {
      logger.error('Error fetching product group pricing averages:', error);
      throw error;
    }
  }

  /**
   * Format product group name to proper case
   * Handles spaces, hyphens, and slashes consistently with other normalization
   */
  formatProductGroupName(name) {
    if (!name) return name;
    
    // Use regex to handle spaces, hyphens, and slashes (consistent with main toProperCase)
    return name.toString().trim().toLowerCase()
      .replace(/(?:^|\s|[-/])\w/g, (match) => match.toUpperCase());
  }

  /**
   * Get excluded product groups from config
   */
  async getExcludedProductGroups() {
    try {
      const result = await this.pool.query(
        'SELECT config_value FROM fp_master_config WHERE config_key = $1',
        ['excluded_product_groups']
      );
      
      if (result.rows.length > 0) {
        return result.rows[0].config_value;
      }
      
      // Default exclusions if config not found
      return ['Service Charges', 'Others', 'Other', 'Miscellaneous', 'Service', 'Charges'];
    } catch (error) {
      logger.error('Error fetching excluded product groups:', error);
      return ['Service Charges', 'Others', 'Other', 'Miscellaneous', 'Service', 'Charges'];
    }
  }

  /**
   * Get all material percentages for all product groups
   */
  async getMaterialPercentages() {
    try {
      const result = await this.pool.query(
        'SELECT * FROM fp_material_percentages ORDER BY product_group'
      );
      return result.rows;
    } catch (error) {
      logger.error('Error fetching material percentages:', error);
      throw error;
    }
  }

  /**
   * Get material percentages for a specific product group
   */
  async getMaterialPercentage(productGroup) {
    try {
      const result = await this.pool.query(
        'SELECT * FROM fp_material_percentages WHERE product_group = $1',
        [productGroup]
      );
      return result.rows[0] || null;
    } catch (error) {
      logger.error('Error fetching material percentage:', error);
      throw error;
    }
  }

  /**
   * Create or update material percentages for a product group
   */
  async saveMaterialPercentage(productGroup, percentages, material = '', process = '') {
    try {
      // Handle both parameter formats (PE/pe, PP/bopp, etc.)
      const pe = percentages.PE || percentages.pe || 0;
      const bopp = percentages.PP || percentages.BOPP || percentages.bopp || 0;
      const pet = percentages.PET || percentages.pet || 0;
      const alu = percentages.Alu || percentages.alu || 0;
      const paper = percentages.Paper || percentages.paper || 0;
      const pvc_pet = percentages['PVC/PET'] || percentages.pvc_pet || 0;
      
      // Format the product group name to proper case
      const formattedProductGroup = this.formatProductGroupName(productGroup);
      
      const query = `
        INSERT INTO fp_material_percentages 
        (product_group, pe_percentage, bopp_percentage, pet_percentage, alu_percentage, paper_percentage, pvc_pet_percentage, material, process)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (product_group) 
        DO UPDATE SET 
          pe_percentage = EXCLUDED.pe_percentage,
          bopp_percentage = EXCLUDED.bopp_percentage,
          pet_percentage = EXCLUDED.pet_percentage,
          alu_percentage = EXCLUDED.alu_percentage,
          paper_percentage = EXCLUDED.paper_percentage,
          pvc_pet_percentage = EXCLUDED.pvc_pet_percentage,
          material = EXCLUDED.material,
          process = EXCLUDED.process,
          updated_at = CURRENT_TIMESTAMP
        RETURNING *
      `;
      
      const result = await this.pool.query(query, [
        formattedProductGroup, pe, bopp, pet, alu, paper, pvc_pet, material || '', process || ''
      ]);
      
      return result.rows[0];
    } catch (error) {
      logger.error('Error saving material percentage:', error);
      throw error;
    }
  }

  /**
   * Initialize material percentages for all product groups (set all to 0%)
   */
  async initializeMaterialPercentages() {
    try {
      const productGroups = await this.getProductGroupsForMasterData();
      
      for (const productGroup of productGroups) {
        // Check if already exists
        const existing = await this.getMaterialPercentage(productGroup);
        if (!existing) {
          await this.saveMaterialPercentage(productGroup, {
            pe: 0,
            bopp: 0,
            pet: 0,
            alu: 0,
            paper: 0,
            pvc_pet: 0
          });
        }
      }
      
      return productGroups;
    } catch (error) {
      logger.error('Error initializing material percentages:', error);
      throw error;
    }
  }

  /**
   * Delete material percentage for a product group
   */
  async deleteMaterialPercentage(productGroup) {
    try {
      const result = await this.pool.query(
        'DELETE FROM fp_material_percentages WHERE product_group = $1 RETURNING *',
        [productGroup]
      );
      return result.rows[0];
    } catch (error) {
      logger.error('Error deleting material percentage:', error);
      throw error;
    }
  }

  /**
   * Get master config value
   */
  async getMasterConfig(key) {
    try {
      const result = await this.pool.query(
        'SELECT config_value FROM fp_master_config WHERE config_key = $1',
        [key]
      );
      return result.rows[0]?.config_value || null;
    } catch (error) {
      logger.error('Error fetching master config:', error);
      throw error;
    }
  }

  /**
   * Set master config value
   */
  async setMasterConfig(key, value, description = null) {
    try {
      const query = `
        INSERT INTO fp_master_config (config_key, config_value, description)
        VALUES ($1, $2, $3)
        ON CONFLICT (config_key) 
        DO UPDATE SET 
          config_value = EXCLUDED.config_value,
          description = EXCLUDED.description,
          updated_at = CURRENT_TIMESTAMP
        RETURNING *
      `;
      
      const result = await this.pool.query(query, [key, value, description]);
      return result.rows[0];
    } catch (error) {
      logger.error('Error setting master config:', error);
      throw error;
    }
  }

  /**
   * Get yearly budget total for a specific sales rep and year
   */
  async getYearlyBudget(salesRep, year, valuesType, groupMembers = null) {
    try {
      let query;
      let params;

      if (groupMembers && Array.isArray(groupMembers)) {
        // It's a group - get yearly budget for all members
        const placeholders = groupMembers.map((_, index) => `$${index + 1}`).join(', ');
        query = `
          SELECT SUM(values) as total_value 
          FROM fp_data_excel 
          WHERE TRIM(UPPER(salesrepname)) IN (${placeholders}) 
          AND year = $${groupMembers.length + 1}
          AND UPPER(values_type) = UPPER($${groupMembers.length + 2})
          AND UPPER(type) = UPPER($${groupMembers.length + 3})
          AND values IS NOT NULL
        `;
        params = [
          ...groupMembers.map(n => String(n).trim().toUpperCase()),
          year,
          valuesType,
          'Budget'
        ];
      } else {
        // It's an individual sales rep
        query = `
          SELECT SUM(values) as total_value 
          FROM fp_data_excel 
          WHERE TRIM(UPPER(salesrepname)) = TRIM(UPPER($1)) 
          AND year = $2
          AND UPPER(values_type) = UPPER($3)
          AND UPPER(type) = UPPER($4)
          AND values IS NOT NULL
        `;
        params = [salesRep, year, valuesType, 'Budget'];
      }

      const result = await this.pool.query(query, params);
      const totalValue = parseFloat(result.rows[0]?.total_value || 0);
      
      logger.info(`📊 Yearly budget query result for ${salesRep} (${year}, ${valuesType}): ${totalValue}`);
      
      return totalValue;
    } catch (error) {
      logger.error('Error fetching yearly budget:', error);
      throw error;
    }
  }
}

module.exports = new FPDataService();