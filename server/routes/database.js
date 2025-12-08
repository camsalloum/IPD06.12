/**
 * Database Operations Routes
 * Handles database queries, country data, customer data, and geographic distribution
 */

const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');
const { pool } = require('../database/config');
const { getDivisionPool } = require('../utils/divisionDatabaseManager');
const WorldCountriesService = require('../database/WorldCountriesService');
const UniversalSalesByCountryService = require('../database/UniversalSalesByCountryService');
const GeographicDistributionService = require('../database/GeographicDistributionService');
const CustomerInsightsService = require('../database/CustomerInsightsService');

// Path to sales rep config file
const SALES_REP_CONFIG_PATH = path.join(__dirname, '..', 'data', 'sales-reps-config.json');

// Helper to load sales rep config
function loadSalesRepConfig() {
  try {
    if (fs.existsSync(SALES_REP_CONFIG_PATH)) {
      const data = fs.readFileSync(SALES_REP_CONFIG_PATH, 'utf8');
      return JSON.parse(data);
    }
    return {};
  } catch (error) {
    logger.error('Error loading sales rep config', { error: error.message });
    return {};
  }
}

// Helper to save sales rep config
function saveSalesRepConfig(config) {
  try {
    fs.writeFileSync(SALES_REP_CONFIG_PATH, JSON.stringify(config, null, 2));
    return true;
  } catch (error) {
    logger.error('Error saving sales rep config', { error: error.message });
    return false;
  }
}

// GET /countries-db - Get countries from database
router.get('/countries-db', async (req, res) => {
  try {
    const { division } = req.query;
    const worldCountriesService = new WorldCountriesService(division);
    const countries = await worldCountriesService.getCountries();
    res.json({ success: true, data: countries });
  } catch (error) {
    logger.error('Error fetching countries from DB', { error: error.message });
    res.status(500).json({ success: false, error: 'Failed to fetch countries' });
  }
});

// GET /sales-reps-defaults - Get sales rep defaults for a division
router.get('/sales-reps-defaults', async (req, res) => {
  try {
    const { division } = req.query;
    const divPool = division ? getDivisionPool(division) : pool;
    const actualPool = await divPool;
    
    // Try to get from sales_rep_defaults table if exists
    try {
      const result = await actualPool.query('SELECT * FROM sales_rep_defaults ORDER BY salesrepname');
      res.json({ success: true, data: result.rows });
    } catch (tableError) {
      // Table might not exist, return empty array
      logger.warn('sales_rep_defaults table not found, returning empty', { division });
      res.json({ success: true, data: [] });
    }
  } catch (error) {
    logger.error('Error fetching sales rep defaults', { error: error.message });
    res.status(500).json({ success: false, error: 'Failed to fetch sales rep defaults' });
  }
});

// GET /all-countries - Get all countries
router.get('/all-countries', async (req, res) => {
  try {
    const { division } = req.query;
    const pool = await getDivisionPool(division);
    const tableName = `${division.toLowerCase()}_data_excel`;
    
    const result = await pool.query(
      `SELECT DISTINCT country FROM ${tableName} WHERE country IS NOT NULL ORDER BY country`
    );
    
    res.json({ success: true, data: result.rows });
  } catch (error) {
    logger.error('Error fetching all countries', { error: error.message });
    res.status(500).json({ success: false, error: 'Failed to fetch countries' });
  }
});

// POST /sales-by-country-db - Get sales by country from database
router.post('/sales-by-country-db', async (req, res) => {
  try {
    const { division, filters } = req.body;
    const salesService = new UniversalSalesByCountryService(division);
    const salesData = await salesService.getSalesByCountry(filters);
    res.json({ success: true, data: salesData });
  } catch (error) {
    logger.error('Error fetching sales by country', { error: error.message });
    res.status(500).json({ success: false, error: 'Failed to fetch sales data' });
  }
});

