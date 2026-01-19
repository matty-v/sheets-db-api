# Sheets DB API

A Google Cloud Function that provides a RESTful API for Google Sheets, treating sheets as database tables with full CRUD operations.

**Live API:** https://sheetsapi-g56q77hy2a-uc.a.run.app

**Interactive Documentation:** https://sheetsapi-g56q77hy2a-uc.a.run.app/

## Features

- ✅ **CRUD Operations** - Create, read, update, and delete rows in Google Sheets
- 📊 **Sheet Management** - List, create, and delete sheets within a spreadsheet
- 🚀 **Bulk Operations** - Create up to 1000 rows in a single request
- 📅 **Date Handling** - Automatic ISO 8601 ↔ Google Sheets datetime conversion
- 📖 **OpenAPI Docs** - Auto-generated interactive API documentation
- 🔒 **Service Account Auth** - Secure Google Sheets API access
- ⚡ **Fast & Lightweight** - Single Cloud Function, minimal dependencies

## Quick Start

### 1. Share Your Google Sheet

Share your Google Sheet with the API service account (Editor access):

```
sheets-db-api@kinetic-object-322814.iam.gserviceaccount.com
```

### 2. Get Your Spreadsheet ID

From your Google Sheet URL:
```
https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit
                                       ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
                                       This is your Spreadsheet ID
```

### 3. Make API Requests

All requests require the `X-Spreadsheet-Id` header:

```bash
# List all sheets
curl https://sheetsapi-g56q77hy2a-uc.a.run.app/sheets \
  -H "X-Spreadsheet-Id: YOUR_SPREADSHEET_ID"

# Create a row
curl -X POST https://sheetsapi-g56q77hy2a-uc.a.run.app/sheets/Users/rows \
  -H "X-Spreadsheet-Id: YOUR_SPREADSHEET_ID" \
  -H "Content-Type: application/json" \
  -d '{"name": "Alice", "email": "alice@example.com", "age": 30}'

# Get all rows
curl https://sheetsapi-g56q77hy2a-uc.a.run.app/sheets/Users/rows \
  -H "X-Spreadsheet-Id: YOUR_SPREADSHEET_ID"

# Bulk create rows
curl -X POST https://sheetsapi-g56q77hy2a-uc.a.run.app/sheets/Users/rows/bulk \
  -H "X-Spreadsheet-Id: YOUR_SPREADSHEET_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "rows": [
      {"name": "Alice", "email": "alice@example.com"},
      {"name": "Bob", "email": "bob@example.com"}
    ]
  }'
```

## API Endpoints

### Sheets

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/sheets` | List all sheets in the spreadsheet |
| POST | `/sheets` | Create a new sheet |
| DELETE | `/sheets/{sheetName}` | Delete a sheet |
| GET | `/sheets/{sheetName}/schema` | Get column headers |

### Rows

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/sheets/{sheetName}/rows` | Get all rows |
| GET | `/sheets/{sheetName}/rows/{rowIndex}` | Get a specific row |
| POST | `/sheets/{sheetName}/rows` | Create a single row |
| POST | `/sheets/{sheetName}/rows/bulk` | Create multiple rows (1-1000) |
| PUT | `/sheets/{sheetName}/rows/{rowIndex}` | Update a row |
| DELETE | `/sheets/{sheetName}/rows/{rowIndex}` | Delete a row |

**Note:** Row indices start at 2 (row 1 contains headers)

## Data Format

The API uses JSON for all requests and responses. Row data is represented as key-value objects where keys are column names:

```json
{
  "name": "Alice",
  "email": "alice@example.com",
  "age": 30,
  "active": true,
  "created_at": "2025-01-15T10:00:00.000Z"
}
```

### Date Handling

- **API Format:** ISO 8601 (`2025-01-15T10:00:00.000Z`)
- **Sheets Format:** `2025-01-15 10:00:00` (automatic conversion)

## Local Development

### Prerequisites

- Node.js >= 20
- Google Cloud service account with Sheets API access

### Setup

```bash
# Install dependencies
npm install

# Build TypeScript and generate docs
npm run build

# Run locally
npm start

# Development mode (with watch)
npm run dev
```

Server runs on http://localhost:8080

### Testing

```bash
# Run contract tests (mocked, fast)
npm test

# Run specific test file
npm test -- src/test/rows.contract.test.ts

# Run E2E tests (requires TEST_SPREADSHEET_ID env var)
TEST_SPREADSHEET_ID=your-id npm run test:e2e

# Watch mode
npm run test:watch
```

### Environment Variables

For E2E testing, set:
```bash
TEST_SPREADSHEET_ID=your-test-spreadsheet-id
```

For local development with service account:
```bash
GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account-key.json
```

## Architecture

```
┌─────────────┐
│   Routes    │  Express route handlers
│  (HTTP)     │  - Request validation
└─────┬───────┘  - Response formatting
      │
      ▼
┌─────────────┐
│  Services   │  Business logic
│             │  - Google Sheets API calls
└─────┬───────┘  - Data transformation
      │
      ▼
┌─────────────┐
│ Google      │
│ Sheets API  │
└─────────────┘
```

See [CLAUDE.md](CLAUDE.md) for detailed architecture documentation.

## Deployment

Automatic deployment via GitHub Actions on push to `main`:

1. TypeScript compilation
2. Documentation generation
3. Deploy to Google Cloud Functions

## Contributing

1. Create a feature branch
2. Make your changes
3. Add tests (contract + E2E if needed)
4. Update `openapi.yaml` for API changes
5. Run `npm run build` to regenerate docs
6. Ensure `npm test` passes
7. Submit a pull request

## License

MIT

## Links

- [Live API](https://sheetsapi-g56q77hy2a-uc.a.run.app/)
- [Interactive Documentation](https://sheetsapi-g56q77hy2a-uc.a.run.app/)
- [Google Sheets API](https://developers.google.com/sheets/api)
