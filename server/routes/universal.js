/**
 * Universal/Division-Agnostic Routes
 * Handles routes that work across multiple divisions
 */

const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');
const { getDivisionPool } = require('../utils/divisionDatabaseManager');

// GET / - Home route
router.get('/', (req, res) => {
  res.json({ message: 'IPDashboard API - v2.0' });
});

// GET /db/test - Test database connection
router.get('/db/test', async (req, res) => {
  try {
    const { pool } = require('../database/config');
    const result = await pool.query('SELECT NOW()');
    res.json({ 
      success: true, 
      message: 'Database connection successful', 
      timestamp: result.rows[0].now 
    });
  } catch (error) {
    logger.error('Database test failed', { error: error.message });
    res.status(500).json({ success: false, error: 'Database connection failed' });
  }
});

// GET /division-info - Get division information
router.get('/division-info', async (req, res) => {
  try {
    const { division } = req.query;
    
    if (!division) {
      return res.status(400).json({ success: false, error: 'Division parameter is required' });
    }
    
    const divisionData = {
      division: division.toUpperCase(),
      status: division.toLowerCase() === 'fp' || division.toLowerCase() === 'hc' ? 'active' : 'coming soon',
      database: division.toLowerCase() === 'fp' ? 'fp_database' : 
                division.toLowerCase() === 'hc' ? 'hc_database' : null,
      table: division.toLowerCase() === 'fp' || division.toLowerCase() === 'hc' ? 
             `${division.toLowerCase()}_data_excel` : null
    };
    
    res.json({ success: true, data: divisionData });
  } catch (error) {
    logger.error('Error fetching division info', { error: error.message });
    res.status(500).json({ success: false, error: 'Failed to fetch division info' });
  }
});

// GET /product-groups-universal - Get product groups across divisions
router.get('/product-groups-universal', async (req, res) => {
  try {
    const { division } = req.query;
    
    if (!division) {
      return res.status(400).json({ success: false, error: 'Division parameter is required' });
    }
    
    const pool = await getDivisionPool(division);
    const tableName = `${division.toLowerCase()}_data_excel`;
    
    const result = await pool.query(`
      SELECT DISTINCT productgroup 
      FROM ${tableName} 
      WHERE productgroup IS NOT NULL 
      ORDER BY productgroup
    `);
    
    res.json({ success: true, data: result.rows });
  } catch (error) {
    logger.error('Error fetching universal product groups', { error: error.message });
    res.status(500).json({ success: false, error: 'Failed to fetch product groups' });
  }
});

// GET /sales-reps-universal - Get sales reps across divisions
router.get('/sales-reps-universal', async (req, res) => {
  try {
    const { division } = req.query;
    
    if (!division) {
      return res.status(400).json({ success: false, error: 'Division parameter is required' });
    }
    
    const pool = await getDivisionPool(division);
    const tableName = `${division.toLowerCase()}_data_excel`;
    
    const result = await pool.query(`
      SELECT DISTINCT salesrepname 
      FROM ${tableName} 
      WHERE salesrepname IS NOT NULL 
      ORDER BY salesrepname
    `);
    
    res.json({ success: true, data: result.rows });
  } catch (error) {
    logger.error('Error fetching universal sales reps', { error: error.message });
    res.status(500).json({ success: false, error: 'Failed to fetch sales reps' });
  }
});

// POST /sales-rep-dashboard-universal - Get sales rep dashboard (universal)
router.post('/sales-rep-dashboard-universal', async (req, res) => {
  try {
    const { division, salesRep, filters } = req.body;
    
    if (!division || !salesRep) {
      return res.status(400).json({ success: false, error: 'Division and sales rep are required' });
    }
    
    const pool = await getDivisionPool(division);
    const tableName = `${division.toLowerCase()}_data_excel`;
    
    // Build query based on filters
    let query = `SELECT * FROM ${tableName} WHERE salesrepname = $1`;
    const params = [salesRep];
    
    const result = await pool.query(query, params);
    
    res.json({ success: true, data: result.rows });
  } catch (error) {
    logger.error('Error fetching universal sales rep dashboard', { error: error.message });
    res.status(500).json({ success: false, error: 'Failed to fetch dashboard data' });
  }
});

// POST /customer-dashboard-universal - Get customer dashboard (universal)
router.post('/customer-dashboard-universal', async (req, res) => {
  try {
    const { division, customer, filters } = req.body;
    
    if (!division || !customer) {
      return res.status(400).json({ success: false, error: 'Division and customer are required' });
    }
    
    const pool = await getDivisionPool(division);
    const tableName = `${division.toLowerCase()}_data_excel`;
    
    let query = `SELECT * FROM ${tableName} WHERE customername = $1`;
    const params = [customer];
    
    const result = await pool.query(query, params);
    
    res.json({ success: true, data: result.rows });
  } catch (error) {
    logger.error('Error fetching universal customer dashboard', { error: error.message });
    res.status(500).json({ success: false, error: 'Failed to fetch dashboard data' });
  }
});

// POST /customer-dashboard-amount - Get customer dashboard with amount calculation
router.post('/customer-dashboard-amount', async (req, res) => {
  try {
    const { division, customer, filters } = req.body;
    
    if (!division || !customer) {
      return res.status(400).json({ success: false, error: 'Division and customer are required' });
    }
    
    const pool = await getDivisionPool(division);
    const tableName = `${division.toLowerCase()}_data_excel`;
    
    const query = `
      SELECT *, 
             CAST(REPLACE(REPLACE(value, ',', ''), ' ', '') AS NUMERIC) as amount
      FROM ${tableName} 
      WHERE customername = $1 
        AND values_type = 'AMOUNT'
    `;
    
    const result = await pool.query(query, [customer]);
    
    res.json({ success: true, data: result.rows });
  } catch (error) {
    logger.error('Error fetching customer dashboard with amount', { error: error.message });
    res.status(500).json({ success: false, error: 'Failed to fetch dashboard data' });
  }
});

module.exports = router;
