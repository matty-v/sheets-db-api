import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createTestApp } from './setup';
import { expectContractCompliance } from './contractValidator';

describe('Health Endpoint Contract Tests', () => {
  const app = createTestApp();

  describe('GET /health', () => {
    it('should return 200 with health status matching OpenAPI schema', async () => {
      const response = await request(app).get('/health');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status');
      expect(response.body.status).toBe('ok');

      expectContractCompliance('/health', 'get', 200, response.body);
    });

    it('should return Content-Type application/json', async () => {
      const response = await request(app).get('/health');

      expect(response.headers['content-type']).toMatch(/application\/json/);
    });
  });
});
