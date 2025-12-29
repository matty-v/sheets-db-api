import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { createTestApp } from './setup';
import { expectContractCompliance } from './contractValidator';
import * as sheetsService from '../services/sheetsService';

vi.mock('../services/sheetsService');

const mockedSheetsService = vi.mocked(sheetsService);

describe('Rows Endpoint Contract Tests', () => {
  const app = createTestApp();
  const spreadsheetId = 'test-spreadsheet-id';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /sheets/{sheetName}/rows', () => {
    it('should return 200 with rows list matching OpenAPI schema', async () => {
      const mockRows = [
        { id: 1, name: 'John Doe', email: 'john@example.com', active: true },
        { id: 2, name: 'Jane Doe', email: 'jane@example.com', active: false },
      ];

      mockedSheetsService.getRows.mockResolvedValue(mockRows);

      const response = await request(app)
        .get('/sheets/Users/rows')
        .set('X-Spreadsheet-Id', spreadsheetId);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('rows');
      expect(Array.isArray(response.body.rows)).toBe(true);

      expectContractCompliance('/sheets/{sheetName}/rows', 'get', 200, response.body);
    });

    it('should return 200 with empty rows array', async () => {
      mockedSheetsService.getRows.mockResolvedValue([]);

      const response = await request(app)
        .get('/sheets/EmptySheet/rows')
        .set('X-Spreadsheet-Id', spreadsheetId);

      expect(response.status).toBe(200);
      expect(response.body.rows).toEqual([]);

      expectContractCompliance('/sheets/{sheetName}/rows', 'get', 200, response.body);
    });

    it('should return 200 with rows containing null values', async () => {
      const mockRows = [
        { id: 1, name: 'John', email: null, score: 95.5 },
      ];

      mockedSheetsService.getRows.mockResolvedValue(mockRows);

      const response = await request(app)
        .get('/sheets/Users/rows')
        .set('X-Spreadsheet-Id', spreadsheetId);

      expect(response.status).toBe(200);

      expectContractCompliance('/sheets/{sheetName}/rows', 'get', 200, response.body);
    });

    it('should return 400 when X-Spreadsheet-Id header is missing', async () => {
      const response = await request(app).get('/sheets/Users/rows');

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');

      expectContractCompliance('/sheets/{sheetName}/rows', 'get', 400, response.body);
    });

    it('should return 500 when service throws an error', async () => {
      mockedSheetsService.getRows.mockRejectedValue(new Error('API Error'));

      const response = await request(app)
        .get('/sheets/Users/rows')
        .set('X-Spreadsheet-Id', spreadsheetId);

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error');

      expectContractCompliance('/sheets/{sheetName}/rows', 'get', 500, response.body);
    });
  });

  describe('GET /sheets/{sheetName}/rows/{rowIndex}', () => {
    it('should return 200 with single row matching OpenAPI schema', async () => {
      const mockRow = { id: 1, name: 'John Doe', email: 'john@example.com' };

      mockedSheetsService.getRow.mockResolvedValue(mockRow);

      const response = await request(app)
        .get('/sheets/Users/rows/2')
        .set('X-Spreadsheet-Id', spreadsheetId);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('row');

      expectContractCompliance(
        '/sheets/{sheetName}/rows/{rowIndex}',
        'get',
        200,
        response.body
      );
    });

    it('should return 400 when rowIndex is less than 2', async () => {
      const response = await request(app)
        .get('/sheets/Users/rows/1')
        .set('X-Spreadsheet-Id', spreadsheetId);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('rowIndex');

      expectContractCompliance(
        '/sheets/{sheetName}/rows/{rowIndex}',
        'get',
        400,
        response.body
      );
    });

    it('should return 400 when rowIndex is not a number', async () => {
      const response = await request(app)
        .get('/sheets/Users/rows/abc')
        .set('X-Spreadsheet-Id', spreadsheetId);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');

      expectContractCompliance(
        '/sheets/{sheetName}/rows/{rowIndex}',
        'get',
        400,
        response.body
      );
    });

    it('should return 404 when row is not found', async () => {
      mockedSheetsService.getRow.mockResolvedValue(null);

      const response = await request(app)
        .get('/sheets/Users/rows/999')
        .set('X-Spreadsheet-Id', spreadsheetId);

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error');

      expectContractCompliance(
        '/sheets/{sheetName}/rows/{rowIndex}',
        'get',
        404,
        response.body
      );
    });

    it('should return 400 when X-Spreadsheet-Id header is missing', async () => {
      const response = await request(app).get('/sheets/Users/rows/2');

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');

      expectContractCompliance(
        '/sheets/{sheetName}/rows/{rowIndex}',
        'get',
        400,
        response.body
      );
    });

    it('should return 500 when service throws an error', async () => {
      mockedSheetsService.getRow.mockRejectedValue(new Error('API Error'));

      const response = await request(app)
        .get('/sheets/Users/rows/2')
        .set('X-Spreadsheet-Id', spreadsheetId);

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error');

      expectContractCompliance(
        '/sheets/{sheetName}/rows/{rowIndex}',
        'get',
        500,
        response.body
      );
    });
  });

  describe('POST /sheets/{sheetName}/rows', () => {
    it('should return 201 with rowIndex matching OpenAPI schema', async () => {
      mockedSheetsService.appendRow.mockResolvedValue({ rowIndex: 5 });

      const response = await request(app)
        .post('/sheets/Users/rows')
        .set('X-Spreadsheet-Id', spreadsheetId)
        .send({ id: 1, name: 'John Doe', email: 'john@example.com' });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('rowIndex');
      expect(typeof response.body.rowIndex).toBe('number');

      expectContractCompliance('/sheets/{sheetName}/rows', 'post', 201, response.body);
    });

    it('should return 201 with various data types', async () => {
      mockedSheetsService.appendRow.mockResolvedValue({ rowIndex: 6 });

      const response = await request(app)
        .post('/sheets/Users/rows')
        .set('X-Spreadsheet-Id', spreadsheetId)
        .send({
          id: 1,
          name: 'John Doe',
          score: 95.5,
          active: true,
          notes: null,
        });

      expect(response.status).toBe(201);

      expectContractCompliance('/sheets/{sheetName}/rows', 'post', 201, response.body);
    });

    it('should return 400 when X-Spreadsheet-Id header is missing', async () => {
      const response = await request(app)
        .post('/sheets/Users/rows')
        .send({ name: 'John' });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');

      expectContractCompliance('/sheets/{sheetName}/rows', 'post', 400, response.body);
    });

    it('should return 500 when service throws an error', async () => {
      mockedSheetsService.appendRow.mockRejectedValue(new Error('API Error'));

      const response = await request(app)
        .post('/sheets/Users/rows')
        .set('X-Spreadsheet-Id', spreadsheetId)
        .send({ name: 'John' });

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error');

      expectContractCompliance('/sheets/{sheetName}/rows', 'post', 500, response.body);
    });
  });

  describe('PUT /sheets/{sheetName}/rows/{rowIndex}', () => {
    it('should return 204 when row is updated successfully', async () => {
      mockedSheetsService.updateRow.mockResolvedValue();

      const response = await request(app)
        .put('/sheets/Users/rows/2')
        .set('X-Spreadsheet-Id', spreadsheetId)
        .send({ id: 1, name: 'Updated Name' });

      expect(response.status).toBe(204);
      expect(response.body).toEqual({});
    });

    it('should return 400 when rowIndex is less than 2', async () => {
      const response = await request(app)
        .put('/sheets/Users/rows/1')
        .set('X-Spreadsheet-Id', spreadsheetId)
        .send({ name: 'Test' });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');

      expectContractCompliance(
        '/sheets/{sheetName}/rows/{rowIndex}',
        'put',
        400,
        response.body
      );
    });

    it('should return 400 when X-Spreadsheet-Id header is missing', async () => {
      const response = await request(app)
        .put('/sheets/Users/rows/2')
        .send({ name: 'John' });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');

      expectContractCompliance(
        '/sheets/{sheetName}/rows/{rowIndex}',
        'put',
        400,
        response.body
      );
    });

    it('should return 500 when service throws an error', async () => {
      mockedSheetsService.updateRow.mockRejectedValue(new Error('API Error'));

      const response = await request(app)
        .put('/sheets/Users/rows/2')
        .set('X-Spreadsheet-Id', spreadsheetId)
        .send({ name: 'John' });

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error');

      expectContractCompliance(
        '/sheets/{sheetName}/rows/{rowIndex}',
        'put',
        500,
        response.body
      );
    });
  });

  describe('DELETE /sheets/{sheetName}/rows/{rowIndex}', () => {
    it('should return 204 when row is deleted successfully', async () => {
      mockedSheetsService.deleteRow.mockResolvedValue();

      const response = await request(app)
        .delete('/sheets/Users/rows/2')
        .set('X-Spreadsheet-Id', spreadsheetId);

      expect(response.status).toBe(204);
      expect(response.body).toEqual({});
    });

    it('should return 400 when rowIndex is less than 2', async () => {
      const response = await request(app)
        .delete('/sheets/Users/rows/1')
        .set('X-Spreadsheet-Id', spreadsheetId);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');

      expectContractCompliance(
        '/sheets/{sheetName}/rows/{rowIndex}',
        'delete',
        400,
        response.body
      );
    });

    it('should return 400 when rowIndex is not a number', async () => {
      const response = await request(app)
        .delete('/sheets/Users/rows/abc')
        .set('X-Spreadsheet-Id', spreadsheetId);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');

      expectContractCompliance(
        '/sheets/{sheetName}/rows/{rowIndex}',
        'delete',
        400,
        response.body
      );
    });

    it('should return 400 when X-Spreadsheet-Id header is missing', async () => {
      const response = await request(app).delete('/sheets/Users/rows/2');

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');

      expectContractCompliance(
        '/sheets/{sheetName}/rows/{rowIndex}',
        'delete',
        400,
        response.body
      );
    });

    it('should return 500 when service throws an error', async () => {
      mockedSheetsService.deleteRow.mockRejectedValue(new Error('API Error'));

      const response = await request(app)
        .delete('/sheets/Users/rows/2')
        .set('X-Spreadsheet-Id', spreadsheetId);

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error');

      expectContractCompliance(
        '/sheets/{sheetName}/rows/{rowIndex}',
        'delete',
        500,
        response.body
      );
    });
  });
});
