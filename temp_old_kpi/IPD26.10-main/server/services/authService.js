const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { authPool } = require('../database/config');

class AuthService {
  constructor() {
    // JWT secret from env, fallback for development only
    this.jwtSecret = process.env.JWT_SECRET || 'dev-secret-change-in-production';
    this.jwtExpiry = process.env.JWT_EXPIRY || '24h';
  }

  /**
   * Register a new user (Admin only action)
   */
  async registerUser({ email, password, name, role, divisions = [], salesReps = [] }) {
    try {
      // Validate email format
      if (!this.validateEmail(email)) {
        throw new Error('Invalid email format');
      }

      // Validate password strength
      if (!this.validatePassword(password)) {
        throw new Error('Password must be at least 8 characters with uppercase, lowercase, and number');
      }

      // Check if user already exists
      const existingUser = await authPool.query(
        'SELECT id FROM users WHERE email = $1',
        [email.toLowerCase()]
      );

      if (existingUser.rows.length > 0) {
        throw new Error('User with this email already exists');
      }

      // Hash password
      const passwordHash = await bcrypt.hash(password, 10);

      // Start transaction
      const client = await authPool.connect();
      try {
        await client.query('BEGIN');

        // Insert user
        const userResult = await client.query(
          `INSERT INTO users (email, password_hash, name, role) 
           VALUES ($1, $2, $3, $4) 
           RETURNING id, email, name, role, created_at`,
          [email.toLowerCase(), passwordHash, name, role]
        );

        const user = userResult.rows[0];

        // Insert divisions for non-admin users
        if (role !== 'admin' && divisions.length > 0) {
          for (const division of divisions) {
            await client.query(
              'INSERT INTO user_divisions (user_id, division) VALUES ($1, $2)',
              [user.id, division]
            );
          }
        }

        // Insert sales rep access for sales managers
        if (role === 'sales_manager' && salesReps.length > 0) {
          for (const rep of salesReps) {
            await client.query(
              'INSERT INTO user_sales_rep_access (manager_id, sales_rep_name, division) VALUES ($1, $2, $3)',
              [user.id, rep.name, rep.division]
            );
          }
        }

        // Create default user preferences
        await client.query(
          `INSERT INTO user_preferences (user_id) VALUES ($1)`,
          [user.id]
        );

        await client.query('COMMIT');

        return {
          success: true,
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            createdAt: user.created_at
          }
        };
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    } catch (error) {
      console.error('Error registering user:', error);
      throw error;
    }
  }

  /**
   * Get divisions for user (admin gets all from company_settings, others from user_divisions)
   */
  async getDivisionsForUser(userId, userRole) {
    if (userRole === 'admin') {
      // Admin has access to all divisions - fetch from company_settings
      const settingsResult = await authPool.query(
        `SELECT setting_value FROM company_settings WHERE setting_key = 'divisions'`
      );
      if (settingsResult.rows.length > 0) {
        const divisionList = settingsResult.rows[0].setting_value;
        return divisionList.map(d => d.code);
      }
      return [];
    } else {
      // Regular users - fetch from user_divisions
      const divisionsResult = await authPool.query(
        'SELECT division FROM user_divisions WHERE user_id = $1',
        [userId]
      );
      return divisionsResult.rows.map(row => row.division);
    }
  }

