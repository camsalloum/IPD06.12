/**
 * Sales Data Routes
 * Handles sales data retrieval for product groups and sales reps
 */

const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');
const fpDataService = require('../database/FPDataService');
const hcDataService = require('../database/HCDataService');
const UniversalSalesByCountryService = require('../database/UniversalSalesByCountryService');

const SALES_REP_CONFIG_PATH = path.join(__dirname, '..', 'data', 'sales-rep-config.json');

// Helper functions for sales rep groups
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

function isSalesRepGroup(division, salesRepName) {
  const config = loadSalesRepConfig();
  const divisionConfig = config[division];
  return divisionConfig && divisionConfig.groups && divisionConfig.groups[salesRepName] !== undefined;
}

function getGroupMembers(division, groupName) {
  const config = loadSalesRepConfig();
  const divisionConfig = config[division];
  return divisionConfig?.groups?.[groupName] || [];
}

// GET /sales-data - Legacy endpoint for Sales.xlsx reference
router.get('/sales-data', (req, res) => {
  try {
    const XLSX = require('xlsx');
    const salesFilePath = path.join(__dirname, '..', 'data', 'Sales.xlsx');
    
    if (!fs.existsSync(salesFilePath)) {
      return res.json({ success: true, data: [] });
    }

    const workbook = XLSX.readFile(salesFilePath);
    const salesData = [];
    
    workbook.SheetNames.forEach(sheetName => {
      try {
        const worksheet = workbook.Sheets[sheetName];
        let data, rawData;
        
        if (sheetName.includes('-Countries')) {
          data = XLSX.utils.sheet_to_json(worksheet);
          rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        } else {
          data = XLSX.utils.sheet_to_json(worksheet);
        }
        
        salesData.push({
          sheetName: sheetName,
          data: data,
          rawData: rawData
        });
      } catch (sheetError) {
        logger.error('Error processing sheet', { sheetName, error: sheetError.message });
      }
    });
    
    res.json({ success: true, data: salesData });
    
  } catch (error) {
    logger.error('Error retrieving sales data', { error: error.message });
    res.status(500).json({ success: false, error: 'Failed to retrieve sales data' });
  }
});

// GET /fp/sales-data - Get sales data for FP division (legacy endpoint)
router.get('/fp/sales-data', async (req, res) => {
  try {
    const { salesRep, productGroup, valueType, year, month, dataType = 'actual' } = req.query;
    
    if (!salesRep || !productGroup || !year || !month) {
      return res.status(400).json({ 
        success: false, 
        error: 'salesRep, productGroup, year, and month are required' 
      });
    }
    
    const config = loadSalesRepConfig();
    const fpConfig = config.FP || { groups: {} };
    
    let salesData;
    
    if (fpConfig.groups && fpConfig.groups[salesRep]) {
      // Group data
      const groupMembers = fpConfig.groups[salesRep];
      
      if (valueType) {
        salesData = 0;
        for (const member of groupMembers) {
          const memberData = await fpDataService.getSalesDataByValueType(member, productGroup, valueType, year, month, dataType);
          salesData += memberData;
        }
      } else {
        salesData = await fpDataService.getSalesDataForGroup(groupMembers, productGroup, dataType, year, month);
      }
    } else {
      // Individual sales rep data
      if (valueType) {
        salesData = await fpDataService.getSalesDataByValueType(salesRep, productGroup, valueType, year, month, dataType);
      } else {
        salesData = await fpDataService.getSalesData(salesRep, productGroup, dataType, year, month);
      }
    }
    
    res.json({ success: true, data: salesData });
  } catch (error) {
    logger.error('Error fetching FP sales data', { error: error.message });
    res.status(500).json({ success: false, error: 'Failed to fetch sales data' });
  }
});