// GET /countries-by-sales-rep-db - Get countries by sales rep
router.get('/countries-by-sales-rep-db', async (req, res) => {
  try {
    const { division, salesRep } = req.query;
    const pool = await getDivisionPool(division);
    const tableName = `${division.toLowerCase()}_data_excel`;
    
    const result = await pool.query(
      `SELECT DISTINCT country FROM ${tableName} 
       WHERE salesrepname = $1 AND country IS NOT NULL 
       ORDER BY country`,
      [salesRep]
    );
    
    res.json({ success: true, data: result.rows });
  } catch (error) {
    logger.error('Error fetching countries by sales rep', { error: error.message });
    res.status(500).json({ success: false, error: 'Failed to fetch countries' });
  }
});

// GET /unassigned-countries - Get unassigned countries
router.get('/unassigned-countries', async (req, res) => {
  try {
    const { division } = req.query;
    const worldCountriesService = new WorldCountriesService(division || 'FP');
    const unassignedData = await worldCountriesService.getUnassignedCountries(division || 'FP');
    res.json({ success: true, data: unassignedData });
  } catch (error) {
    logger.error('Error fetching unassigned countries', { error: error.message });
    res.status(500).json({ success: false, error: 'Failed to fetch unassigned countries' });
  }
});

// POST /geographic-distribution - Get geographic distribution data
router.post('/geographic-distribution', async (req, res) => {
  try {
    const { division, filters } = req.body;
    const geoService = new GeographicDistributionService(division);
    const distribution = await geoService.getDistribution(filters);
    res.json({ success: true, data: distribution });
  } catch (error) {
    logger.error('Error fetching geographic distribution', { error: error.message });
    res.status(500).json({ success: false, error: 'Failed to fetch distribution data' });
  }
});

// POST /customer-insights-db - Get customer insights from database
router.post('/customer-insights-db', async (req, res) => {
  try {
    const { division, customer, filters } = req.body;
    const insightsService = new CustomerInsightsService(division);
    const insights = await insightsService.getCustomerInsights(customer, filters);
    res.json({ success: true, data: insights });
  } catch (error) {
    logger.error('Error fetching customer insights', { error: error.message });
    res.status(500).json({ success: false, error: 'Failed to fetch insights' });
  }
});

// POST /country-sales-data-db - Get country sales data
router.post('/country-sales-data-db', async (req, res) => {
  try {
    const { division, country, filters } = req.body;
    const pool = await getDivisionPool(division);
    const tableName = `${division.toLowerCase()}_data_excel`;
    
    const result = await pool.query(
      `SELECT * FROM ${tableName} WHERE country = $1`,
      [country]
    );
    
    res.json({ success: true, data: result.rows });
  } catch (error) {
    logger.error('Error fetching country sales data', { error: error.message });
    res.status(500).json({ success: false, error: 'Failed to fetch sales data' });
  }
});

// GET /customers-db - Get customers from database
router.get('/customers-db', async (req, res) => {
  try {
    const { division } = req.query;
    const pool = await getDivisionPool(division);
    const tableName = `${division.toLowerCase()}_data_excel`;
    
    const result = await pool.query(
      `SELECT DISTINCT customername FROM ${tableName} 
       WHERE customername IS NOT NULL 
       ORDER BY customername`
    );
    
    res.json({ success: true, data: result.rows });
  } catch (error) {
    logger.error('Error fetching customers from DB', { error: error.message });
    res.status(500).json({ success: false, error: 'Failed to fetch customers' });
  }
});

// POST /sales-by-customer-db - Get sales by customer
router.post('/sales-by-customer-db', async (req, res) => {
  try {
    const { division, customer, filters } = req.body;
    const pool = await getDivisionPool(division);
    const tableName = `${division.toLowerCase()}_data_excel`;
    
    const result = await pool.query(
      `SELECT * FROM ${tableName} WHERE customername = $1`,
      [customer]
    );
    
    res.json({ success: true, data: result.rows });
  } catch (error) {
    logger.error('Error fetching sales by customer', { error: error.message });
    res.status(500).json({ success: false, error: 'Failed to fetch sales data' });
  }
});

