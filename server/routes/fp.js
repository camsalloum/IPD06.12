/**
 * FP Division Master Data Routes
 * Handles product groups, pricing, material percentages for FP division
 */

const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');
const fpDataService = require('../database/FPDataService');
const productPricingRoundingService = require('../database/ProductPricingRoundingService');

// GET /sales-reps - Get all sales reps from FP database
router.get('/sales-reps', async (req, res) => {
  try {
    const salesReps = await fpDataService.getSalesReps();
    res.json({ success: true, data: salesReps });
  } catch (error) {
    logger.error('Error fetching FP sales reps', { error: error.message });
    res.status(500).json({ success: false, error: 'Failed to fetch sales reps' });
  }
});

// GET /master-data/test - Test master data connection
router.get('/master-data/test', async (req, res) => {
  try {
    const result = await fpDataService.testMasterDataConnection();
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error('FP master data test failed', { error: error.message });
    res.status(500).json({ success: false, error: 'Master data connection test failed' });
  }
});

// GET /master-data/product-groups - Get all product groups
router.get('/master-data/product-groups', async (req, res) => {
  try {
    const productGroups = await fpDataService.getProductGroups();
    res.json({ success: true, data: productGroups });
  } catch (error) {
    logger.error('Error fetching FP product groups', { error: error.message });
    res.status(500).json({ success: false, error: 'Failed to fetch product groups' });
  }
});

// GET /master-data/product-pricing-years - Get available pricing years
router.get('/master-data/product-pricing-years', async (req, res) => {
  try {
    const years = await fpDataService.getProductGroupPricingYears();
    res.json({ success: true, data: years });
  } catch (error) {
    logger.error('Error fetching FP pricing years', { error: error.message });
    res.status(500).json({ success: false, error: 'Failed to fetch pricing years' });
  }
});

// GET /master-data/product-pricing - Get product pricing data
router.get('/master-data/product-pricing', async (req, res) => {
  try {
    const { year } = req.query;
    const pricing = await fpDataService.getProductGroupPricingAverages(year);
    res.json({ success: true, data: pricing });
  } catch (error) {
    logger.error('Error fetching FP product pricing', { error: error.message });
    res.status(500).json({ success: false, error: 'Failed to fetch product pricing' });
  }
});

// GET /master-data/product-pricing-rounded - Get rounded pricing data
router.get('/master-data/product-pricing-rounded', async (req, res) => {
  try {
    const { year } = req.query;
    const roundedPricing = await productPricingRoundingService.getRoundedPrices('FP', year);
    res.json({ success: true, data: roundedPricing });
  } catch (error) {
    logger.error('Error fetching FP rounded pricing', { error: error.message });
    res.status(500).json({ success: false, error: 'Failed to fetch rounded pricing' });
  }
});

// POST /master-data/product-pricing-rounded - Save rounded pricing data
router.post('/master-data/product-pricing-rounded', async (req, res) => {
  try {
    const { year, roundedData } = req.body;
    
    if (!year || !roundedData) {
      return res.status(400).json({ success: false, error: 'Year and rounded data are required' });
    }
    
    await productPricingRoundingService.saveRoundedPrices('FP', year, roundedData);
    logger.info('FP rounded pricing saved', { year });
    
    res.json({ success: true, message: 'Rounded pricing saved successfully' });
  } catch (error) {
    logger.error('Error saving FP rounded pricing', { error: error.message });
    res.status(500).json({ success: false, error: 'Failed to save rounded pricing' });
  }
});

// GET /master-data/material-percentages - Get material percentages
router.get('/master-data/material-percentages', async (req, res) => {
  try {
    const percentages = await fpDataService.getMaterialPercentages();
    res.json({ success: true, data: percentages });
  } catch (error) {
    logger.error('Error fetching FP material percentages', { error: error.message });
    res.status(500).json({ success: false, error: 'Failed to fetch material percentages' });
  }
});

// POST /master-data/material-percentages - Save material percentages
router.post('/master-data/material-percentages', async (req, res) => {
  try {
    const { percentages } = req.body;
    
    if (!percentages) {
      return res.status(400).json({ success: false, error: 'Percentages are required' });
    }
    
    await fpDataService.saveMaterialPercentages(percentages);
    logger.info('FP material percentages saved');
    
    res.json({ success: true, message: 'Material percentages saved successfully' });
  } catch (error) {
    logger.error('Error saving FP material percentages', { error: error.message });
    res.status(500).json({ success: false, error: 'Failed to save material percentages' });
  }
});

