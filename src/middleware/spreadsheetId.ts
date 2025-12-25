import { Request, Response, NextFunction } from 'express';

declare global {
  namespace Express {
    interface Request {
      spreadsheetId: string;
    }
  }
}

export function spreadsheetIdMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const spreadsheetId = req.headers['x-spreadsheet-id'];

  if (!spreadsheetId || typeof spreadsheetId !== 'string') {
    res.status(400).json({
      error: 'Missing required header: X-Spreadsheet-Id',
    });
    return;
  }

  req.spreadsheetId = spreadsheetId;
  next();
}
