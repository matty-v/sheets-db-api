import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createTestApp } from './setup';
import { TEST_SPREADSHEET_ID } from './e2e.setup';

describe('E2E API Tests', () => {
  const app = createTestApp();
  const spreadsheetId = TEST_SPREADSHEET_ID;
  const testSheetName = `E2E_Test_${Date.now()}`;
  let createdSheetId: number;

  describe('Health Check', () => {
    it('should return healthy status', async () => {
      const response = await request(app).get('/health');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ status: 'ok' });
    });
  });

  describe('Sheets Operations', () => {
    it('should list existing sheets', async () => {
      const response = await request(app)
        .get('/sheets')
        .set('X-Spreadsheet-Id', spreadsheetId);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('sheets');
      expect(Array.isArray(response.body.sheets)).toBe(true);
    });

    it('should create a new sheet', async () => {
      const response = await request(app)
        .post('/sheets')
        .set('X-Spreadsheet-Id', spreadsheetId)
        .send({ name: testSheetName });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('sheet');
      expect(response.body.sheet.title).toBe(testSheetName);
      expect(typeof response.body.sheet.sheetId).toBe('number');

      createdSheetId = response.body.sheet.sheetId;
    });

    it('should list sheets including the newly created one', async () => {
      const response = await request(app)
        .get('/sheets')
        .set('X-Spreadsheet-Id', spreadsheetId);

      expect(response.status).toBe(200);
      const sheetTitles = response.body.sheets.map((s: { title: string }) => s.title);
      expect(sheetTitles).toContain(testSheetName);
    });

    it('should get empty schema for new sheet', async () => {
      const response = await request(app)
        .get(`/sheets/${testSheetName}/schema`)
        .set('X-Spreadsheet-Id', spreadsheetId);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('columns');
      expect(response.body.columns).toEqual([]);
    });
  });

  describe('Rows Operations', () => {
    it('should get empty rows for new sheet', async () => {
      const response = await request(app)
        .get(`/sheets/${testSheetName}/rows`)
        .set('X-Spreadsheet-Id', spreadsheetId);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('rows');
      expect(response.body.rows).toEqual([]);
    });

    it('should create first row (also creates headers)', async () => {
      const rowData = {
        id: 1,
        name: 'John Doe',
        email: 'john@example.com',
        active: true,
      };

      const response = await request(app)
        .post(`/sheets/${testSheetName}/rows`)
        .set('X-Spreadsheet-Id', spreadsheetId)
        .send(rowData);

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('rowIndex');
      expect(response.body.rowIndex).toBe(2);
    });

    it('should get schema after first row creation', async () => {
      const response = await request(app)
        .get(`/sheets/${testSheetName}/schema`)
        .set('X-Spreadsheet-Id', spreadsheetId);

      expect(response.status).toBe(200);
      expect(response.body.columns).toContain('id');
      expect(response.body.columns).toContain('name');
      expect(response.body.columns).toContain('email');
      expect(response.body.columns).toContain('active');
    });

    it('should create a second row', async () => {
      const rowData = {
        id: 2,
        name: 'Jane Doe',
        email: 'jane@example.com',
        active: false,
      };

      const response = await request(app)
        .post(`/sheets/${testSheetName}/rows`)
        .set('X-Spreadsheet-Id', spreadsheetId)
        .send(rowData);

      expect(response.status).toBe(201);
      expect(response.body.rowIndex).toBe(3);
    });

    it('should get all rows', async () => {
      const response = await request(app)
        .get(`/sheets/${testSheetName}/rows`)
        .set('X-Spreadsheet-Id', spreadsheetId);

      expect(response.status).toBe(200);
      expect(response.body.rows).toHaveLength(2);
      expect(response.body.rows[0].name).toBe('John Doe');
      expect(response.body.rows[1].name).toBe('Jane Doe');
    });

    it('should get a specific row by index', async () => {
      const response = await request(app)
        .get(`/sheets/${testSheetName}/rows/2`)
        .set('X-Spreadsheet-Id', spreadsheetId);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('row');
      expect(response.body.row.name).toBe('John Doe');
    });

    it('should update a row', async () => {
      const updatedData = {
        id: 1,
        name: 'John Updated',
        email: 'john.updated@example.com',
        active: false,
      };

      const updateResponse = await request(app)
        .put(`/sheets/${testSheetName}/rows/2`)
        .set('X-Spreadsheet-Id', spreadsheetId)
        .send(updatedData);

      expect(updateResponse.status).toBe(204);

      // Verify the update
      const getResponse = await request(app)
        .get(`/sheets/${testSheetName}/rows/2`)
        .set('X-Spreadsheet-Id', spreadsheetId);

      expect(getResponse.body.row.name).toBe('John Updated');
      expect(getResponse.body.row.email).toBe('john.updated@example.com');
    });

    it('should delete a row', async () => {
      const deleteResponse = await request(app)
        .delete(`/sheets/${testSheetName}/rows/3`)
        .set('X-Spreadsheet-Id', spreadsheetId);

      expect(deleteResponse.status).toBe(204);

      // Verify only one row remains
      const getResponse = await request(app)
        .get(`/sheets/${testSheetName}/rows`)
        .set('X-Spreadsheet-Id', spreadsheetId);

      expect(getResponse.body.rows).toHaveLength(1);
    });

    it('should return 404 for non-existent row', async () => {
      const response = await request(app)
        .get(`/sheets/${testSheetName}/rows/999`)
        .set('X-Spreadsheet-Id', spreadsheetId);

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error');
    });

    it('should return 400 for invalid row index', async () => {
      const response = await request(app)
        .get(`/sheets/${testSheetName}/rows/1`)
        .set('X-Spreadsheet-Id', spreadsheetId);

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('rowIndex');
    });
  });

  describe('Error Handling', () => {
    it('should return 400 when X-Spreadsheet-Id header is missing', async () => {
      const response = await request(app).get('/sheets');

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('X-Spreadsheet-Id');
    });

    it('should return 400 when creating sheet without name', async () => {
      const response = await request(app)
        .post('/sheets')
        .set('X-Spreadsheet-Id', spreadsheetId)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('name');
    });
  });

  describe('Cleanup', () => {
    it('should delete the test sheet', async () => {
      const response = await request(app)
        .delete(`/sheets/${testSheetName}`)
        .set('X-Spreadsheet-Id', spreadsheetId);

      expect(response.status).toBe(204);
    });

    it('should confirm test sheet is deleted', async () => {
      const response = await request(app)
        .get('/sheets')
        .set('X-Spreadsheet-Id', spreadsheetId);

      const sheetTitles = response.body.sheets.map((s: { title: string }) => s.title);
      expect(sheetTitles).not.toContain(testSheetName);
    });
  });
});