// GET /customers-by-salesrep-db - Get customers by sales rep
router.get('/customers-by-salesrep-db', async (req, res) => {
  try {
    const { division, salesRep } = req.query;
    const pool = await getDivisionPool(division);
    const tableName = `${division.toLowerCase()}_data_excel`;
    
    const result = await pool.query(
      `SELECT DISTINCT customername FROM ${tableName} 
       WHERE salesrepname = $1 AND customername IS NOT NULL 
       ORDER BY customername`,
      [salesRep]
    );
    
    res.json({ success: true, data: result.rows });
  } catch (error) {
    logger.error('Error fetching customers by sales rep', { error: error.message });
    res.status(500).json({ success: false, error: 'Failed to fetch customers' });
  }
});

// GET /customer-sales-rep-mapping - Get customer to sales rep mapping
router.get('/customer-sales-rep-mapping', async (req, res) => {
  try {
    const { division } = req.query;
    const pool = await getDivisionPool(division);
    const tableName = `${division.toLowerCase()}_data_excel`;
    
    const result = await pool.query(
      `SELECT DISTINCT customername, salesrepname FROM ${tableName} 
       WHERE customername IS NOT NULL AND salesrepname IS NOT NULL 
       ORDER BY customername, salesrepname`
    );
    
    res.json({ success: true, data: result.rows });
  } catch (error) {
    logger.error('Error fetching customer-sales rep mapping', { error: error.message });
    res.status(500).json({ success: false, error: 'Failed to fetch mapping' });
  }
});

// POST /customer-sales-data-db - Get customer sales data from database
router.post('/customer-sales-data-db', async (req, res) => {
  try {
    const { division, customer, filters } = req.body;
    const pool = await getDivisionPool(division);
    const tableName = `${division.toLowerCase()}_data_excel`;
    
    let query = `SELECT * FROM ${tableName} WHERE customername = $1`;
    const params = [customer];
    
    // Add filters if provided
    if (filters?.year) {
      query += ` AND year = $${params.length + 1}`;
      params.push(filters.year);
    }
    
    const result = await pool.query(query, params);
    
    res.json({ success: true, data: result.rows });
  } catch (error) {
    logger.error('Error fetching customer sales data', { error: error.message });
    res.status(500).json({ success: false, error: 'Failed to fetch sales data' });
  }
});

// POST /sales-rep-divisional-batch - Batch sales rep data by division
router.post('/sales-rep-divisional-batch', async (req, res) => {
  try {
    const { division, salesReps } = req.body;
    const pool = await getDivisionPool(division);
    const tableName = `${division.toLowerCase()}_data_excel`;
    
    const result = await pool.query(
      `SELECT * FROM ${tableName} WHERE salesrepname = ANY($1)`,
      [salesReps]
    );
    
    res.json({ success: true, data: result.rows });
  } catch (error) {
    logger.error('Error fetching batch sales rep data', { error: error.message });
    res.status(500).json({ success: false, error: 'Failed to fetch data' });
  }
});

// POST /sales-rep-divisional-ultra-fast - Ultra-fast sales rep query
router.post('/sales-rep-divisional-ultra-fast', async (req, res) => {
  try {
    const { division, salesRep, filters } = req.body;
    const pool = await getDivisionPool(division);
    const tableName = `${division.toLowerCase()}_data_excel`;
    
    const result = await pool.query(
      `SELECT * FROM ${tableName} WHERE salesrepname = $1`,
      [salesRep]
    );
    
    res.json({ success: true, data: result.rows });
  } catch (error) {
    logger.error('Error in ultra-fast sales rep query', { error: error.message });
    res.status(500).json({ success: false, error: 'Failed to fetch data' });
  }
});

