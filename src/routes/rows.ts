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
