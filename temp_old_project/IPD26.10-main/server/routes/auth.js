const express = require('express');
const router = express.Router();
const authService = require('../services/authService');
const userService = require('../services/userService');
const { authenticate, requireRole } = require('../middleware/auth');

/**
 * POST /api/auth/login
 * Login user
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

    res.json(result);
  } catch (error) {
    console.error('Login error:', error);
    res.status(401).json({ error: error.message });
  }
});

/**
 * POST /api/auth/register
 * Register new user (Admin only)
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
    console.error('Registration error:', error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * POST /api/auth/logout
 * Logout user
 */
router.post('/logout', authenticate, async (req, res) => {
  try {
    await authService.logout(req.user.id);
    res.json({ success: true, message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/auth/change-password
 * Change user password
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
    console.error('Change password error:', error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * GET /api/auth/me
 * Get current user info
 */
router.get('/me', authenticate, async (req, res) => {
  try {
    const user = await authService.getUserById(req.user.id);
    res.json({ success: true, user });
  } catch (error) {
    console.error('Get current user error:', error);
    res.status(500).json({ error: error.message });
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
    console.error('Get users error:', error);
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
    console.error('Get user error:', error);
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
    console.error('Update user error:', error);
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
    console.error('Delete user error:', error);
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
    console.error('Update profile error:', error);
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
    console.error('Get preferences error:', error);
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
    console.error('Update preferences error:', error);
    res.status(400).json({ error: error.message });
  }
});

module.exports = router;
