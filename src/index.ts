import express from 'express';
import { http } from '@google-cloud/functions-framework';
import { spreadsheetIdMiddleware } from './middleware/spreadsheetId';
import sheetsRouter from './routes/sheets';
import rowsRouter from './routes/rows';

const app = express();

app.use(express.json());

app.use('/sheets', spreadsheetIdMiddleware, sheetsRouter);
app.use('/sheets/:sheetName/rows', spreadsheetIdMiddleware, rowsRouter);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

http('sheetsApi', app);
