import { Router, Request, Response } from 'express';
import * as sheetsService from '../services/sheetsService';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
  try {
    const sheets = await sheetsService.listSheets(req.spreadsheetId);
    res.json({ sheets });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

router.post('/', async (req: Request, res: Response) => {
  try {
    const { name } = req.body;

    if (!name || typeof name !== 'string') {
      res.status(400).json({ error: 'Missing required field: name' });
      return;
    }

    const sheet = await sheetsService.createSheet(req.spreadsheetId, name);
    res.status(201).json({ sheet });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

router.delete('/:sheetName', async (req: Request, res: Response) => {
  try {
    const { sheetName } = req.params;
    await sheetsService.deleteSheet(req.spreadsheetId, sheetName);
    res.status(204).send();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    if (message.includes('not found')) {
      res.status(404).json({ error: message });
    } else {
      res.status(500).json({ error: message });
    }
  }
});

router.get('/:sheetName/schema', async (req: Request, res: Response) => {
  try {
    const { sheetName } = req.params;
    const columns = await sheetsService.getSchema(req.spreadsheetId, sheetName);
    res.json({ columns });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

export default router;
