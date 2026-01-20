import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { createTestApp } from './setup';
import { expectContractCompliance } from './contractValidator';
import * as sheetsService from '../services/sheetsService';

vi.mock('../services/sheetsService', () => ({
  getSchema: vi.fn(),
  getRows: vi.fn(),
  getRow: vi.fn(),
  appendRow: vi.fn(),
  updateRow: vi.fn(),
  deleteRow: vi.fn(),
  appendRows: vi.fn(),
  updateRows: vi.fn(),
}));

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

  describe('POST /sheets/{sheetName}/rows/bulk', () => {
    it('should create multiple rows and return their indices', async () => {
      const mockResults = [
        { rowIndex: 2, data: { name: 'Alice', email: 'alice@example.com', age: 30 } },
        { rowIndex: 3, data: { name: 'Bob', email: 'bob@example.com', age: 25 } },
      ];

      mockedSheetsService.appendRows.mockResolvedValue(mockResults);

      const rows = [
        { name: 'Alice', email: 'alice@example.com', age: 30 },
        { name: 'Bob', email: 'bob@example.com', age: 25 },
      ];

      const response = await request(app)
        .post('/sheets/Users/rows/bulk')
        .set('X-Spreadsheet-Id', spreadsheetId)
        .send({ rows });

      expect(response.status).toBe(201);
      expect(response.body.rows).toHaveLength(2);
      expect(response.body.rows[0]).toHaveProperty('rowIndex');
      expect(response.body.rows[0]).toHaveProperty('data');
      expect(response.body.rows[0].data).toEqual(rows[0]);
      expect(response.body.rows[1].data).toEqual(rows[1]);
    });

    it('should return 400 for empty rows array', async () => {
      const response = await request(app)
        .post('/sheets/Users/rows/bulk')
        .set('X-Spreadsheet-Id', spreadsheetId)
        .send({ rows: [] });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('empty');
    });

    it('should return 400 for missing rows field', async () => {
      const response = await request(app)
        .post('/sheets/Users/rows/bulk')
        .set('X-Spreadsheet-Id', spreadsheetId)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('rows');
    });

    it('should return 400 for exceeding 1000 row limit', async () => {
      const rows = Array.from({ length: 1001 }, (_, i) => ({ name: `User${i}` }));

      const response = await request(app)
        .post('/sheets/Users/rows/bulk')
        .set('X-Spreadsheet-Id', spreadsheetId)
        .send({ rows });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('1000');
    });

    it('should return 400 for invalid row format', async () => {
      const response = await request(app)
        .post('/sheets/Users/rows/bulk')
        .set('X-Spreadsheet-Id', spreadsheetId)
        .send({ rows: ['not an object', { valid: 'object' }] });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('object');
    });

    it('should return 500 when first row contains no properties', async () => {
      mockedSheetsService.appendRows.mockRejectedValue(
        new Error('Cannot create rows without any properties')
      );

      const response = await request(app)
        .post('/sheets/Users/rows/bulk')
        .set('X-Spreadsheet-Id', spreadsheetId)
        .send({ rows: [{}] });

      expect(response.status).toBe(500);
      expect(response.body.error).toContain('Cannot create rows without any properties');
    });
  });

  describe('PUT /sheets/{sheetName}/rows/bulk', () => {
    it('should update multiple rows and return merged data', async () => {
      const mockResults = [
        { rowIndex: 5, data: { id: 1, name: 'Alice Updated', email: 'alice@example.com', age: 31 } },
        { rowIndex: 8, data: { id: 2, name: 'Bob Updated', email: 'bob.new@example.com', age: 26 } },
      ];

      mockedSheetsService.updateRows.mockResolvedValue(mockResults);

      const rows = [
        { rowIndex: 5, data: { name: 'Alice Updated', age: 31 } },
        { rowIndex: 8, data: { name: 'Bob Updated', email: 'bob.new@example.com' } },
      ];

      const response = await request(app)
        .put('/sheets/Users/rows/bulk')
        .set('X-Spreadsheet-Id', spreadsheetId)
        .send({ rows });

      expect(response.status).toBe(200);
      expect(response.body.rows).toHaveLength(2);
      expect(response.body.rows[0]).toHaveProperty('rowIndex', 5);
      expect(response.body.rows[0]).toHaveProperty('data');
      expect(response.body.rows[0].data).toEqual(mockResults[0].data);
      expect(response.body.rows[1]).toHaveProperty('rowIndex', 8);
      expect(response.body.rows[1].data).toEqual(mockResults[1].data);
    });

    it('should return 400 for missing rows field', async () => {
      const response = await request(app)
        .put('/sheets/Users/rows/bulk')
        .set('X-Spreadsheet-Id', spreadsheetId)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('rows');
    });

    it('should return 400 when rows is not an array', async () => {
      const response = await request(app)
        .put('/sheets/Users/rows/bulk')
        .set('X-Spreadsheet-Id', spreadsheetId)
        .send({ rows: 'not an array' });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('array');
    });

    it('should return 400 for empty rows array', async () => {
      const response = await request(app)
        .put('/sheets/Users/rows/bulk')
        .set('X-Spreadsheet-Id', spreadsheetId)
        .send({ rows: [] });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('empty');
    });

    it('should return 400 for exceeding 1000 row limit', async () => {
      const rows = Array.from({ length: 1001 }, (_, i) => ({
        rowIndex: i + 2,
        data: { name: `User${i}` }
      }));

      const response = await request(app)
        .put('/sheets/Users/rows/bulk')
        .set('X-Spreadsheet-Id', spreadsheetId)
        .send({ rows });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('1000');
    });

    it('should return 400 when row item is not an object', async () => {
      const response = await request(app)
        .put('/sheets/Users/rows/bulk')
        .set('X-Spreadsheet-Id', spreadsheetId)
        .send({ rows: ['not an object'] });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('object');
    });

    it('should return 400 when row missing rowIndex field', async () => {
      const response = await request(app)
        .put('/sheets/Users/rows/bulk')
        .set('X-Spreadsheet-Id', spreadsheetId)
        .send({ rows: [{ data: { name: 'Alice' } }] });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('rowIndex');
    });

    it('should return 400 when row missing data field', async () => {
      const response = await request(app)
        .put('/sheets/Users/rows/bulk')
        .set('X-Spreadsheet-Id', spreadsheetId)
        .send({ rows: [{ rowIndex: 5 }] });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('data');
    });

    it('should return 400 when data is not an object', async () => {
      const response = await request(app)
        .put('/sheets/Users/rows/bulk')
        .set('X-Spreadsheet-Id', spreadsheetId)
        .send({ rows: [{ rowIndex: 5, data: 'not an object' }] });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('data must be an object');
    });

    it('should return 400 when rowIndex is less than 2', async () => {
      const response = await request(app)
        .put('/sheets/Users/rows/bulk')
        .set('X-Spreadsheet-Id', spreadsheetId)
        .send({ rows: [{ rowIndex: 1, data: { name: 'Alice' } }] });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('rowIndex must be >= 2');
    });

    it('should return 400 for duplicate rowIndex values', async () => {
      const response = await request(app)
        .put('/sheets/Users/rows/bulk')
        .set('X-Spreadsheet-Id', spreadsheetId)
        .send({
          rows: [
            { rowIndex: 5, data: { name: 'Alice' } },
            { rowIndex: 5, data: { name: 'Bob' } }
          ]
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Duplicate rowIndex');
      expect(response.body.error).toContain('5');
    });

    it('should update single row (minimum)', async () => {
      const mockResults = [
        { rowIndex: 5, data: { id: 1, name: 'Alice Updated', age: 31 } },
      ];

      mockedSheetsService.updateRows.mockResolvedValue(mockResults);

      const rows = [
        { rowIndex: 5, data: { name: 'Alice Updated' } },
      ];

      const response = await request(app)
        .put('/sheets/Users/rows/bulk')
        .set('X-Spreadsheet-Id', spreadsheetId)
        .send({ rows });

      expect(response.status).toBe(200);
      expect(response.body.rows).toHaveLength(1);
      expect(response.body.rows[0].rowIndex).toBe(5);
    });

    it('should handle empty data object', async () => {
      const mockResults = [
        { rowIndex: 5, data: { id: 1, name: 'Alice', age: 30 } },
      ];

      mockedSheetsService.updateRows.mockResolvedValue(mockResults);

      const rows = [
        { rowIndex: 5, data: {} },
      ];

      const response = await request(app)
        .put('/sheets/Users/rows/bulk')
        .set('X-Spreadsheet-Id', spreadsheetId)
        .send({ rows });

      expect(response.status).toBe(200);
      expect(response.body.rows[0].data).toEqual(mockResults[0].data);
    });
  });
});
