/**
 * Database Operations Routes
 * Handles database queries, country data, customer data, and geographic distribution
 */

const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');
const { getDivisionPool } = require('../utils/divisionDatabaseManager');
const WorldCountriesService = require('../database/WorldCountriesService');
const UniversalSalesByCountryService = require('../database/UniversalSalesByCountryService');
const GeographicDistributionService = require('../database/GeographicDistributionService');
const CustomerInsightsService = require('../database/CustomerInsightsService');

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

module.exports = router;