// POST /master-data/initialize - Initialize master data tables
router.post('/master-data/initialize', async (req, res) => {
  try {
    await fpDataService.initializeMasterDataTables();
    logger.info('FP master data tables initialized');
    
    res.json({ success: true, message: 'Master data tables initialized successfully' });
  } catch (error) {
    logger.error('Error initializing FP master data', { error: error.message });
    res.status(500).json({ success: false, error: 'Failed to initialize master data tables' });
  }
});

// GET /product-groups - Get FP product groups with sales data
router.get('/product-groups', async (req, res) => {
  try {
    const productGroups = await fpDataService.getProductGroupsWithSales();
    res.json({ success: true, data: productGroups });
  } catch (error) {
    logger.error('Error fetching FP product groups with sales', { error: error.message });
    res.status(500).json({ success: false, error: 'Failed to fetch product groups' });
  }
});

// GET /sales-data - Get FP sales data
router.get('/sales-data', async (req, res) => {
  try {
    const salesData = await fpDataService.getSalesData(req.query);
    res.json({ success: true, data: salesData });
  } catch (error) {
    logger.error('Error fetching FP sales data', { error: error.message });
    res.status(500).json({ success: false, error: 'Failed to fetch sales data' });
  }
});

// GET /sales-reps-from-db - Get sales reps from database
router.get('/sales-reps-from-db', async (req, res) => {
  try {
    const salesReps = await fpDataService.getSalesRepsFromDB();
    res.json({ success: true, data: salesReps });
  } catch (error) {
    logger.error('Error fetching FP sales reps from DB', { error: error.message });
    res.status(500).json({ success: false, error: 'Failed to fetch sales reps' });
  }
});

// POST /sales-rep-dashboard - Get sales rep dashboard data
router.post('/sales-rep-dashboard', async (req, res) => {
  try {
    const dashboardData = await fpDataService.getSalesRepDashboard(req.body);
    res.json({ success: true, data: dashboardData });
  } catch (error) {
    logger.error('Error fetching FP sales rep dashboard', { error: error.message });
    res.status(500).json({ success: false, error: 'Failed to fetch dashboard data' });
  }
});

// POST /customer-dashboard - Get customer dashboard data
router.post('/customer-dashboard', async (req, res) => {
  try {
    const dashboardData = await fpDataService.getCustomerDashboard(req.body);
    res.json({ success: true, data: dashboardData });
  } catch (error) {
    logger.error('Error fetching FP customer dashboard', { error: error.message });
    res.status(500).json({ success: false, error: 'Failed to fetch dashboard data' });
  }
});

// POST /yearly-budget - Get yearly budget data
router.post('/yearly-budget', async (req, res) => {
  try {
    const budgetData = await fpDataService.getYearlyBudget(req.body);
    res.json({ success: true, data: budgetData });
  } catch (error) {
    logger.error('Error fetching FP yearly budget', { error: error.message });
    res.status(500).json({ success: false, error: 'Failed to fetch budget data' });
  }
});

// POST /sales-by-country - Get sales by country
router.post('/sales-by-country', async (req, res) => {
  try {
    const salesData = await fpDataService.getSalesByCountry(req.body);
    res.json({ success: true, data: salesData });
  } catch (error) {
    logger.error('Error fetching FP sales by country', { error: error.message });
    res.status(500).json({ success: false, error: 'Failed to fetch sales data' });
  }
});

// GET /countries - Get all countries
router.get('/countries', async (req, res) => {
  try {
    const countries = await fpDataService.getCountries();
    res.json({ success: true, data: countries });
  } catch (error) {
    logger.error('Error fetching FP countries', { error: error.message });
    res.status(500).json({ success: false, error: 'Failed to fetch countries' });
  }
});

// GET /countries-by-sales-rep - Get countries filtered by sales rep
router.get('/countries-by-sales-rep', async (req, res) => {
  try {
    const { salesRep } = req.query;
    const countries = await fpDataService.getCountriesBySalesRep(salesRep);
    res.json({ success: true, data: countries });
  } catch (error) {
    logger.error('Error fetching FP countries by sales rep', { error: error.message });
    res.status(500).json({ success: false, error: 'Failed to fetch countries' });
  }
});

// NOTE: /product-performance route is handled by fpPerformanceRoutes for comprehensive data

// GET /all-customers - Get all customers
router.get('/all-customers', async (req, res) => {
  try {
    const customers = await fpDataService.getAllCustomers();
    res.json({ success: true, data: customers });
  } catch (error) {
    logger.error('Error fetching FP customers', { error: error.message });
    res.status(500).json({ success: false, error: 'Failed to fetch customers' });
  }
});

module.exports = router;
