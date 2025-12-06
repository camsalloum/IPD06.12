const bcrypt = require('bcryptjs');
const logger = require('../utils/logger');
const jwt = require('jsonwebtoken');
const { authPool } = require('../database/config');

class AuthService {
  constructor() {
    // JWT secrets from env, fallback for development only
    this.jwtSecret = process.env.JWT_SECRET || 'dev-secret-change-in-production';
    this.refreshSecret = process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret-change-in-production';
    
    // Access token: 15 minutes (short-lived for security)
    this.accessTokenExpiry = process.env.JWT_ACCESS_EXPIRY || '15m';
    
    // Refresh token: 60 days (long-lived for persistent login)
    this.refreshTokenExpiry = process.env.JWT_REFRESH_EXPIRY || '60d';
    this.refreshTokenExpiryMs = 60 * 24 * 60 * 60 * 1000; // 60 days in milliseconds
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
      logger.error('Error registering user:', error);
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

      // Generate access token (short-lived, 15 minutes)
      const accessToken = jwt.sign(
        {
          userId: user.id,
          email: user.email,
          role: user.role,
          divisions: divisions,
          type: 'access'
        },
        this.jwtSecret,
        { expiresIn: this.accessTokenExpiry }
      );

      // Generate refresh token (long-lived, 60 days)
      const refreshToken = jwt.sign(
        {
          userId: user.id,
          email: user.email,
          type: 'refresh'
        },
        this.refreshSecret,
        { expiresIn: this.refreshTokenExpiry }
      );

      // Store refresh token session (NO IDLE TIMEOUT - only expires after 60 days)
      const expiresAt = new Date(Date.now() + this.refreshTokenExpiryMs);
      const tokenHash = await bcrypt.hash(refreshToken, 10);
      
      await authPool.query(
        `INSERT INTO user_sessions (user_id, token_hash, ip_address, user_agent, expires_at, last_activity)
         VALUES ($1, $2, $3, $4, $5, NOW())`,
        [user.id, tokenHash, ipAddress, userAgent, expiresAt]
      );

      return {
        success: true,
        accessToken,
        refreshToken,
        expiresIn: 900, // 15 minutes in seconds
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
      logger.error('Error logging in:', error);
      throw error;
    }
  }

  /**
   * Verify access token (used for API requests)
   */
  async verifyToken(token) {
    try {
      const decoded = jwt.verify(token, this.jwtSecret);
      
      if (decoded.type !== 'access') {
        throw new Error('Invalid token type');
      }
      
      // Check if user session exists (refresh token session)
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
   * Verify refresh token and generate new access token
   */
  async refreshAccessToken(refreshToken) {
    try {
      // Verify refresh token
      const decoded = jwt.verify(refreshToken, this.refreshSecret);
      
      if (decoded.type !== 'refresh') {
        throw new Error('Invalid token type');
      }

      // Verify refresh token exists in database and is not expired
      const tokenHash = await bcrypt.hash(refreshToken, 10);
      const sessionResult = await authPool.query(
        `SELECT s.id, s.user_id, u.email, u.role, u.is_active
         FROM user_sessions s
         JOIN users u ON s.user_id = u.id
         WHERE s.user_id = $1 AND s.expires_at > NOW()
         ORDER BY s.created_at DESC
         LIMIT 1`,
        [decoded.userId]
      );

      if (sessionResult.rows.length === 0) {
        throw new Error('Session expired or invalid');
      }

      const session = sessionResult.rows[0];

      // Check if user is still active
      if (!session.is_active) {
        throw new Error('Account is deactivated');
      }

      // Get user divisions
      const divisions = await this.getDivisionsForUser(session.user_id, session.role);

      // Update last activity timestamp (optional keep-alive)
      await authPool.query(
        'UPDATE user_sessions SET last_activity = NOW() WHERE id = $1',
        [session.id]
      );

      // Generate new access token
      const newAccessToken = jwt.sign(
        {
          userId: session.user_id,
          email: session.email,
          role: session.role,
          divisions: divisions,
          type: 'access'
        },
        this.jwtSecret,
        { expiresIn: this.accessTokenExpiry }
      );

      return {
        success: true,
        accessToken: newAccessToken,
        expiresIn: 900 // 15 minutes in seconds
      };
    } catch (error) {
      logger.error('Error refreshing token:', error);
      throw new Error('Invalid or expired refresh token');
    }
  }

  /**
   * Logout user - removes ALL sessions for this user
   */
  async logout(userId) {
    try {
      await authPool.query(
        'DELETE FROM user_sessions WHERE user_id = $1',
        [userId]
      );
      return { success: true };
    } catch (error) {
      logger.error('Error logging out:', error);
      throw error;
    }
  }

  /**
   * Logout from specific device/session
   */
  async logoutSession(userId, refreshToken) {
    try {
      // For more granular control, could verify token hash
      // For now, delete specific session by user
      await authPool.query(
        'DELETE FROM user_sessions WHERE user_id = $1 AND id = (SELECT id FROM user_sessions WHERE user_id = $1 ORDER BY last_activity DESC LIMIT 1)',
        [userId]
      );
      return { success: true };
    } catch (error) {
      logger.error('Error logging out session:', error);
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
      logger.error('Error changing password:', error);
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
      logger.error('Error getting user:', error);
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
      logger.info(`Cleaned up ${result.rowCount} expired sessions`);
      return result.rowCount;
    } catch (error) {
      logger.error('Error cleaning up sessions:', error);
      throw error;
    }
  }
}

module.exports = new AuthService();
