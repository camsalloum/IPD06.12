/**
 * @fileoverview Integration Tests for Caching Middleware
 * @module tests/integration/cache.test
 */

const request = require('supertest');
const app = require('../../index');
const { invalidateCache, getCacheStats } = require('../../middleware/cache');

describe('Caching Middleware Integration Tests', () => {
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

  beforeEach(async () => {
    // Clear cache before each test
    await invalidateCache('*');
  });

  describe('Cache Hit/Miss', () => {
    test('should miss cache on first request and hit on second', async () => {
      const endpoint = '/api/aebf/budget-years';
      const query = { division: 'FP' };
      
      // First request - cache miss
      const firstResponse = await request(app)
        .get(endpoint)
        .set('Authorization', `Bearer ${accessToken}`)
        .query(query)
        .expect(200);
      
      expect(firstResponse.body.cached).toBeUndefined();
      
      // Second request - cache hit
      const secondResponse = await request(app)
        .get(endpoint)
        .set('Authorization', `Bearer ${accessToken}`)
        .query(query)
        .expect(200);
      
      expect(secondResponse.body.cached).toBe(true);
      
      // Data should be identical
      expect(secondResponse.body.data).toEqual(firstResponse.body.data);
    });

    test('should have different cache for different query params', async () => {
      const endpoint = '/api/aebf/actual';
      
      // Request for division FP
      const fpResponse = await request(app)
        .get(endpoint)
        .set('Authorization', `Bearer ${accessToken}`)
        .query({ division: 'FP', budgetYear: 2024 })
        .expect(200);
      
      // Request for division HC
      const hcResponse = await request(app)
        .get(endpoint)
        .set('Authorization', `Bearer ${accessToken}`)
        .query({ division: 'HC', budgetYear: 2024 })
        .expect(200);
      
      // Both should be cache misses (different keys)
      expect(fpResponse.body.cached).toBeUndefined();
      expect(hcResponse.body.cached).toBeUndefined();
      
      // Data should be different
      expect(fpResponse.body.data).not.toEqual(hcResponse.body.data);
    });
  });

  describe('Cache Invalidation', () => {
    test('should invalidate cache after data modification', async () => {
      const getEndpoint = '/api/aebf/budget';
      const uploadEndpoint = '/api/aebf/upload-budget';
      
      // First request - populate cache
      await request(app)
        .get(getEndpoint)
        .set('Authorization', `Bearer ${accessToken}`)
        .query({ division: 'FP', budgetYear: 2024 });
      
      // Upload new data - should invalidate cache
      await request(app)
        .post(uploadEndpoint)
        .set('Authorization', `Bearer ${accessToken}`)
        .attach('file', Buffer.from('test data'), 'test.xlsx')
        .field('division', 'FP')
        .field('budgetYear', '2024')
        .field('mode', 'replace');
      
      // Next request should be cache miss
      const afterUploadResponse = await request(app)
        .get(getEndpoint)
        .set('Authorization', `Bearer ${accessToken}`)
        .query({ division: 'FP', budgetYear: 2024 });
      
      expect(afterUploadResponse.body.cached).toBeUndefined();
    });
  });

  describe('Cache TTL', () => {
    test('should respect different TTL for different endpoints', async () => {
      // Budget years has VERY_LONG TTL (1 hour)
      const longTTLResponse = await request(app)
        .get('/api/aebf/budget-years')
        .set('Authorization', `Bearer ${accessToken}`)
        .query({ division: 'FP' });
      
      expect(longTTLResponse.status).toBe(200);
      
      // Actual has MEDIUM TTL (5 minutes)
      const mediumTTLResponse = await request(app)
        .get('/api/aebf/actual')
        .set('Authorization', `Bearer ${accessToken}`)
        .query({ division: 'FP', budgetYear: 2024 });
      
      expect(mediumTTLResponse.status).toBe(200);
      
      // Both should be cached on second request
      const stats = await getCacheStats();
      expect(stats.hits).toBeGreaterThan(0);
    });
  });

  describe('Cache Performance', () => {
    test('should significantly improve response time on cache hit', async () => {
      const endpoint = '/api/aebf/budget-product-groups';
      const requestData = {
        division: 'FP',
        budgetYear: 2024,
        salesRep: '__ALL__'
      };
      
      // First request - measure time
      const start1 = Date.now();
      await request(app)
        .post(endpoint)
        .set('Authorization', `Bearer ${accessToken}`)
        .send(requestData)
        .expect(200);
      const duration1 = Date.now() - start1;
      
      // Second request - should be faster
      const start2 = Date.now();
      const cachedResponse = await request(app)
        .post(endpoint)
        .set('Authorization', `Bearer ${accessToken}`)
        .send(requestData)
        .expect(200);
      const duration2 = Date.now() - start2;
      
      expect(cachedResponse.body.cached).toBe(true);
      expect(duration2).toBeLessThan(duration1);
      
      console.log(`Cache performance: ${duration1}ms → ${duration2}ms (${((1 - duration2/duration1) * 100).toFixed(1)}% faster)`);
    });
  });

  describe('Cache with Pagination', () => {
    test('should cache different pages separately', async () => {
      const endpoint = '/api/aebf/actual';
      
      // Request page 1
      const page1Response = await request(app)
        .get(endpoint)
        .set('Authorization', `Bearer ${accessToken}`)
        .query({ division: 'FP', budgetYear: 2024, page: 1, limit: 10 });
      
      // Request page 2
      const page2Response = await request(app)
        .get(endpoint)
        .set('Authorization', `Bearer ${accessToken}`)
        .query({ division: 'FP', budgetYear: 2024, page: 2, limit: 10 });
      
      // Both should be cache misses (different keys)
      expect(page1Response.body.cached).toBeUndefined();
      expect(page2Response.body.cached).toBeUndefined();
      
      // Request page 1 again - should be cached
      const page1CachedResponse = await request(app)
        .get(endpoint)
        .set('Authorization', `Bearer ${accessToken}`)
        .query({ division: 'FP', budgetYear: 2024, page: 1, limit: 10 });
      
      expect(page1CachedResponse.body.cached).toBe(true);
    });
  });
});
