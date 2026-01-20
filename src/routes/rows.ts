import { Router, Request, Response } from 'express';
import * as sheetsService from '../services/sheetsService';

const router = Router({ mergeParams: true });

router.get('/', async (req: Request, res: Response) => {
  try {
    const { sheetName } = req.params;
    const rows = await sheetsService.getRows(req.spreadsheetId, sheetName);
    res.json({ rows });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

router.get('/:rowIndex', async (req: Request, res: Response) => {
  try {
    const { sheetName, rowIndex } = req.params;
    const index = parseInt(rowIndex, 10);

    if (isNaN(index) || index < 2) {
      res.status(400).json({
        error: 'Invalid rowIndex. Must be >= 2 (row 1 contains headers)',
      });
      return;
    }

    const row = await sheetsService.getRow(req.spreadsheetId, sheetName, index);

    if (!row) {
      res.status(404).json({ error: 'Row not found' });
      return;
    }

    res.json({ row });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

router.post('/', async (req: Request, res: Response) => {
  try {
    const { sheetName } = req.params;
    const data = req.body;

    if (!data || typeof data !== 'object') {
      res.status(400).json({ error: 'Request body must be an object' });
      return;
    }

    const result = await sheetsService.appendRow(
      req.spreadsheetId,
      sheetName,
      data
    );
    res.status(201).json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

router.post('/bulk', async (req: Request, res: Response) => {
  try {
    const { sheetName } = req.params;
    const { rows } = req.body;

    // Validate request body
    if (!rows) {
      res.status(400).json({ error: 'Request body must include rows array' });
      return;
    }

    if (!Array.isArray(rows)) {
      res.status(400).json({ error: 'rows must be an array' });
      return;
    }

    if (rows.length === 0) {
      res.status(400).json({ error: 'rows array cannot be empty' });
      return;
    }

    if (rows.length > 1000) {
      res.status(400).json({ error: 'Cannot create more than 1000 rows at once' });
      return;
    }

    for (const row of rows) {
      if (!row || typeof row !== 'object' || Array.isArray(row)) {
        res.status(400).json({ error: 'All items in rows array must be objects' });
        return;
      }
    }

    const results = await sheetsService.appendRows(
      req.spreadsheetId,
      sheetName,
      rows
    );

    res.status(201).json({ rows: results });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

router.put('/bulk', async (req: Request, res: Response) => {
  try {
    const { sheetName } = req.params;
    const { rows } = req.body;

    // Validate request body
    if (!rows) {
      res.status(400).json({ error: 'Request body must include rows array' });
      return;
    }

    if (!Array.isArray(rows)) {
      res.status(400).json({ error: 'rows must be an array' });
      return;
    }

    if (rows.length === 0) {
      res.status(400).json({ error: 'rows array cannot be empty' });
      return;
    }

    if (rows.length > 1000) {
      res.status(400).json({ error: 'Cannot update more than 1000 rows at once' });
      return;
    }

    // Validate row structure
    for (const row of rows) {
      if (!row || typeof row !== 'object' || Array.isArray(row)) {
        res.status(400).json({ error: 'All items in rows array must be objects' });
        return;
      }

      if (!('rowIndex' in row)) {
        res.status(400).json({ error: 'Each row must have a rowIndex field' });
        return;
      }

      if (!('data' in row)) {
        res.status(400).json({ error: 'Each row must have a data field' });
        return;
      }

      if (!row.data || typeof row.data !== 'object' || Array.isArray(row.data)) {
        res.status(400).json({ error: 'Row data must be an object' });
        return;
      }

      const rowIndex = row.rowIndex;
      if (typeof rowIndex !== 'number' || rowIndex < 2) {
        res.status(400).json({ error: 'rowIndex must be >= 2 (row 1 contains headers)' });
        return;
      }
    }

    // Check for duplicate rowIndex values
    const rowIndices = rows.map((r: { rowIndex: number }) => r.rowIndex);
    const uniqueIndices = new Set(rowIndices);
    if (uniqueIndices.size !== rowIndices.length) {
      const duplicates = rowIndices.filter((item: number, index: number) => rowIndices.indexOf(item) !== index);
      res.status(400).json({ error: `Duplicate rowIndex found in request: ${duplicates[0]}` });
      return;
    }

    const results = await sheetsService.updateRows(
      req.spreadsheetId,
      sheetName,
      rows
    );

    res.status(200).json({ rows: results });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

router.put('/:rowIndex', async (req: Request, res: Response) => {
  try {
    const { sheetName, rowIndex } = req.params;
    const index = parseInt(rowIndex, 10);

    if (isNaN(index) || index < 2) {
      res.status(400).json({
        error: 'Invalid rowIndex. Must be >= 2 (row 1 contains headers)',
      });
      return;
    }

    const data = req.body;

    if (!data || typeof data !== 'object') {
      res.status(400).json({ error: 'Request body must be an object' });
      return;
    }

    await sheetsService.updateRow(req.spreadsheetId, sheetName, index, data);
    res.status(204).send();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

router.delete('/:rowIndex', async (req: Request, res: Response) => {
  try {
    const { sheetName, rowIndex } = req.params;
    const index = parseInt(rowIndex, 10);

    if (isNaN(index) || index < 2) {
      res.status(400).json({
        error: 'Invalid rowIndex. Must be >= 2 (row 1 contains headers)',
      });
      return;
    }

    await sheetsService.deleteRow(req.spreadsheetId, sheetName, index);
    res.status(204).send();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

export default router;
