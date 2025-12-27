import { google, sheets_v4 } from 'googleapis';

const auth = new google.auth.GoogleAuth({
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const sheets = google.sheets({ version: 'v4', auth });

export interface RowData {
  [key: string]: string | number | boolean | null;
}

export interface SheetInfo {
  sheetId: number;
  title: string;
  index: number;
}

export async function listSheets(spreadsheetId: string): Promise<SheetInfo[]> {
  const response = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: 'sheets.properties',
  });

  return (response.data.sheets || []).map((sheet) => ({
    sheetId: sheet.properties?.sheetId ?? 0,
    title: sheet.properties?.title ?? '',
    index: sheet.properties?.index ?? 0,
  }));
}

export async function createSheet(
  spreadsheetId: string,
  sheetName: string
): Promise<SheetInfo> {
  const response = await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          addSheet: {
            properties: {
              title: sheetName,
            },
          },
        },
      ],
    },
  });

  const addedSheet = response.data.replies?.[0]?.addSheet?.properties;
  return {
    sheetId: addedSheet?.sheetId ?? 0,
    title: addedSheet?.title ?? sheetName,
    index: addedSheet?.index ?? 0,
  };
}

export async function deleteSheet(
  spreadsheetId: string,
  sheetName: string
): Promise<void> {
  const sheetsList = await listSheets(spreadsheetId);
  const sheet = sheetsList.find((s) => s.title === sheetName);

  if (!sheet) {
    throw new Error(`Sheet "${sheetName}" not found`);
  }

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          deleteSheet: {
            sheetId: sheet.sheetId,
          },
        },
      ],
    },
  });
}

export async function getSchema(
  spreadsheetId: string,
  sheetName: string
): Promise<string[]> {
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `'${sheetName}'!1:1`,
  });

  const headers = response.data.values?.[0] || [];
  return headers.map((h) => String(h));
}

export async function getRows(
  spreadsheetId: string,
  sheetName: string
): Promise<RowData[]> {
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `'${sheetName}'`,
  });

  const values = response.data.values || [];
  if (values.length < 2) {
    return [];
  }

  const headers = values[0].map((h) => String(h));
  const rows = values.slice(1);

  return rows.map((row) => {
    const obj: RowData = {};
    headers.forEach((header, index) => {
      obj[header] = row[index] ?? null;
    });
    return obj;
  });
}

export async function getRow(
  spreadsheetId: string,
  sheetName: string,
  rowIndex: number
): Promise<RowData | null> {
  const headers = await getSchema(spreadsheetId, sheetName);

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `'${sheetName}'!${rowIndex}:${rowIndex}`,
  });

  const row = response.data.values?.[0];
  if (!row) {
    return null;
  }

  const obj: RowData = {};
  headers.forEach((header, index) => {
    obj[header] = row[index] ?? null;
  });
  return obj;
}

export async function appendRow(
  spreadsheetId: string,
  sheetName: string,
  data: RowData
): Promise<{ rowIndex: number }> {
  let headers = await getSchema(spreadsheetId, sheetName);

  // If no headers exist, create them from the data keys
  if (headers.length === 0) {
    headers = Object.keys(data);
    // Add header row first
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `'${sheetName}'!1:1`,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [headers],
      },
    });
  }

  const rowValues = headers.map((header) => {
    const value = data[header];
    return value === null || value === undefined ? '' : value;
  });

  const response = await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `'${sheetName}'`,
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: {
      values: [rowValues],
    },
  });

  const updatedRange = response.data.updates?.updatedRange || '';
  const match = updatedRange.match(/:?(\d+)$/);
  const rowIndex = match ? parseInt(match[1], 10) : -1;

  return { rowIndex };
}

export async function updateRow(
  spreadsheetId: string,
  sheetName: string,
  rowIndex: number,
  data: RowData
): Promise<void> {
  const headers = await getSchema(spreadsheetId, sheetName);

  const rowValues = headers.map((header) => {
    const value = data[header];
    return value === null || value === undefined ? '' : value;
  });

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `'${sheetName}'!${rowIndex}:${rowIndex}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values: [rowValues],
    },
  });
}

export async function deleteRow(
  spreadsheetId: string,
  sheetName: string,
  rowIndex: number
): Promise<void> {
  const sheetsList = await listSheets(spreadsheetId);
  const sheet = sheetsList.find((s) => s.title === sheetName);

  if (!sheet) {
    throw new Error(`Sheet "${sheetName}" not found`);
  }

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          deleteDimension: {
            range: {
              sheetId: sheet.sheetId,
              dimension: 'ROWS',
              startIndex: rowIndex - 1,
              endIndex: rowIndex,
            },
          },
        },
      ],
    },
  });
}
