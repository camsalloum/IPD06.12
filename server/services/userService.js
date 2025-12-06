const { authPool } = require('../database/config');
const logger = require('../utils/logger');

class UserService {
  /**
   * Get all users (Admin only)
   */
  async getAllUsers() {
    try {
      const result = await authPool.query(
        `SELECT u.id, u.email, u.name, u.role, u.photo_url, u.is_active, u.created_at,
                COALESCE(json_agg(DISTINCT ud.division) FILTER (WHERE ud.division IS NOT NULL), '[]') as divisions
         FROM users u
         LEFT JOIN user_divisions ud ON u.id = ud.user_id
         GROUP BY u.id
         ORDER BY u.created_at DESC`
      );

      return result.rows;
    } catch (error) {
      logger.error('Error getting all users:', error);
      throw error;
    }
  }

  /**
   * Update user profile
   */
  async updateProfile(userId, updates) {
    try {
      const allowedFields = ['name', 'photo_url'];
      const fields = [];
      const values = [];
      let paramCount = 1;

      for (const [key, value] of Object.entries(updates)) {
        if (allowedFields.includes(key)) {
          fields.push(`${key} = $${paramCount}`);
          values.push(value);
          paramCount++;
        }
      }

      if (fields.length === 0) {
        throw new Error('No valid fields to update');
      }

      fields.push(`updated_at = NOW()`);
      values.push(userId);

      const query = `
        UPDATE users 
        SET ${fields.join(', ')}
        WHERE id = $${paramCount}
        RETURNING id, email, name, role, photo_url, is_active
      `;

      const result = await authPool.query(query, values);
      return result.rows[0];
    } catch (error) {
      logger.error('Error updating profile:', error);
      throw error;
    }
  }

  /**
   * Update user preferences (period selection, theme, default division, etc.)
   */
  async updatePreferences(userId, preferences) {
    try {
      const allowedFields = ['period_selection', 'base_period_index', 'theme', 'timezone', 'language', 'notifications_enabled', 'default_division'];
      const fields = [];
      const values = [];
      let paramCount = 1;

      for (const [key, value] of Object.entries(preferences)) {
        if (allowedFields.includes(key)) {
          fields.push(`${key} = $${paramCount}`);
          values.push(key === 'period_selection' ? JSON.stringify(value) : value);
          paramCount++;
        }
      }

      if (fields.length === 0) {
        throw new Error('No valid preferences to update');
      }

      fields.push(`updated_at = NOW()`);
      values.push(userId);

      const query = `
        UPDATE user_preferences 
        SET ${fields.join(', ')}
        WHERE user_id = $${paramCount}
        RETURNING *
      `;

      const result = await authPool.query(query, values);
      return result.rows[0];
    } catch (error) {
      logger.error('Error updating preferences:', error);
      throw error;
    }
  }

  /**
   * Get user preferences
   */
  async getPreferences(userId) {
    try {
      const result = await authPool.query(
        'SELECT * FROM user_preferences WHERE user_id = $1',
        [userId]
      );

      if (result.rows.length === 0) {
        // Create default preferences if not exists
        await authPool.query(
          'INSERT INTO user_preferences (user_id) VALUES ($1)',
          [userId]
        );
        return this.getPreferences(userId);
      }

      return result.rows[0];
    } catch (error) {
      logger.error('Error getting preferences:', error);
      throw error;
    }
  }