  /**
   * Login user
   */
  async login(email, password, ipAddress, userAgent) {
    try {
      // Get user with password hash
      const userResult = await authPool.query(
        `SELECT u.id, u.email, u.password_hash, u.name, u.role, u.photo_url, u.is_active
         FROM users u
         WHERE u.email = $1`,
        [email.toLowerCase()]
      );

      if (userResult.rows.length === 0) {
        throw new Error('Invalid email or password');
      }

      const user = userResult.rows[0];

      // Check if user is active
      if (!user.is_active) {
        throw new Error('Account is deactivated. Please contact administrator.');
      }

      // Verify password
      const isPasswordValid = await bcrypt.compare(password, user.password_hash);
      if (!isPasswordValid) {
        throw new Error('Invalid email or password');
      }

      // Get user divisions
      const divisions = await this.getDivisionsForUser(user.id, user.role);

      // Get user preferences
      const prefsResult = await authPool.query(
        'SELECT period_selection, base_period_index, theme, timezone FROM user_preferences WHERE user_id = $1',
        [user.id]
      );
      const preferences = prefsResult.rows[0] || {};

      // Generate JWT token
      const token = jwt.sign(
        {
          userId: user.id,
          email: user.email,
          role: user.role,
          divisions: divisions
        },
        this.jwtSecret,
        { expiresIn: this.jwtExpiry }
      );

      // Store session
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
      const tokenHash = await bcrypt.hash(token, 10);
      
      await authPool.query(
        `INSERT INTO user_sessions (user_id, token_hash, ip_address, user_agent, expires_at)
         VALUES ($1, $2, $3, $4, $5)`,
        [user.id, tokenHash, ipAddress, userAgent, expiresAt]
      );

      return {
        success: true,
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          photoUrl: user.photo_url,
          divisions: divisions,
          preferences: preferences
        }
      };
    } catch (error) {
      console.error('Error logging in:', error);
      throw error;
    }
  }

  /**
   * Verify JWT token
   */
  async verifyToken(token) {
    try {
      const decoded = jwt.verify(token, this.jwtSecret);
      
      // Check if session exists and is valid
      const sessionResult = await authPool.query(
        `SELECT id FROM user_sessions 
         WHERE user_id = $1 AND expires_at > NOW()
         LIMIT 1`,
        [decoded.userId]
      );

      if (sessionResult.rows.length === 0) {
        throw new Error('Session expired or invalid');
      }

      return decoded;
    } catch (error) {
      throw new Error('Invalid or expired token');
    }
  }

  /**
   * Logout user
   */
  async logout(userId) {
    try {
      await authPool.query(
        'DELETE FROM user_sessions WHERE user_id = $1',
        [userId]
      );
      return { success: true };
    } catch (error) {
      console.error('Error logging out:', error);
      throw error;
    }
  }

  /**
   * Change password
   */
  async changePassword(userId, oldPassword, newPassword) {
    try {
      // Get current password hash
      const userResult = await authPool.query(
        'SELECT password_hash FROM users WHERE id = $1',
        [userId]
      );

      if (userResult.rows.length === 0) {
        throw new Error('User not found');
      }

      const user = userResult.rows[0];

      // Verify old password
      const isPasswordValid = await bcrypt.compare(oldPassword, user.password_hash);
      if (!isPasswordValid) {
        throw new Error('Current password is incorrect');
      }

      // Validate new password
      if (!this.validatePassword(newPassword)) {
        throw new Error('New password must be at least 8 characters with uppercase, lowercase, and number');
      }

      // Hash new password
      const newPasswordHash = await bcrypt.hash(newPassword, 10);

      // Update password
      await authPool.query(
        'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
        [newPasswordHash, userId]
      );

      // Invalidate all sessions
      await authPool.query(
        'DELETE FROM user_sessions WHERE user_id = $1',
        [userId]
      );

      return { success: true };
    } catch (error) {
      console.error('Error changing password:', error);
      throw error;
    }
  }

  /**
   * Get user by ID with full details
   */
  async getUserById(userId) {
    try {
      const userResult = await authPool.query(
        `SELECT id, email, name, role, photo_url, is_active, created_at
         FROM users WHERE id = $1`,
        [userId]
      );

      if (userResult.rows.length === 0) {
        throw new Error('User not found');
      }

      const user = userResult.rows[0];

      // Get divisions using helper function
      const divisions = await this.getDivisionsForUser(userId, user.role);

      // Get preferences
      const prefsResult = await authPool.query(
        'SELECT * FROM user_preferences WHERE user_id = $1',
        [userId]
      );
      const preferences = prefsResult.rows[0] || {};

      return {
        ...user,
        divisions,
        preferences
      };
    } catch (error) {
      console.error('Error getting user:', error);
      throw error;
    }
  }

  /**
   * Email validation
   */
  validateEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
  }

  /**
   * Password validation (at least 8 chars, 1 uppercase, 1 lowercase, 1 number)
   */
  validatePassword(password) {
    if (password.length < 8) return false;
    if (!/[A-Z]/.test(password)) return false;
    if (!/[a-z]/.test(password)) return false;
    if (!/[0-9]/.test(password)) return false;
    return true;
  }

  /**
   * Clean up expired sessions (should be run periodically)
   */
  async cleanupExpiredSessions() {
    try {
      const result = await authPool.query(
        'DELETE FROM user_sessions WHERE expires_at < NOW()'
      );
      console.log(`Cleaned up ${result.rowCount} expired sessions`);
      return result.rowCount;
    } catch (error) {
      console.error('Error cleaning up sessions:', error);
      throw error;
    }
  }
}

module.exports = new AuthService();
