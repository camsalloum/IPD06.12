/**
 * HC Division Master Data Routes
 * Handles product groups, pricing, material percentages for HC division
 */

const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');
const hcDataService = require('../database/HCDataService');
const productPricingRoundingService = require('../database/ProductPricingRoundingService');

// GET /master-data/product-groups - Get all product groups
router.get('/master-data/product-groups', async (req, res) => {
  try {
    const productGroups = await hcDataService.getProductGroups();
    res.json({ success: true, data: productGroups });
  } catch (error) {
    logger.error('Error fetching HC product groups', { error: error.message });
    res.status(500).json({ success: false, error: 'Failed to fetch product groups' });
  }
});

// GET /master-data/product-pricing-years - Get available pricing years
router.get('/master-data/product-pricing-years', async (req, res) => {
  try {
    const years = await hcDataService.getProductPricingYears();
    res.json({ success: true, data: years });
  } catch (error) {
    logger.error('Error fetching HC pricing years', { error: error.message });
    res.status(500).json({ success: false, error: 'Failed to fetch pricing years' });
  }
});

// GET /master-data/product-pricing - Get product pricing data
router.get('/master-data/product-pricing', async (req, res) => {
  try {
    const { year } = req.query;
    const pricing = await hcDataService.getProductPricing(year);
    res.json({ success: true, data: pricing });
  } catch (error) {
    logger.error('Error fetching HC product pricing', { error: error.message });
    res.status(500).json({ success: false, error: 'Failed to fetch product pricing' });
  }
});

// GET /master-data/product-pricing-rounded - Get rounded pricing data
router.get('/master-data/product-pricing-rounded', async (req, res) => {
  try {
    const { year } = req.query;
    const roundedPricing = await productPricingRoundingService.getRoundedPrices('HC', year);
    res.json({ success: true, data: roundedPricing });
  } catch (error) {
    logger.error('Error fetching HC rounded pricing', { error: error.message });
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
    
    await productPricingRoundingService.saveRoundedPrices('HC', year, roundedData);
    logger.info('HC rounded pricing saved', { year });
    
    res.json({ success: true, message: 'Rounded pricing saved successfully' });
  } catch (error) {
    logger.error('Error saving HC rounded pricing', { error: error.message });
    res.status(500).json({ success: false, error: 'Failed to save rounded pricing' });
  }
});

// GET /master-data/material-percentages - Get material percentages
router.get('/master-data/material-percentages', async (req, res) => {
  try {
    const percentages = await hcDataService.getMaterialPercentages();
    res.json({ success: true, data: percentages });
  } catch (error) {
    logger.error('Error fetching HC material percentages', { error: error.message });
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
    
    await hcDataService.saveMaterialPercentages(percentages);
    logger.info('HC material percentages saved');
    
    res.json({ success: true, message: 'Material percentages saved successfully' });
  } catch (error) {
    logger.error('Error saving HC material percentages', { error: error.message });
    res.status(500).json({ success: false, error: 'Failed to save material percentages' });
  }
});

// POST /master-data/initialize - Initialize master data tables
router.post('/master-data/initialize', async (req, res) => {
  try {
    await hcDataService.initializeMasterDataTables();
    logger.info('HC master data tables initialized');
    
    res.json({ success: true, message: 'Master data tables initialized successfully' });
  } catch (error) {
    logger.error('Error initializing HC master data', { error: error.message });
    res.status(500).json({ success: false, error: 'Failed to initialize master data tables' });
  }
});

module.exports = router;
