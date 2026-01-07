import express from 'express';
import cors from 'cors';
import * as path from 'path';
import { http } from '@google-cloud/functions-framework';
import { spreadsheetIdMiddleware } from './middleware/spreadsheetId';
import sheetsRouter from './routes/sheets';
import rowsRouter from './routes/rows';

const app = express();

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl) and null origin (file:// URLs)
    if (!origin || origin === 'null') {
      callback(null, true);
    } else {
      callback(null, true);
    }
  },
  credentials: true
}));

app.use(express.json());

app.use('/sheets', spreadsheetIdMiddleware, sheetsRouter);
app.use('/sheets/:sheetName/rows', spreadsheetIdMiddleware, rowsRouter);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.get('/', (_req, res) => {
  res.sendFile(path.join(__dirname, 'docs.html'));
});

app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

http('sheetsApi', app);
