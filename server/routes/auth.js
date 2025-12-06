const express = require('express');
const logger = require('../utils/logger');
const router = express.Router();
const authService = require('../services/authService');
const userService = require('../services/userService');
const { authenticate, requireRole } = require('../middleware/auth');

/**
 * @swagger
 * components:
 *   schemas:
 *     LoginRequest:
 *       type: object
 *       required:
 *         - email
 *         - password
 *       properties:
 *         email:
 *           type: string
 *           format: email
 *           description: User email address
 *         password:
 *           type: string
 *           format: password
 *           description: User password
 *     LoginResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *         accessToken:
 *           type: string
 *           description: JWT access token
 *         expiresIn:
 *           type: string
 *           description: Token expiration time
 *         user:
 *           $ref: '#/components/schemas/User'
 *     User:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *         email:
 *           type: string
 *         name:
 *           type: string
 *         role:
 *           type: string
 *           enum: [admin, manager, user]
 *         divisions:
 *           type: array
 *           items:
 *             type: string
 *         salesReps:
 *           type: array
 *           items:
 *             type: string
 *     RegisterRequest:
 *       type: object
 *       required:
 *         - email
 *         - password
 *         - name
 *         - role
 *       properties:
 *         email:
 *           type: string
 *           format: email
 *         password:
 *           type: string
 *           format: password
 *           minLength: 8
 *         name:
 *           type: string
 *         role:
 *           type: string
 *           enum: [admin, manager, user]
 *         divisions:
 *           type: array
 *           items:
 *             type: string
 *         salesReps:
 *           type: array
 *           items:
 *             type: string
 *   securitySchemes:
 *     bearerAuth:
 *       type: http
 *       scheme: bearer
 *       bearerFormat: JWT
 */

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Login user
 *     description: Authenticate user and return access token with refresh token in cookie
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LoginRequest'
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/LoginResponse'
 *         headers:
 *           Set-Cookie:
 *             description: Refresh token cookie
 *             schema:
 *               type: string
 *       400:
 *         description: Missing email or password
 *       401:
 *         description: Invalid credentials
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const ipAddress = req.ip || req.connection.remoteAddress;
    const userAgent = req.headers['user-agent'];

    const result = await authService.login(email, password, ipAddress, userAgent);

    // Set refresh token in secure httpOnly cookie (60 days)
    res.cookie('refreshToken', result.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production', // Only HTTPS in production
      sameSite: 'strict',
      maxAge: 60 * 24 * 60 * 60 * 1000, // 60 days
      path: '/api/auth/refresh' // Only send to refresh endpoint
    });

    // Return access token and user info (no refresh token in response body)
    res.json({
      success: result.success,
      accessToken: result.accessToken,
      expiresIn: result.expiresIn,
      user: result.user
    });
  } catch (error) {
    logger.error('Login error:', error);
    res.status(401).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Register new user
 *     description: Create a new user account (Admin only)
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RegisterRequest'
 *     responses:
 *       200:
 *         description: User registered successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *       400:
 *         description: Invalid input or user already exists
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Admin role required
 */
router.post('/register', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const { email, password, name, role, divisions, salesReps } = req.body;

    if (!email || !password || !name || !role) {
      return res.status(400).json({ 
        error: 'Email, password, name, and role are required' 
      });
    }

    const result = await authService.registerUser({
      email,
      password,
      name,
      role,
      divisions: divisions || [],
      salesReps: salesReps || []
    });

    res.json(result);
  } catch (error) {
    logger.error('Registration error:', error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/auth/logout:
 *   post:
 *     summary: Logout user
 *     description: Invalidate session and clear refresh token
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Logout successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.post('/logout', authenticate, async (req, res) => {
  try {
    await authService.logout(req.user.id);
    
    // Clear refresh token cookie
    res.clearCookie('refreshToken', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/api/auth/refresh'
    });
    
    res.json({ success: true, message: 'Logged out successfully' });
  } catch (error) {
    logger.error('Logout error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/auth/change-password:
 *   post:
 *     summary: Change password
 *     description: Change the current user's password
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - oldPassword
 *               - newPassword
 *             properties:
 *               oldPassword:
 *                 type: string
 *                 format: password
 *               newPassword:
 *                 type: string
 *                 format: password
 *                 minLength: 8
 *     responses:
 *       200:
 *         description: Password changed successfully
 *       400:
 *         description: Invalid old password or new password requirements not met
 *       401:
 *         description: Unauthorized
 */
router.post('/change-password', authenticate, async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;

    if (!oldPassword || !newPassword) {
      return res.status(400).json({ 
        error: 'Old password and new password are required' 
      });
    }

    await authService.changePassword(req.user.id, oldPassword, newPassword);

    res.json({ 
      success: true, 
      message: 'Password changed successfully. Please login again.' 
    });
  } catch (error) {
    logger.error('Change password error:', error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/auth/me:
 *   get:
 *     summary: Get current user
 *     description: Retrieve the currently authenticated user's information
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User information retrieved
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.get('/me', authenticate, async (req, res) => {
  try {
    const user = await authService.getUserById(req.user.id);
    res.json({ success: true, user });
  } catch (error) {
    logger.error('Get current user error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/auth/refresh:
 *   post:
 *     summary: Refresh access token
 *     description: Get a new access token using the refresh token from cookie
 *     tags: [Authentication]
 *     responses:
 *       200:
 *         description: New access token generated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 accessToken:
 *                   type: string
 *                 expiresIn:
 *                   type: string
 *       401:
 *         description: No refresh token or invalid token
 */
router.post('/refresh', async (req, res) => {
  try {
    const refreshToken = req.cookies.refreshToken;

    if (!refreshToken) {
      return res.status(401).json({ 
        success: false, 
        error: 'No refresh token provided' 
      });
    }

    const result = await authService.refreshAccessToken(refreshToken);
    res.json(result);
  } catch (error) {
    logger.error('Refresh token error:', error);
    
    // Clear invalid refresh token cookie
    res.clearCookie('refreshToken', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/api/auth/refresh'
    });
    
    res.status(401).json({ 
      success: false, 
      error: 'Invalid or expired refresh token',
      requireLogin: true
    });
  }
});

/**
 * POST /api/auth/verify
 * Verify token validity
 */
router.post('/verify', async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ error: 'Token is required' });
    }

    const decoded = await authService.verifyToken(token);
    res.json({ success: true, valid: true, user: decoded });
  } catch (error) {
    res.status(401).json({ success: false, valid: false, error: error.message });
  }
});

/**
 * GET /api/auth/users
 * Get all users (Admin only)
 */
router.get('/users', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const users = await userService.getAllUsers();
    res.json({ success: true, users });
  } catch (error) {
    logger.error('Get users error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/auth/users/:id
 * Get user by ID (Admin only)
 */
router.get('/users/:id', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    const user = await userService.getUserById(userId);
    res.json({ success: true, user });
  } catch (error) {
    logger.error('Get user error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/auth/users/:id
 * Update user (Admin only)
 */
router.put('/users/:id', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    const updates = req.body;

    const user = await userService.updateUser(userId, updates);
    res.json({ success: true, user });
  } catch (error) {
    logger.error('Update user error:', error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * DELETE /api/auth/users/:id
 * Delete user (Admin only)
 */
router.delete('/users/:id', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const userId = parseInt(req.params.id);

    // Prevent deleting yourself
    if (userId === req.user.id) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }

    await userService.deleteUser(userId);
    res.json({ success: true, message: 'User deleted successfully' });
  } catch (error) {
    logger.error('Delete user error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/auth/profile
 * Update current user's profile
 */
router.put('/profile', authenticate, async (req, res) => {
  try {
    const updates = req.body;
    const user = await userService.updateProfile(req.user.id, updates);
    res.json({ success: true, user });
  } catch (error) {
    logger.error('Update profile error:', error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * GET /api/auth/preferences
 * Get current user's preferences
 */
router.get('/preferences', authenticate, async (req, res) => {
  try {
    const preferences = await userService.getPreferences(req.user.id);
    res.json({ success: true, preferences });
  } catch (error) {
    logger.error('Get preferences error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/auth/preferences
 * Update current user's preferences (including period selection)
 */
router.put('/preferences', authenticate, async (req, res) => {
  try {
    const preferences = req.body;
    const updated = await userService.updatePreferences(req.user.id, preferences);
    res.json({ success: true, preferences: updated });
  } catch (error) {
    logger.error('Update preferences error:', error);
    res.status(400).json({ error: error.message });
  }
});

module.exports = router;