// GET /fp/sales-reps-from-db - Get sales reps from database
router.get('/fp/sales-reps-from-db', async (req, res) => {
  try {
    logger.info('Getting sales reps from fp_data table');
    
    const pool = require('../config/database');
    const client = await pool.connect();
    
    const salesRepsResult = await client.query(`
      SELECT DISTINCT salesrepname 
      FROM fp_data 
      WHERE salesrepname IS NOT NULL 
      AND TRIM(salesrepname) != ''
      AND salesrepname != '(blank)'
      ORDER BY salesrepname
    `);
    
    const salesReps = salesRepsResult.rows.map(row => row.salesrepname);
    
    client.release();
    
    logger.info('Sales reps retrieved from database', { count: salesReps.length });
    res.json({ success: true, data: salesReps });
    
  } catch (error) {
    logger.error('Error getting sales reps from database', { error: error.message });
    res.status(500).json({ success: false, error: 'Failed to retrieve sales representatives' });
  }
});

// POST /sales-rep-dashboard-universal - Universal sales rep dashboard
router.post('/sales-rep-dashboard-universal', async (req, res) => {
  try {
    const { division, salesRep, valueTypes = ['KGS', 'Amount'], periods = [] } = req.body;
    
    if (!division || !salesRep) {
      return res.status(400).json({ 
        success: false, 
        error: 'division and salesRep are required' 
      });
    }
    
    logger.info('Getting dashboard data', { division, salesRep, valueTypes, periods: periods.length });
    
    const isGroup = isSalesRepGroup(division, salesRep);
    let productGroups;
    
    if (isGroup) {
      const groupMembers = getGroupMembers(division, salesRep);
      const allProductGroups = new Set();
      
      for (const member of groupMembers) {
        try {
          const memberProductGroups = await UniversalSalesByCountryService.getProductGroupsBySalesRep(division, member);
          memberProductGroups.forEach(pg => allProductGroups.add(pg));
        } catch (memberError) {
          logger.warn('Failed to fetch product groups for member', { member, error: memberError.message });
        }
      }
      productGroups = Array.from(allProductGroups);
    } else {
      productGroups = await UniversalSalesByCountryService.getProductGroupsBySalesRep(division, salesRep);
    }
    
    // Build dashboard data
    const dashboardData = {};
    
    for (const productGroup of productGroups) {
      dashboardData[productGroup] = {};
      
      for (const valueType of valueTypes) {
        dashboardData[productGroup][valueType] = {};
        
        for (const period of periods) {
          const { year, month, type = 'Actual' } = period;
          
          let salesData;
          if (isGroup) {
            const groupMembers = getGroupMembers(division, salesRep);
            salesData = 0;
            for (const member of groupMembers) {
              let memberData;
              switch(division.toUpperCase()) {
                case 'FP':
                  memberData = await fpDataService.getSalesDataByValueType(member, productGroup, valueType, year, month, type);
                  break;
                case 'HC':
                  memberData = await hcDataService.getSalesDataByValueType(member, productGroup, valueType, year, month, type);
                  break;
                default:
                  memberData = await fpDataService.getSalesDataByValueType(member, productGroup, valueType, year, month, type);
              }
              salesData += memberData;
            }
          } else {
            switch(division.toUpperCase()) {
              case 'FP':
                salesData = await fpDataService.getSalesDataByValueType(salesRep, productGroup, valueType, year, month, type);
                break;
              case 'HC':
                salesData = await hcDataService.getSalesDataByValueType(salesRep, productGroup, valueType, year, month, type);
                break;
              default:
                salesData = await fpDataService.getSalesDataByValueType(salesRep, productGroup, valueType, year, month, type);
            }
          }
          
          dashboardData[productGroup][valueType][`${year}-${month}-${type}`] = salesData;
        }
      }
    }
    
    logger.info('Dashboard data retrieved', { productGroups: productGroups.length });
    
    res.json({
      success: true,
      data: {
        salesRep,
        productGroups,
        dashboardData,
        isGroup
      }
    });
    
  } catch (error) {
    logger.error('Error getting sales rep dashboard data', { error: error.message });
    res.status(500).json({ success: false, error: 'Failed to retrieve dashboard data' });
  }
});

