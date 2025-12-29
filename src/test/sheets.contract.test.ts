import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { createTestApp } from './setup';
import { expectContractCompliance } from './contractValidator';
import * as sheetsService from '../services/sheetsService';

vi.mock('../services/sheetsService');

const mockedSheetsService = vi.mocked(sheetsService);

describe('Sheets Endpoint Contract Tests', () => {
  const app = createTestApp();
  const spreadsheetId = 'test-spreadsheet-id';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /sheets', () => {
    it('should return 200 with sheets list matching OpenAPI schema', async () => {
      const mockSheets = [
        { sheetId: 0, title: 'Sheet1', index: 0 },
        { sheetId: 1, title: 'Users', index: 1 },
      ];

      mockedSheetsService.listSheets.mockResolvedValue(mockSheets);

      const response = await request(app)
        .get('/sheets')
        .set('X-Spreadsheet-Id', spreadsheetId);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('sheets');
      expect(Array.isArray(response.body.sheets)).toBe(true);

      expectContractCompliance('/sheets', 'get', 200, response.body);
    });

    it('should return 200 with empty sheets array', async () => {
      mockedSheetsService.listSheets.mockResolvedValue([]);

      const response = await request(app)
        .get('/sheets')
        .set('X-Spreadsheet-Id', spreadsheetId);

      expect(response.status).toBe(200);
      expect(response.body.sheets).toEqual([]);

      expectContractCompliance('/sheets', 'get', 200, response.body);
    });

    it('should return 400 when X-Spreadsheet-Id header is missing', async () => {
      const response = await request(app).get('/sheets');

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('X-Spreadsheet-Id');

      expectContractCompliance('/sheets', 'get', 400, response.body);
    });

    it('should return 500 when service throws an error', async () => {
      mockedSheetsService.listSheets.mockRejectedValue(new Error('API Error'));

      const response = await request(app)
        .get('/sheets')
        .set('X-Spreadsheet-Id', spreadsheetId);

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error');

      expectContractCompliance('/sheets', 'get', 500, response.body);
    });
  });

  describe('POST /sheets', () => {
    it('should return 201 with created sheet matching OpenAPI schema', async () => {
      const mockSheet = { sheetId: 123, title: 'NewSheet', index: 2 };

      mockedSheetsService.createSheet.mockResolvedValue(mockSheet);

      const response = await request(app)
        .post('/sheets')
        .set('X-Spreadsheet-Id', spreadsheetId)
        .send({ name: 'NewSheet' });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('sheet');
      expect(response.body.sheet).toHaveProperty('sheetId');
      expect(response.body.sheet).toHaveProperty('title');
      expect(response.body.sheet).toHaveProperty('index');

      expectContractCompliance('/sheets', 'post', 201, response.body);
    });

    it('should return 400 when name is missing', async () => {
      const response = await request(app)
        .post('/sheets')
        .set('X-Spreadsheet-Id', spreadsheetId)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('name');

      expectContractCompliance('/sheets', 'post', 400, response.body);
    });

    it('should return 400 when name is not a string', async () => {
      const response = await request(app)
        .post('/sheets')
        .set('X-Spreadsheet-Id', spreadsheetId)
        .send({ name: 123 });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');

      expectContractCompliance('/sheets', 'post', 400, response.body);
    });

    it('should return 400 when X-Spreadsheet-Id header is missing', async () => {
      const response = await request(app)
        .post('/sheets')
        .send({ name: 'NewSheet' });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');

      expectContractCompliance('/sheets', 'post', 400, response.body);
    });

    it('should return 500 when service throws an error', async () => {
      mockedSheetsService.createSheet.mockRejectedValue(new Error('API Error'));

      const response = await request(app)
        .post('/sheets')
        .set('X-Spreadsheet-Id', spreadsheetId)
        .send({ name: 'NewSheet' });

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error');

      expectContractCompliance('/sheets', 'post', 500, response.body);
    });
  });

  describe('DELETE /sheets/{sheetName}', () => {
    it('should return 204 when sheet is deleted successfully', async () => {
      mockedSheetsService.deleteSheet.mockResolvedValue();

      const response = await request(app)
        .delete('/sheets/TestSheet')
        .set('X-Spreadsheet-Id', spreadsheetId);

      expect(response.status).toBe(204);
      expect(response.body).toEqual({});
    });

    it('should return 404 when sheet is not found', async () => {
      mockedSheetsService.deleteSheet.mockRejectedValue(
        new Error('Sheet "NonExistent" not found')
      );

      const response = await request(app)
        .delete('/sheets/NonExistent')
        .set('X-Spreadsheet-Id', spreadsheetId);

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error');

      expectContractCompliance('/sheets/{sheetName}', 'delete', 404, response.body);
    });

    it('should return 400 when X-Spreadsheet-Id header is missing', async () => {
      const response = await request(app).delete('/sheets/TestSheet');

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');

      expectContractCompliance('/sheets/{sheetName}', 'delete', 400, response.body);
    });

    it('should return 500 when service throws an error', async () => {
      mockedSheetsService.deleteSheet.mockRejectedValue(new Error('API Error'));

      const response = await request(app)
        .delete('/sheets/TestSheet')
        .set('X-Spreadsheet-Id', spreadsheetId);

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error');

      expectContractCompliance('/sheets/{sheetName}', 'delete', 500, response.body);
    });
  });

  describe('GET /sheets/{sheetName}/schema', () => {
    it('should return 200 with schema matching OpenAPI spec', async () => {
      const mockColumns = ['id', 'name', 'email', 'created_at'];

      mockedSheetsService.getSchema.mockResolvedValue(mockColumns);

      const response = await request(app)
        .get('/sheets/Users/schema')
        .set('X-Spreadsheet-Id', spreadsheetId);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('columns');
      expect(Array.isArray(response.body.columns)).toBe(true);

      expectContractCompliance('/sheets/{sheetName}/schema', 'get', 200, response.body);
    });

    it('should return 200 with empty columns array', async () => {
      mockedSheetsService.getSchema.mockResolvedValue([]);

      const response = await request(app)
        .get('/sheets/EmptySheet/schema')
        .set('X-Spreadsheet-Id', spreadsheetId);

      expect(response.status).toBe(200);
      expect(response.body.columns).toEqual([]);

      expectContractCompliance('/sheets/{sheetName}/schema', 'get', 200, response.body);
    });

    it('should return 400 when X-Spreadsheet-Id header is missing', async () => {
      const response = await request(app).get('/sheets/Users/schema');

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');

      expectContractCompliance('/sheets/{sheetName}/schema', 'get', 400, response.body);
    });

    it('should return 500 when service throws an error', async () => {
      mockedSheetsService.getSchema.mockRejectedValue(new Error('API Error'));

      const response = await request(app)
        .get('/sheets/Users/schema')
        .set('X-Spreadsheet-Id', spreadsheetId);

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error');

      expectContractCompliance('/sheets/{sheetName}/schema', 'get', 500, response.body);
    });
  });
});
