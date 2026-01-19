# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Sheets DB API** is a Google Cloud Function that proxies requests to the Google Sheets API, treating sheets as database tables. It provides a RESTful interface for CRUD operations on Google Sheets.

**Live URL:** https://sheetsapi-g56q77hy2a-uc.a.run.app

## Development Commands

### Build and Test
```bash
npm run build              # Compile TypeScript and generate OpenAPI docs
npm test                   # Run contract tests (fast, mocked)
npm run test:watch         # Run tests in watch mode
npm run test:e2e           # Run E2E tests (requires TEST_SPREADSHEET_ID)
npm run test:e2e:watch     # Run E2E tests in watch mode
```

### Run Locally
```bash
npm start                  # Start Functions Framework server
npm run dev                # Start with TypeScript watch mode
```

Server runs on http://localhost:8080

### Run Single Test
```bash
npm test -- src/test/rows.contract.test.ts              # Run specific file
npm test -- src/test/rows.contract.test.ts -t "bulk"   # Run tests matching pattern
```

## Architecture

### Three-Layer Design

1. **Route Layer** (`src/routes/`)
   - Express route handlers
   - HTTP request/response handling
   - Request validation
   - Calls service layer

2. **Service Layer** (`src/services/sheetsService.ts`)
   - Business logic and data transformation
   - Direct Google Sheets API interaction
   - Date format conversion (ISO 8601 ↔ Sheets datetime)
   - Exports reusable functions for routes

3. **Middleware** (`src/middleware/`)
   - `spreadsheetIdMiddleware`: Validates `X-Spreadsheet-Id` header and attaches to `req.spreadsheetId`

### Key Architectural Patterns

**Authentication Flow:**
- All `/sheets` endpoints require `X-Spreadsheet-Id` header
- Service account authentication configured via Google Cloud credentials
- No per-request authentication needed

**Date Handling:**
- API accepts/returns ISO 8601 format: `2025-12-29T17:29:33.000Z`
- Google Sheets stores as: `2025-12-29 17:29:33`
- Automatic bidirectional conversion in `sheetsService.ts`

**Row Indexing:**
- Row 1 = headers (column names)
- Data rows start at index 2
- API validates `rowIndex >= 2` for all row operations

**Error Handling Convention:**
- 400: Client validation errors (missing fields, invalid formats)
- 404: Resource not found (sheet, row)
- 500: Google Sheets API errors or server errors

### OpenAPI Documentation

- **Source:** `openapi.yaml` (single source of truth)
- **Build Process:** `scripts/build-docs.ts` generates `dist/docs.html` from OpenAPI spec
- **Served At:** GET / endpoint returns interactive API documentation
- **Build Requirement:** Always run `npm run build` after modifying `openapi.yaml`

## Testing Strategy

### Contract Tests (`src/test/*.contract.test.ts`)
- Mock Google Sheets API responses
- Test route handlers and request/response formats
- Fast execution (included in `npm test`)
- 49 tests covering all endpoints

### E2E Tests (`src/test/api.e2e.test.ts`)
- Require `TEST_SPREADSHEET_ID` environment variable
- Create/delete real sheets in Google Sheets
- Verify actual data persistence
- Excluded from default test run via `vitest.config.ts`

**Test Separation:**
```typescript
// vitest.config.ts excludes E2E tests from default run
exclude: ['src/**/*.e2e.test.ts', '**/node_modules/**']
```

## Service Account Setup

Share your Google Sheet with this service account (Editor access):
```
sheets-db-api@kinetic-object-322814.iam.gserviceaccount.com
```

## Common Workflows

### Adding a New Endpoint

1. **Service Layer:** Add function to `src/services/sheetsService.ts`
2. **Route Layer:** Add handler to appropriate router in `src/routes/`
3. **OpenAPI:** Document endpoint in `openapi.yaml`
4. **Tests:** Add contract tests to `src/test/*.contract.test.ts`
5. **Build:** Run `npm run build` to generate documentation
6. **Verify:** Check `npm test` passes and visit http://localhost:8080/ for docs

### Date Format Conversions

Always use ISO 8601 in API requests/responses. The service layer handles conversion:
```typescript
// Request: { "created_at": "2025-01-15T10:00:00.000Z" }
// → Sheets stores: "2025-01-15 10:00:00"
// ← Response: { "created_at": "2025-01-15T10:00:00.000Z" }
```

### Bulk Operations

For creating multiple rows, use:
```
POST /sheets/{sheetName}/rows/bulk
Body: { "rows": [...] }  // 1-1000 rows
```

Single Google Sheets API call for efficiency. Returns array of `{ rowIndex, data }`.

## Implementation Plans

Feature designs and implementation plans are stored in `docs/plans/` with format:
```
YYYY-MM-DD-<feature-name>-design.md    # Design document
YYYY-MM-DD-<feature-name>.md           # Implementation plan
```

## Deployment

Automatic deployment via GitHub Actions on push to `main`:
- Workflow: `.github/workflows/deploy.yaml`
- Builds TypeScript, generates docs, deploys to Google Cloud Functions
- Function name: `sheetsApi`
- Monitor: `gh run watch <run-id>`

## Worktree Directory

Prefer `.worktrees/` for git worktrees (already in `.gitignore`).
