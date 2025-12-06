/**
 * Admin Routes
 * Handles administrative operations like division sync
 */

const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');
const { syncAllTablesToAllDivisions, getActiveDivisions } = require('../utils/divisionDatabaseManager');

// POST /sync-divisions - Sync tables across all divisions
router.post('/sync-divisions', async (req, res) => {
  try {
    logger.info('Starting division sync...');
    const result = await syncAllTablesToAllDivisions();
    
    logger.info('Division sync completed', { tablesCreated: result.synced });
    res.json({ 
      success: true, 
      message: 'Division sync completed', 
      tablesCreated: result.synced 
    });
  } catch (error) {
    logger.error('Error syncing divisions', { error: error.message });
    res.status(500).json({ success: false, error: 'Failed to sync divisions' });
  }
});

// GET /divisions - Get all active divisions
router.get('/divisions', async (req, res) => {
  try {
    const divisions = await getActiveDivisions();
    res.json({ success: true, data: divisions });
  } catch (error) {
    logger.error('Error fetching divisions', { error: error.message });
    res.status(500).json({ success: false, error: 'Failed to fetch divisions' });
  }
});

module.exports = router;
