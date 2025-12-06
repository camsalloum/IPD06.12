const express = require('express');
const logger = require('../utils/logger');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const { authenticate, requireRole } = require('../middleware/auth');
const { authPool, pool } = require('../database/config');
const { 
  createDivisionDatabase, 
  deleteDivisionDatabase, 
  divisionDatabaseExists 
} = require('../utils/divisionDatabaseManager');

// Configure multer for logo upload
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../uploads/logos');
    try {
      await fs.mkdir(uploadDir, { recursive: true });
      cb(null, uploadDir);
    } catch (error) {
      cb(error);
    }
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'company-logo-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed'), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

/**
 * GET /api/settings/company
 * Get all company settings (public)
 */
router.get('/company', async (req, res) => {
  try {
    const result = await authPool.query(
      'SELECT setting_key, setting_value FROM company_settings'
    );

    const settings = {};
    result.rows.forEach(row => {
      settings[row.setting_key] = row.setting_value;
    });

    res.json({
      success: true,
      settings: {
        companyName: settings.company_name || 'Your Company',
        logoUrl: settings.company_logo_url || null,
        divisions: settings.divisions || []
      }
    });
  } catch (error) {
    logger.error('Get company settings error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/settings/company
 * Update company name and logo (Admin only)
 */
router.post('/company', authenticate, requireRole('admin'), upload.single('logo'), async (req, res) => {
  try {
    const { companyName } = req.body;
    
    // Update company name
    if (companyName) {
      await authPool.query(
        `INSERT INTO company_settings (setting_key, setting_value, updated_by)
         VALUES ('company_name', $1, $2)
         ON CONFLICT (setting_key)
         DO UPDATE SET setting_value = $1, updated_by = $2, updated_at = NOW()`,
        [JSON.stringify(companyName), req.user.userId]
      );
    }

    // Update logo if uploaded
    let logoUrl = null;
    if (req.file) {
      // Delete old logo files
      const uploadDir = path.join(__dirname, '../uploads/logos');
      try {
        const files = await fs.readdir(uploadDir);
        for (const file of files) {
          if (file !== req.file.filename && file.startsWith('company-logo-')) {
            await fs.unlink(path.join(uploadDir, file));
          }
        }
      } catch (error) {
        logger.error('Error cleaning up old logos:', error);
      }

      logoUrl = `/uploads/logos/${req.file.filename}`;
      
      await authPool.query(
        `INSERT INTO company_settings (setting_key, setting_value, updated_by)
         VALUES ('company_logo_url', $1, $2)
         ON CONFLICT (setting_key)
         DO UPDATE SET setting_value = $1, updated_by = $2, updated_at = NOW()`,
        [JSON.stringify(logoUrl), req.user.userId]
      );
    }

    // Get updated settings
    const result = await authPool.query(
      'SELECT setting_key, setting_value FROM company_settings'
    );

    const settings = {};
    result.rows.forEach(row => {
      settings[row.setting_key] = row.setting_value;
    });

    res.json({
      success: true,
      message: 'Company settings updated successfully',
      settings: {
        companyName: settings.company_name || 'Your Company',
        logoUrl: settings.company_logo_url || null,
        divisions: settings.divisions || []
      }
    });
  } catch (error) {
    logger.error('Update company settings error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/settings/divisions/impact/:code
 * Check impact of deleting a division
 */
router.get('/divisions/impact/:code', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const { code } = req.params;

    // Check affected users in auth database
    const userDivisionsResult = await authPool.query(
      'SELECT COUNT(DISTINCT user_id) as count FROM user_divisions WHERE division = $1',
      [code]
    );

    const defaultDivisionResult = await authPool.query(
      'SELECT COUNT(*) as count FROM user_preferences WHERE default_division = $1',
      [code]
    );

    // Check if division has data in main database
    let hasMainData = false;
    let recordCount = 0;
    try {
      const dataResult = await pool.query(
        `SELECT COUNT(*) as count FROM aebf 
         WHERE "Division" = $1 
         LIMIT 1`,
        [code]
      );
      hasMainData = dataResult.rows[0].count > 0;
      recordCount = parseInt(dataResult.rows[0].count);
    } catch (error) {
      logger.info('No main data found for division:', code);
    }

    // Check budget data
    let hasBudgetData = false;
    let budgetCount = 0;
    try {
      const budgetResult = await pool.query(
        `SELECT COUNT(*) as count FROM fp_budget 
         WHERE division = $1 
         LIMIT 1`,
        [code]
      );
      hasBudgetData = budgetResult.rows[0].count > 0;
      budgetCount = parseInt(budgetResult.rows[0].count);
    } catch (error) {
      logger.info('No budget data found for division:', code);
    }

    res.json({
      success: true,
      impact: {
        code: code,
        affectedUsers: parseInt(userDivisionsResult.rows[0].count),
        usersWithDefault: parseInt(defaultDivisionResult.rows[0].count),
        hasMainData,
        mainDataRecords: recordCount,
        hasBudgetData,
        budgetRecords: budgetCount,
        totalImpact: parseInt(userDivisionsResult.rows[0].count) + 
                     parseInt(defaultDivisionResult.rows[0].count) +
                     (hasMainData ? 1 : 0) + 
                     (hasBudgetData ? 1 : 0)
      }
    });
  } catch (error) {
    logger.error('Check division impact error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/settings/divisions
 * Update divisions with cascade operations (Admin only)
 */
router.post('/divisions', authenticate, requireRole('admin'), async (req, res) => {
  const client = await authPool.connect();
  
  try {
    const { divisions } = req.body;

    if (!Array.isArray(divisions)) {
      return res.status(400).json({ error: 'Divisions must be an array' });
    }

    // Validate divisions
    for (const div of divisions) {
      if (!div.code || !div.name) {
        return res.status(400).json({ error: 'Each division must have code and name' });
      }
    }

    // Get current divisions
    const currentResult = await client.query(
      'SELECT setting_value FROM company_settings WHERE setting_key = $1',
      ['divisions']
    );
    
    const currentDivisions = currentResult.rows.length > 0 
      ? currentResult.rows[0].setting_value 
      : [];
    
    const currentCodes = currentDivisions.map(d => d.code);
    const newCodes = divisions.map(d => d.code);

    // Find deleted divisions
    const deletedCodes = currentCodes.filter(code => !newCodes.includes(code));
    
    // Find new divisions
    const addedDivisions = divisions.filter(d => !currentCodes.includes(d.code));

    await client.query('BEGIN');

    // Handle deleted divisions - CASCADE DELETE
    for (const code of deletedCodes) {
      logger.info(`Cascading delete for division: ${code}`);
      
      // 1. Remove from user_divisions
      await client.query(
        'DELETE FROM user_divisions WHERE division = $1',
        [code]
      );
      
      // 2. Clear default_division in user_preferences
      await client.query(
        'UPDATE user_preferences SET default_division = NULL WHERE default_division = $1',
        [code]
      );

      // 3. Remove from user_sales_rep_access
      await client.query(
        'DELETE FROM user_sales_rep_access WHERE division = $1',
        [code]
      );

      // 4. Drop entire division database
      try {
        await deleteDivisionDatabase(code);
        logger.info(`✅ Deleted database for division: ${code}`);
      } catch (error) {
        logger.info(`⚠️ Error deleting database for ${code}:`, error.message);
        // If database doesn't exist, that's okay - maybe it's FP (legacy)
      }
    }

    // Handle new divisions - CREATE STRUCTURE
    for (const newDiv of addedDivisions) {
      logger.info(`Creating structure for new division: ${newDiv.code}`);
      
      // Validate division code format (2-4 uppercase letters)
      if (!/^[A-Z]{2,4}$/.test(newDiv.code)) {
        throw new Error(`Invalid division code: ${newDiv.code}. Must be 2-4 uppercase letters.`);
      }
      
      // Create entire division database with all tables cloned from FP
      try {
        await createDivisionDatabase(newDiv.code, newDiv.name);
        logger.info(`✅ Division ${newDiv.code} (${newDiv.name}) database created successfully!`);
      } catch (error) {
        logger.error(`❌ Error creating division ${newDiv.code}:`, error.message);
        throw error;
      }
    }

    // Update divisions in settings
    await client.query(
      `INSERT INTO company_settings (setting_key, setting_value, updated_by)
       VALUES ('divisions', $1, $2)
       ON CONFLICT (setting_key)
       DO UPDATE SET setting_value = $1, updated_by = $2, updated_at = NOW()`,
      [JSON.stringify(divisions), req.user.userId]
    );

    await client.query('COMMIT');

    res.json({
      success: true,
      message: 'Divisions updated successfully',
      divisions,
      deleted: deletedCodes,
      added: addedDivisions.map(d => d.code)
    });
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Update divisions error:', error);
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

/**
 * Legacy endpoints for backward compatibility
 */

/**
 * POST /api/settings/company-logo
 * Upload company logo (Admin only) - Legacy
 */
router.post('/company-logo', authenticate, requireRole('admin'), upload.single('logo'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Delete old logo files
    const uploadDir = path.join(__dirname, '../uploads/logos');
    try {
      const files = await fs.readdir(uploadDir);
      for (const file of files) {
        if (file !== req.file.filename && file.startsWith('company-logo-')) {
          await fs.unlink(path.join(uploadDir, file));
        }
      }
    } catch (error) {
      logger.error('Error cleaning up old logos:', error);
    }

    const logoUrl = `/uploads/logos/${req.file.filename}`;
    
    await authPool.query(
      `INSERT INTO company_settings (setting_key, setting_value, updated_by)
       VALUES ('company_logo_url', $1, $2)
       ON CONFLICT (setting_key)
       DO UPDATE SET setting_value = $1, updated_by = $2, updated_at = NOW()`,
      [JSON.stringify(logoUrl), req.user.userId]
    );

    res.json({
      success: true,
      message: 'Logo uploaded successfully',
      logoUrl: logoUrl
    });
  } catch (error) {
    logger.error('Logo upload error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/settings/company-logo
 * Get current company logo - Legacy
 */
router.get('/company-logo', async (req, res) => {
  try {
    const result = await authPool.query(
      'SELECT setting_value FROM company_settings WHERE setting_key = $1',
      ['company_logo_url']
    );

    const logoUrl = result.rows.length > 0 ? result.rows[0].setting_value : null;

    res.json({
      success: true,
      logoUrl: logoUrl
    });
  } catch (error) {
    logger.error('Get logo error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