  /**
   * Update user (Admin only)
   */
  async updateUser(userId, updates) {
    const client = await authPool.connect();
    try {
      await client.query('BEGIN');

      // Update user basic info
      const userFields = [];
      const userValues = [];
      let paramCount = 1;

      const allowedUserFields = ['name', 'email', 'role', 'is_active'];
      for (const [key, value] of Object.entries(updates)) {
        if (allowedUserFields.includes(key)) {
          userFields.push(`${key} = $${paramCount}`);
          userValues.push(key === 'email' ? value.toLowerCase() : value);
          paramCount++;
        }
      }

      if (userFields.length > 0) {
        userFields.push(`updated_at = NOW()`);
        userValues.push(userId);

        await client.query(
          `UPDATE users SET ${userFields.join(', ')} WHERE id = $${paramCount}`,
          userValues
        );
      }

      // Update divisions if provided
      if (updates.divisions && updates.role !== 'admin') {
        // Delete existing divisions
        await client.query('DELETE FROM user_divisions WHERE user_id = $1', [userId]);

        // Insert new divisions
        for (const division of updates.divisions) {
          await client.query(
            'INSERT INTO user_divisions (user_id, division) VALUES ($1, $2)',
            [userId, division]
          );
        }
      }

      // Update sales rep access if provided (for sales managers)
      if (updates.salesReps && updates.role === 'sales_manager') {
        // Delete existing access
        await client.query('DELETE FROM user_sales_rep_access WHERE manager_id = $1', [userId]);

        // Insert new access
        for (const rep of updates.salesReps) {
          await client.query(
            'INSERT INTO user_sales_rep_access (manager_id, sales_rep_name, division) VALUES ($1, $2, $3)',
            [userId, rep.name, rep.division]
          );
        }
      }

      await client.query('COMMIT');

      // Return updated user
      return await this.getUserById(userId);
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Error updating user:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Delete user (Admin only)
   */
  async deleteUser(userId) {
    try {
      // Check if user exists
      const userCheck = await authPool.query('SELECT id FROM users WHERE id = $1', [userId]);
      if (userCheck.rows.length === 0) {
        throw new Error('User not found');
      }

      // Delete user (cascade will handle related records)
      await authPool.query('DELETE FROM users WHERE id = $1', [userId]);

      return { success: true };
    } catch (error) {
      logger.error('Error deleting user:', error);
      throw error;
    }
  }

  /**
   * Get user by ID with full details
   */
  async getUserById(userId) {
    try {
      const userResult = await authPool.query(
        `SELECT id, email, name, role, photo_url, is_active, created_at, updated_at
         FROM users WHERE id = $1`,
        [userId]
      );

      if (userResult.rows.length === 0) {
        throw new Error('User not found');
      }

      const user = userResult.rows[0];

      // Get divisions
      const divisionsResult = await authPool.query(
        'SELECT division FROM user_divisions WHERE user_id = $1',
        [userId]
      );
      const divisions = divisionsResult.rows.map(row => row.division);

      // Get sales rep access (if sales manager)
      // Get divisions for user
      let userDivisions = divisions;
      if (user.role === 'admin') {
        // Admin has access to all divisions - fetch from company_settings
        const settingsResult = await authPool.query(
          `SELECT setting_value FROM company_settings WHERE setting_key = 'divisions'`
        );
        if (settingsResult.rows.length > 0) {
          const divisionList = settingsResult.rows[0].setting_value;
          userDivisions = divisionList.map(d => d.code);
        }
      }

      let salesReps = [];
      if (user.role === 'sales_manager') {
        const repsResult = await authPool.query(
          'SELECT sales_rep_name, division FROM user_sales_rep_access WHERE manager_id = $1',
          [userId]
        );
        salesReps = repsResult.rows.map(row => ({
          name: row.sales_rep_name,
          division: row.division
        }));
      }

      return {
        ...user,
        divisions: userDivisions,
        salesReps: user.role === 'sales_manager' ? salesReps : []
      };
    } catch (error) {
      logger.error('Error getting user by ID:', error);
      throw error;
    }
  }

  /**
   * Get sales reps for a manager
   */
  async getSalesRepsForManager(managerId) {
    try {
      const result = await authPool.query(
        'SELECT DISTINCT sales_rep_name, division FROM user_sales_rep_access WHERE manager_id = $1',
        [managerId]
      );

      return result.rows.map(row => ({
        name: row.sales_rep_name,
        division: row.division
      }));
    } catch (error) {
      logger.error('Error getting sales reps for manager:', error);
      throw error;
    }
  }

  /**
   * Check if user has access to division
   */
  async hasAccessToDivision(userId, division) {
    try {
      // Check if admin
      const userResult = await authPool.query(
        'SELECT role FROM users WHERE id = $1',
        [userId]
      );

      if (userResult.rows.length === 0) {
        return false;
      }

      const role = userResult.rows[0].role;
      if (role === 'admin') {
        return true; // Admins have access to all divisions
      }

      // Check division access
      const divisionResult = await authPool.query(
        'SELECT id FROM user_divisions WHERE user_id = $1 AND division = $2',
        [userId, division]
      );

      return divisionResult.rows.length > 0;
    } catch (error) {
      logger.error('Error checking division access:', error);
      return false;
    }
  }

  /**
   * Check if manager has access to sales rep
   */
  async hasAccessToSalesRep(userId, salesRepName, division) {
    try {
      // Check if admin
      const userResult = await authPool.query(
        'SELECT role FROM users WHERE id = $1',
        [userId]
      );

      if (userResult.rows.length === 0) {
        return false;
      }

      const user = userResult.rows[0];
      if (user.role === 'admin') {
        return true; // Admins have access to all sales reps
      }

      if (user.role === 'sales_manager') {
        // Check if manager has access to this sales rep
        const accessResult = await authPool.query(
          'SELECT id FROM user_sales_rep_access WHERE manager_id = $1 AND sales_rep_name = $2 AND division = $3',
          [userId, salesRepName, division]
        );
        return accessResult.rows.length > 0;
      }

      return false;
    } catch (error) {
      logger.error('Error checking sales rep access:', error);
      return false;
    }
  }
}

module.exports = new UserService();