// POST /sales-by-customer-ultra-fast - Ultra-fast customer sales query
router.post('/sales-by-customer-ultra-fast', async (req, res) => {
  try {
    const { division, customer } = req.body;
    const pool = await getDivisionPool(division);
    const tableName = `${division.toLowerCase()}_data_excel`;
    
    const result = await pool.query(
      `SELECT * FROM ${tableName} WHERE customername = $1`,
      [customer]
    );
    
    res.json({ success: true, data: result.rows });
  } catch (error) {
    logger.error('Error in ultra-fast customer query', { error: error.message });
    res.status(500).json({ success: false, error: 'Failed to fetch data' });
  }
});

// POST /sales-rep-reports-ultra-fast - Ultra-fast sales rep reports
router.post('/sales-rep-reports-ultra-fast', async (req, res) => {
  try {
    const { division, salesRep, reportType } = req.body;
    const pool = await getDivisionPool(division);
    const tableName = `${division.toLowerCase()}_data_excel`;
    
    const result = await pool.query(
      `SELECT * FROM ${tableName} WHERE salesrepname = $1`,
      [salesRep]
    );
    
    res.json({ success: true, data: result.rows, reportType });
  } catch (error) {
    logger.error('Error in ultra-fast reports', { error: error.message });
    res.status(500).json({ success: false, error: 'Failed to generate reports' });
  }
});

// GET /sales-rep-groups-universal - Get sales rep groups from JSON config
router.get('/sales-rep-groups-universal', async (req, res) => {
  try {
    const { division } = req.query;
    const config = loadSalesRepConfig();
    
    if (division) {
      const divisionConfig = config[division.toUpperCase()] || { groups: {} };
      res.json({ success: true, data: divisionConfig.groups || {} });
    } else {
      // Return all divisions' groups
      const allGroups = {};
      Object.keys(config).forEach(div => {
        allGroups[div] = config[div]?.groups || {};
      });
      res.json({ success: true, data: allGroups });
    }
  } catch (error) {
    logger.error('Error fetching sales rep groups', { error: error.message });
    res.status(500).json({ success: false, error: 'Failed to fetch sales rep groups' });
  }
});

// POST /sales-rep-groups-universal - Save sales rep group
router.post('/sales-rep-groups-universal', async (req, res) => {
  try {
    const { division, groupName, members } = req.body;
    
    if (!division || !groupName) {
      return res.status(400).json({ success: false, error: 'Division and group name are required' });
    }
    
    const config = loadSalesRepConfig();
    const divKey = division.toUpperCase();
    
    if (!config[divKey]) {
      config[divKey] = { defaults: [], groups: {} };
    }
    
    config[divKey].groups[groupName] = members || [];
    
    if (saveSalesRepConfig(config)) {
      logger.info('Sales rep group saved', { division: divKey, groupName });
      res.json({ success: true, message: 'Group saved successfully' });
    } else {
      res.status(500).json({ success: false, error: 'Failed to save group' });
    }
  } catch (error) {
    logger.error('Error saving sales rep group', { error: error.message });
    res.status(500).json({ success: false, error: 'Failed to save sales rep group' });
  }
});

// DELETE /sales-rep-groups-universal - Delete sales rep group
router.delete('/sales-rep-groups-universal', async (req, res) => {
  try {
    const { division, groupName } = req.query;
    
    if (!division || !groupName) {
      return res.status(400).json({ success: false, error: 'Division and group name are required' });
    }
    
    const config = loadSalesRepConfig();
    const divKey = division.toUpperCase();
    
    if (config[divKey] && config[divKey].groups) {
      delete config[divKey].groups[groupName];
      
      if (saveSalesRepConfig(config)) {
        logger.info('Sales rep group deleted', { division: divKey, groupName });
        res.json({ success: true, message: 'Group deleted successfully' });
      } else {
        res.status(500).json({ success: false, error: 'Failed to delete group' });
      }
    } else {
      res.json({ success: true, message: 'Group not found, nothing to delete' });
    }
  } catch (error) {
    logger.error('Error deleting sales rep group', { error: error.message });
    res.status(500).json({ success: false, error: 'Failed to delete sales rep group' });
  }
});

module.exports = router;
