import express from 'express';
import cors from 'cors';
import { spreadsheetIdMiddleware } from '../middleware/spreadsheetId';
import sheetsRouter from '../routes/sheets';
import rowsRouter from '../routes/rows';

export function createTestApp() {
  const app = express();

  app.use(cors());
  app.use(express.json());

  app.use('/sheets', spreadsheetIdMiddleware, sheetsRouter);
  app.use('/sheets/:sheetName/rows', spreadsheetIdMiddleware, rowsRouter);

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.use((_req, res) => {
    res.status(404).json({ error: 'Not found' });
  });

  return app;
}
