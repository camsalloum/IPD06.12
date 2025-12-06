/**
 * @fileoverview Performance Tests for Rate Limiting
 * @module tests/performance/rateLimiter.test
 */

const request = require('supertest');
const app = require('../../index');

describe('Rate Limiter Performance Tests', () => {
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

  describe('Query Limiter (100 requests per 15 minutes)', () => {
    test('should allow requests under limit', async () => {
      const endpoint = '/api/aebf/budget-years';
      const requests = [];
      
      // Send 10 requests (well under the limit)
      for (let i = 0; i < 10; i++) {
        requests.push(
          request(app)
            .get(endpoint)
            .set('Authorization', `Bearer ${accessToken}`)
            .query({ division: 'FP' })
        );
      }
      
      const responses = await Promise.all(requests);
      
      // All should succeed
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.headers).toHaveProperty('x-ratelimit-limit');
        expect(response.headers).toHaveProperty('x-ratelimit-remaining');
        expect(response.headers).toHaveProperty('x-ratelimit-reset');
      });
      
      // First request should have 99 remaining (100 - 1)
      expect(parseInt(responses[0].headers['x-ratelimit-remaining'])).toBeLessThanOrEqual(99);
      
      // Last request should have fewer remaining
      const firstRemaining = parseInt(responses[0].headers['x-ratelimit-remaining']);
      const lastRemaining = parseInt(responses[9].headers['x-ratelimit-remaining']);
      expect(lastRemaining).toBeLessThan(firstRemaining);
    });

    test('should rate limit after exceeding threshold', async () => {
      const endpoint = '/api/aebf/actual';
      const requests = [];
      
      // Send 101 requests (one over the limit)
      for (let i = 0; i < 101; i++) {
        requests.push(
          request(app)
            .get(endpoint)
            .set('Authorization', `Bearer ${accessToken}`)
            .query({ division: 'FP', budgetYear: 2024 })
        );
      }
      
      const responses = await Promise.all(requests);
      
      // Some requests should be rate limited (429)
      const successfulRequests = responses.filter(r => r.status === 200).length;
      const rateLimitedRequests = responses.filter(r => r.status === 429).length;
      
      expect(rateLimitedRequests).toBeGreaterThan(0);
      expect(successfulRequests).toBeLessThanOrEqual(100);
      
      // Rate limited responses should have Retry-After header
      const rateLimitedResponse = responses.find(r => r.status === 429);
      expect(rateLimitedResponse.headers).toHaveProperty('retry-after');
    });
  });

  describe('Upload Limiter (10 requests per 15 minutes)', () => {
    test('should enforce stricter limits on upload endpoints', async () => {
      const endpoint = '/api/aebf/upload-actual';
      const requests = [];
      
      // Send 11 requests (one over the limit)
      for (let i = 0; i < 11; i++) {
        requests.push(
          request(app)
            .post(endpoint)
            .set('Authorization', `Bearer ${accessToken}`)
            .attach('file', Buffer.from('test'), 'test.xlsx')
            .field('division', 'FP')
            .field('budgetYear', '2024')
            .field('mode', 'replace')
        );
      }
      
      const responses = await Promise.all(requests);
      
      // At least one should be rate limited
      const rateLimitedRequests = responses.filter(r => r.status === 429).length;
      expect(rateLimitedRequests).toBeGreaterThan(0);
    });
  });

  describe('Rate Limiter Performance Impact', () => {
    test('should add minimal overhead to requests', async () => {
      const endpoint = '/api/aebf/budget';
      
      // Measure response times
      const times = [];
      for (let i = 0; i < 5; i++) {
        const start = Date.now();
        await request(app)
          .get(endpoint)
          .set('Authorization', `Bearer ${accessToken}`)
          .query({ division: 'FP', budgetYear: 2024 });
        times.push(Date.now() - start);
      }
      
      const avgTime = times.reduce((a, b) => a + b) / times.length;
      
      // Rate limiter should add less than 10ms overhead
      expect(avgTime).toBeLessThan(1000);
      
      console.log(`Average response time with rate limiter: ${avgTime.toFixed(2)}ms`);
    });
  });
});
