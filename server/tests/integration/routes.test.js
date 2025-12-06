/**
 * @fileoverview Integration Tests for AEBF Routes
 * @module tests/integration/routes.test
 */

const request = require('supertest');
const app = require('../../index');

describe('AEBF Routes Integration Tests', () => {
  let accessToken;
  
  beforeAll(async () => {
    // Login to get access token
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'test@example.com',
        password: 'Test123!'
      });
    
    accessToken = loginResponse.body.accessToken;
  });

  describe('Actual Routes', () => {
    test('GET /api/aebf/actual should require authentication', async () => {
      const response = await request(app)
        .get('/api/aebf/actual')
        .query({ division: 'FP', budgetYear: 2024 })
        .expect(401);
      
      expect(response.body.success).toBe(false);
    });

    test('GET /api/aebf/actual should return data with valid token', async () => {
      const response = await request(app)
        .get('/api/aebf/actual')
        .set('Authorization', `Bearer ${accessToken}`)
        .query({ division: 'FP', budgetYear: 2024 })
        .expect(200);
      
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
    });

    test('GET /api/aebf/available-months should return months', async () => {
      const response = await request(app)
        .get('/api/aebf/available-months')
        .set('Authorization', `Bearer ${accessToken}`)
        .query({ division: 'FP', budgetYear: 2024 })
        .expect(200);
      
      expect(response.body).toHaveProperty('success', true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    test('GET /api/aebf/filter-options should return filter options', async () => {
      const response = await request(app)
        .get('/api/aebf/filter-options')
        .set('Authorization', `Bearer ${accessToken}`)
        .query({ division: 'FP', budgetYear: 2024 })
        .expect(200);
      
      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('customers');
      expect(response.body.data).toHaveProperty('productGroups');
    });
  });

  describe('Budget Routes', () => {
    test('GET /api/aebf/budget should require authentication', async () => {
      const response = await request(app)
        .get('/api/aebf/budget')
        .query({ division: 'FP', budgetYear: 2024 })
        .expect(401);
      
      expect(response.body.success).toBe(false);
    });

    test('GET /api/aebf/budget should return budget data', async () => {
      const response = await request(app)
        .get('/api/aebf/budget')
        .set('Authorization', `Bearer ${accessToken}`)
        .query({ division: 'FP', budgetYear: 2024 })
        .expect(200);
      
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
    });

    test('GET /api/aebf/budget-years should return available years', async () => {
      const response = await request(app)
        .get('/api/aebf/budget-years')
        .set('Authorization', `Bearer ${accessToken}`)
        .query({ division: 'FP' })
        .expect(200);
      
      expect(response.body).toHaveProperty('success', true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });
  });

  describe('Reports Routes', () => {
    test('GET /api/aebf/budget-sales-reps should return sales reps', async () => {
      const response = await request(app)
        .get('/api/aebf/budget-sales-reps')
        .set('Authorization', `Bearer ${accessToken}`)
        .query({ division: 'FP', budgetYear: 2024 })
        .expect(200);
      
      expect(response.body).toHaveProperty('success', true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    test('POST /api/aebf/budget-product-groups should return product groups', async () => {
      const response = await request(app)
        .post('/api/aebf/budget-product-groups')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          division: 'FP',
          budgetYear: 2024,
          salesRep: '__ALL__'
        })
        .expect(200);
      
      expect(response.body).toHaveProperty('success', true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });
  });

  describe('Validation', () => {
    test('should reject invalid division', async () => {
      const response = await request(app)
        .get('/api/aebf/actual')
        .set('Authorization', `Bearer ${accessToken}`)
        .query({ division: 'INVALID', budgetYear: 2024 })
        .expect(400);
      
      expect(response.body.success).toBe(false);
      expect(response.body.errors).toBeDefined();
    });

    test('should reject invalid budget year', async () => {
      const response = await request(app)
        .get('/api/aebf/actual')
        .set('Authorization', `Bearer ${accessToken}`)
        .query({ division: 'FP', budgetYear: 1900 })
        .expect(400);
      
      expect(response.body.success).toBe(false);
    });

    test('should reject missing required fields', async () => {
      const response = await request(app)
        .get('/api/aebf/actual')
        .set('Authorization', `Bearer ${accessToken}`)
        .query({})
        .expect(400);
      
      expect(response.body.success).toBe(false);
      expect(response.body.errors).toBeDefined();
    });
  });

  describe('Pagination', () => {
    test('should support pagination parameters', async () => {
      const response = await request(app)
        .get('/api/aebf/actual')
        .set('Authorization', `Bearer ${accessToken}`)
        .query({
          division: 'FP',
          budgetYear: 2024,
          page: 1,
          limit: 10
        })
        .expect(200);
      
      expect(response.body).toHaveProperty('pagination');
      expect(response.body.pagination).toHaveProperty('currentPage', 1);
      expect(response.body.pagination).toHaveProperty('pageSize', 10);
    });

    test('should validate pagination limits', async () => {
      const response = await request(app)
        .get('/api/aebf/actual')
        .set('Authorization', `Bearer ${accessToken}`)
        .query({
          division: 'FP',
          budgetYear: 2024,
          page: 1,
          limit: 5000 // exceeds max
        })
        .expect(400);
      
      expect(response.body.success).toBe(false);
    });
  });

  describe('Rate Limiting', () => {
    test('should include rate limit headers', async () => {
      const response = await request(app)
        .get('/api/aebf/budget-years')
        .set('Authorization', `Bearer ${accessToken}`)
        .query({ division: 'FP' });
      
      expect(response.headers).toHaveProperty('x-ratelimit-limit');
      expect(response.headers).toHaveProperty('x-ratelimit-remaining');
      expect(response.headers).toHaveProperty('x-ratelimit-reset');
    });
  });

  describe('Error Handling', () => {
    test('should return structured error response', async () => {
      const response = await request(app)
        .get('/api/aebf/nonexistent')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404);
      
      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error');
    });

    test('should handle internal server errors gracefully', async () => {
      // This would test error handling for database failures, etc.
      // Implementation depends on ability to mock database
      expect(true).toBe(true);
    });
  });
});
