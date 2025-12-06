/**
 * @fileoverview Integration Tests for Authentication with Refresh Tokens
 * @module tests/integration/auth.test
 */

const request = require('supertest');
const app = require('../../index');

describe('Authentication Integration Tests', () => {
  let accessToken;
  let refreshTokenCookie;
  
  const testUser = {
    email: 'test@example.com',
    password: 'Test123!'
  };

  describe('POST /api/auth/login', () => {
    test('should login successfully and return access token', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send(testUser)
        .expect(200);
      
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('accessToken');
      expect(response.body).toHaveProperty('expiresIn', 900);
      expect(response.body).toHaveProperty('user');
      
      // Should set refresh token cookie
      const cookies = response.headers['set-cookie'];
      expect(cookies).toBeDefined();
      const refreshCookie = cookies.find(c => c.startsWith('refreshToken='));
      expect(refreshCookie).toBeDefined();
      expect(refreshCookie).toContain('HttpOnly');
      expect(refreshCookie).toContain('SameSite=Strict');
      expect(refreshCookie).toContain('Path=/api/auth/refresh');
      
      accessToken = response.body.accessToken;
      refreshTokenCookie = refreshCookie;
    });

    test('should fail with invalid credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@example.com', password: 'wrong' })
        .expect(401);
      
      expect(response.body).toHaveProperty('success', false);
    });
  });

  describe('POST /api/auth/refresh', () => {
    test('should refresh access token with valid cookie', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .set('Cookie', [refreshTokenCookie])
        .expect(200);
      
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('accessToken');
      expect(response.body).toHaveProperty('expiresIn', 900);
      
      // New access token should be different
      expect(response.body.accessToken).not.toBe(accessToken);
    });

    test('should fail without refresh token cookie', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .expect(401);
      
      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error', 'No refresh token provided');
      expect(response.body).toHaveProperty('requireLogin', true);
    });

    test('should fail with invalid refresh token', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .set('Cookie', ['refreshToken=invalid_token'])
        .expect(401);
      
      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('requireLogin', true);
    });
  });

  describe('POST /api/auth/logout', () => {
    test('should logout successfully and clear cookie', async () => {
      const response = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);
      
      expect(response.body).toHaveProperty('success', true);
      
      // Should clear refresh token cookie
      const cookies = response.headers['set-cookie'];
      expect(cookies).toBeDefined();
      const clearedCookie = cookies.find(c => c.startsWith('refreshToken='));
      expect(clearedCookie).toContain('Max-Age=0');
    });

    test('should fail without access token', async () => {
      const response = await request(app)
        .post('/api/auth/logout')
        .expect(401);
      
      expect(response.body).toHaveProperty('success', false);
    });
  });

  describe('Protected Routes', () => {
    test('should access protected route with valid access token', async () => {
      // Login first
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send(testUser);
      
      const token = loginResponse.body.accessToken;
      
      // Access protected route
      const response = await request(app)
        .get('/api/aebf/actual')
        .set('Authorization', `Bearer ${token}`)
        .query({ division: 'FP', budgetYear: 2024 })
        .expect(200);
      
      expect(response.body).toHaveProperty('success', true);
    });

    test('should reject expired or invalid access token', async () => {
      const response = await request(app)
        .get('/api/aebf/actual')
        .set('Authorization', 'Bearer invalid_token')
        .query({ division: 'FP', budgetYear: 2024 })
        .expect(401);
      
      expect(response.body).toHaveProperty('success', false);
    });
  });

  describe('Token Refresh Flow', () => {
    test('should refresh token before expiry and continue working', async () => {
      // Login
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send(testUser);
      
      const initialToken = loginResponse.body.accessToken;
      const cookies = loginResponse.headers['set-cookie'];
      
      // Wait 1 second (simulating time passing)
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Refresh token
      const refreshResponse = await request(app)
        .post('/api/auth/refresh')
        .set('Cookie', cookies);
      
      const newToken = refreshResponse.body.accessToken;
      
      // New token should work
      const response = await request(app)
        .get('/api/aebf/actual')
        .set('Authorization', `Bearer ${newToken}`)
        .query({ division: 'FP', budgetYear: 2024 })
        .expect(200);
      
      expect(response.body).toHaveProperty('success', true);
    });
  });
});

module.exports = {
  // Export for other tests
};
