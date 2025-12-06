/**
 * Excel File Routes
 * Handles Excel file downloads for divisions
 */

const express = require('express');
const router = express.Router();
const path = require('path');
const logger = require('../utils/logger');

// GET /financials/:division.xlsx - Download Excel file for specific division
router.get('/financials/:division.xlsx', (req, res) => {
  const { division } = req.params;
  const filePath = path.join(__dirname, '..', 'data', `financials-${division}.xlsx`);
  
  logger.info('Excel file requested', { division, filePath });
  res.download(filePath, `financials-${division}.xlsx`, (err) => {
    if (err) {
      logger.error('Error downloading Excel file', { division, error: err.message });
      res.status(404).json({ success: false, error: 'File not found' });
    }
  });
});

// GET /financials-fp.xlsx - Download FP Excel file
router.get('/financials-fp.xlsx', (req, res) => {
  const filePath = path.join(__dirname, '..', 'data', 'financials-fp.xlsx');
  res.download(filePath);
});

// GET /excel-data - Get Excel data information
router.get('/excel-data', (req, res) => {
  res.json({ success: true, message: 'Excel data endpoint' });
});

// GET /sales.xlsx - Download sales Excel file
router.get('/sales.xlsx', (req, res) => {
  const filePath = path.join(__dirname, '..', 'XL_FPSALESVSCOST_IP.odc');
  
  res.download(filePath, 'sales.xlsx', (err) => {
    if (err) {
      logger.error('Error downloading sales file', { error: err.message });
      res.status(404).json({ success: false, error: 'Sales file not found' });
    }
  });
});

module.exports = router;