// POST /fp/sales-rep-dashboard - Legacy FP dashboard (backward compatibility)
router.post('/fp/sales-rep-dashboard', async (req, res) => {
  try {
    const { salesRep, valueTypes = ['KGS', 'Amount'], periods = [] } = req.body;
    
    if (!salesRep) {
      return res.status(400).json({ 
        success: false, 
        error: 'salesRep is required' 
      });
    }
    
    const config = loadSalesRepConfig();
    const fpConfig = config.FP || { groups: {} };
    
    let productGroups;
    
    if (fpConfig.groups && fpConfig.groups[salesRep]) {
      const groupMembers = fpConfig.groups[salesRep];
      const allProductGroups = new Set();
      
      for (const member of groupMembers) {
        try {
          const memberProductGroups = await fpDataService.getProductGroupsBySalesRep(member);
          memberProductGroups.forEach(pg => allProductGroups.add(pg));
        } catch (memberError) {
          logger.warn('Failed to fetch product groups for member', { member, error: memberError.message });
        }
      }
      productGroups = Array.from(allProductGroups);
    } else {
      productGroups = await fpDataService.getProductGroupsBySalesRep(salesRep);
    }
    
    const dashboardData = {};
    
    for (const productGroup of productGroups) {
      dashboardData[productGroup] = {};
      
      for (const valueType of valueTypes) {
        dashboardData[productGroup][valueType] = {};
        
        for (const period of periods) {
          const { year, month, type = 'Actual' } = period;
          
          let salesData;
          if (fpConfig.groups && fpConfig.groups[salesRep]) {
            const groupMembers = fpConfig.groups[salesRep];
            salesData = await fpDataService.getSalesDataForGroup(groupMembers, productGroup, valueType, year, month, type);
          } else {
            salesData = await fpDataService.getSalesDataByValueType(salesRep, productGroup, valueType, year, month, type);
          }
          
          dashboardData[productGroup][valueType][`${year}-${month}-${type}`] = salesData;
        }
      }
    }
    
    res.json({
      success: true,
      data: {
        salesRep,
        productGroups,
        dashboardData,
        isGroup: !!(fpConfig.groups && fpConfig.groups[salesRep])
      }
    });
    
  } catch (error) {
    logger.error('Error getting FP sales rep dashboard data', { error: error.message });
    res.status(500).json({ success: false, error: 'Failed to retrieve dashboard data' });
  }
});

// POST /fp/customer-dashboard - Legacy FP customer dashboard
router.post('/fp/customer-dashboard', async (req, res) => {
  try {
    const { salesRep, periods = [] } = req.body;
    
    if (!salesRep) {
      return res.status(400).json({ 
        success: false, 
        error: 'salesRep is required' 
      });
    }
    
    const config = loadSalesRepConfig();
    const fpConfig = config.FP || { groups: {} };
    
    let customers;
    
    if (fpConfig.groups && fpConfig.groups[salesRep]) {
      const groupMembers = fpConfig.groups[salesRep];
      customers = await fpDataService.getCustomersForGroup(groupMembers);
    } else {
      customers = await fpDataService.getCustomersBySalesRep(salesRep);
    }
    
    const dashboardData = {};
    
    for (const customer of customers) {
      dashboardData[customer] = {};
      
      for (const period of periods) {
        const { year, month, type = 'Actual' } = period;
        
        let salesData;
        if (fpConfig.groups && fpConfig.groups[salesRep]) {
          const groupMembers = fpConfig.groups[salesRep];
          salesData = await fpDataService.getCustomerSalesDataForGroup(groupMembers, customer, 'KGS', year, month, type);
        } else {
          salesData = await fpDataService.getCustomerSalesDataByValueType(salesRep, customer, 'KGS', year, month, type);
        }
        
        dashboardData[customer][`${year}-${month}-${type}`] = salesData;
      }
    }
    
    res.json({
      success: true,
      data: {
        salesRep,
        customers,
        dashboardData,
        isGroup: !!(fpConfig.groups && fpConfig.groups[salesRep])
      }
    });
    
  } catch (error) {
    logger.error('Error getting FP customer dashboard data', { error: error.message });
    res.status(500).json({ success: false, error: 'Failed to retrieve customer dashboard data' });
  }
});

module.exports = router;
