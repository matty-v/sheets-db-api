# Sheets DB Client

A JavaScript/TypeScript client SDK for the Sheets DB API.

## Installation

```bash
npm install sheets-db-client
```

## Usage

### Basic Setup

```typescript
import { SheetsDbClient } from 'sheets-db-client';

const client = new SheetsDbClient({
  baseUrl: 'https://your-cloud-function-url.cloudfunctions.net',
  spreadsheetId: 'your-spreadsheet-id',
});
```

### Working with Sheets

```typescript
// List all sheets
const sheets = await client.listSheets();
console.log(sheets);
// [{ sheetId: 0, title: 'Users', index: 0 }, ...]

// Create a new sheet
const newSheet = await client.createSheet('Products');
console.log(newSheet);
// { sheetId: 123, title: 'Products', index: 1 }

// Delete a sheet
await client.deleteSheet('Products');

// Get schema (column headers)
const columns = await client.getSchema('Users');
console.log(columns);
// ['id', 'name', 'email', 'created_at']
```

### Working with Rows

```typescript
// Get all rows
const rows = await client.getRows('Users');
console.log(rows);
// [{ id: 1, name: 'John', email: 'john@example.com' }, ...]

// Get a single row (row index must be >= 2)
const row = await client.getRow('Users', 2);
console.log(row);
// { id: 1, name: 'John', email: 'john@example.com' }

// Create a new row
const result = await client.createRow('Users', {
  id: 2,
  name: 'Jane',
  email: 'jane@example.com',
});
console.log(result);
// { rowIndex: 3 }

// Update a row
await client.updateRow('Users', 3, {
  id: 2,
  name: 'Jane Doe',
  email: 'jane.doe@example.com',
});

// Delete a row
await client.deleteRow('Users', 3);
```

### Using the Sheet Helper

For convenience, you can create a sheet helper to work with a specific sheet:

```typescript
// Define your row type
interface User {
  id: number;
  name: string;
  email: string;
  active: boolean;
}

// Create a typed sheet helper
const users = client.sheet<User>('Users');

// All operations are now scoped to the 'Users' sheet
const allUsers = await users.getRows();
const user = await users.getRow(2);
const { rowIndex } = await users.createRow({
  id: 3,
  name: 'Bob',
  email: 'bob@example.com',
  active: true,
});
await users.updateRow(rowIndex, { active: false });
await users.deleteRow(rowIndex);
```

### Error Handling

```typescript
import { SheetsDbClient, SheetsDbError } from 'sheets-db-client';

try {
  await client.getRow('Users', 999);
} catch (error) {
  if (error instanceof SheetsDbError) {
    console.log(error.message); // 'Row not found'
    console.log(error.status);  // 404
  }
}
```

### Custom Fetch

You can provide a custom fetch implementation (useful for testing or environments without global fetch):

```typescript
import { SheetsDbClient } from 'sheets-db-client';
import nodeFetch from 'node-fetch';

const client = new SheetsDbClient({
  baseUrl: 'https://your-api.com',
  spreadsheetId: 'your-spreadsheet-id',
  fetch: nodeFetch as unknown as typeof fetch,
});
```

## API Reference

### `SheetsDbClient`

#### Constructor Options

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `baseUrl` | `string` | Yes | The base URL of your Sheets DB API |
| `spreadsheetId` | `string` | Yes | The Google Sheets spreadsheet ID |
| `fetch` | `typeof fetch` | No | Custom fetch implementation |

#### Methods

| Method | Returns | Description |
|--------|---------|-------------|
| `health()` | `Promise<{ status: string }>` | Check API health |
| `listSheets()` | `Promise<SheetInfo[]>` | List all sheets |
| `createSheet(name)` | `Promise<SheetInfo>` | Create a new sheet |
| `deleteSheet(sheetName)` | `Promise<void>` | Delete a sheet |
| `getSchema(sheetName)` | `Promise<string[]>` | Get column headers |
| `getRows(sheetName)` | `Promise<RowData[]>` | Get all rows |
| `getRow(sheetName, rowIndex)` | `Promise<RowData>` | Get a single row |
| `createRow(sheetName, data)` | `Promise<{ rowIndex: number }>` | Create a new row |
| `updateRow(sheetName, rowIndex, data)` | `Promise<void>` | Update a row |
| `deleteRow(sheetName, rowIndex)` | `Promise<void>` | Delete a row |
| `sheet(sheetName)` | `SheetHelper` | Create a sheet helper |

### `SheetHelper<T>`

A convenience wrapper for working with a specific sheet.

| Method | Returns | Description |
|--------|---------|-------------|
| `getSchema()` | `Promise<string[]>` | Get column headers |
| `getRows()` | `Promise<T[]>` | Get all rows |
| `getRow(rowIndex)` | `Promise<T>` | Get a single row |
| `createRow(data)` | `Promise<{ rowIndex: number }>` | Create a new row |
| `updateRow(rowIndex, data)` | `Promise<void>` | Update a row |
| `deleteRow(rowIndex)` | `Promise<void>` | Delete a row |
| `delete()` | `Promise<void>` | Delete the sheet |

## License

MIT
