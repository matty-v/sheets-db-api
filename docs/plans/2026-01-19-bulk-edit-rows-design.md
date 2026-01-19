# Bulk Edit Rows - Design Document

**Date:** 2026-01-19
**Feature:** Bulk row update operation for Sheets DB API

## Overview

Add a bulk edit endpoint that allows updating multiple rows in a single request, similar to the existing bulk add operation. This provides efficient batch updates with partial merge behavior.

## API Design

### Endpoint
```
PUT /sheets/{sheetName}/rows/bulk
```

### Request Format
```json
{
  "rows": [
    {
      "rowIndex": 5,
      "data": { "name": "Alice Updated", "age": 31 }
    },
    {
      "rowIndex": 8,
      "data": { "name": "Bob Updated", "email": "bob.new@example.com" }
    }
  ]
}
```

### Response Format (200 OK)
```json
{
  "rows": [
    {
      "rowIndex": 5,
      "data": { "id": 1, "name": "Alice Updated", "email": "alice@example.com", "age": 31 }
    },
    {
      "rowIndex": 8,
      "data": { "id": 2, "name": "Bob Updated", "email": "bob.new@example.com", "age": 26 }
    }
  ]
}
```

### Key Design Decisions

1. **Row Identification:** By rowIndex (not by unique identifier field)
   - Matches existing single-row PUT pattern
   - No search/lookup required (more efficient)
   - Works without unique identifier columns
   - Clearer error messages

2. **Update Behavior:** Partial updates (merge behavior)
   - Only updates fields provided in request
   - Leaves other columns unchanged
   - More intuitive for "edit" operations
   - Safer - won't accidentally clear data

3. **Error Handling:** Fail fast
   - If any row fails validation, reject entire request
   - Update nothing on error
   - Simpler and more predictable
   - Prevents partial/inconsistent state

4. **Size Limit:** 1000 rows maximum
   - Consistent with bulk add operation
   - Good balance of efficiency and responsiveness

## Validation Rules

### Route Layer Validations (400 Bad Request)

**Request structure:**
- `rows` field must be present
- `rows` must be an array
- `rows` array cannot be empty
- `rows` array cannot exceed 1000 items

**Row object structure:**
- Each item must be an object
- Each item must have `rowIndex` field
- Each item must have `data` field
- `data` must be an object

**Row index constraints:**
- All `rowIndex` values must be integers >= 2 (row 1 is headers)
- No duplicate `rowIndex` values in same request

### Error Response Examples
```json
{ "error": "Request body must include rows array" }
{ "error": "rows must be an array" }
{ "error": "rows array cannot be empty" }
{ "error": "Cannot update more than 1000 rows at once" }
{ "error": "All items in rows array must be objects" }
{ "error": "Each row must have a rowIndex field" }
{ "error": "Each row must have a data field" }
{ "error": "Row data must be an object" }
{ "error": "rowIndex must be >= 2 (row 1 contains headers)" }
{ "error": "Duplicate rowIndex found in request: 5" }
```

## Service Layer Implementation

### New Function Signature
```typescript
export interface BulkUpdateRequest {
  rowIndex: number;
  data: RowData;
}

export interface BulkRowResult {
  rowIndex: number;
  data: RowData;
}

export async function updateRows(
  spreadsheetId: string,
  sheetName: string,
  rows: BulkUpdateRequest[]
): Promise<BulkRowResult[]>
```

### Implementation Steps

1. **Read existing data:** Fetch current row data for all specified rowIndex values in single batch read
2. **Merge data:** For each row, merge existing data with new data (partial update)
3. **Apply date conversions:** Use `formatValueForSheets()` for ISO 8601 → Sheets format
4. **Batch update:** Use Google Sheets API `batchUpdate` to write all rows in single call
5. **Build response:** Return merged row data for each updated row

### Google Sheets API Usage
```typescript
// Single batchUpdate call with multiple ranges
await sheets.spreadsheets.values.batchUpdate({
  spreadsheetId,
  requestBody: {
    valueInputOption: 'USER_ENTERED',
    data: [
      { range: `'${sheetName}'!A5:Z5`, values: [[...rowValues]] },
      { range: `'${sheetName}'!A8:Z8`, values: [[...rowValues]] }
    ]
  }
});
```

### Efficiency
- 2 total API calls (1 batch read, 1 batch write)
- Headers fetched once via `getSchema()`
- Reuses existing helpers: `formatValueForSheets()`, `parseValueFromSheets()`

## Testing Strategy

### Contract Tests (`src/test/rows.contract.test.ts`)

New test suite: `PUT /sheets/{sheetName}/rows/bulk`

**Test Cases:**

1. **Happy path:**
   - Update multiple rows successfully
   - Verify 200 status code
   - Verify response contains merged data
   - Verify partial update behavior (existing fields preserved)

2. **Validation errors (400):**
   - Missing `rows` field
   - `rows` is not an array
   - Empty `rows` array
   - Exceeds 1000 rows limit
   - Row item missing `rowIndex` field
   - Row item missing `data` field
   - `data` is not an object
   - `rowIndex` is less than 2
   - Duplicate `rowIndex` in request

3. **Edge cases:**
   - Update single row (minimum)
   - Update exactly 1000 rows (maximum)
   - Update rows with date fields (verify conversion)
   - Empty `data` object (no changes, but should succeed)

### E2E Tests (Optional)
Could add to `src/test/api.e2e.test.ts`:
- Real data persistence in Google Sheets
- Partial update behavior with actual sheet data
- Date conversion round-trips

## Documentation

### OpenAPI Specification (`openapi.yaml`)

Add new endpoint:
```yaml
/sheets/{sheetName}/rows/bulk:
  put:
    summary: Bulk update rows
    description: Update multiple rows by row index with partial data (merge behavior)
    parameters:
      - name: sheetName
      - name: X-Spreadsheet-Id
    requestBody:
      content:
        application/json:
          schema:
            type: object
            required: [rows]
            properties:
              rows:
                type: array
                minItems: 1
                maxItems: 1000
                items:
                  $ref: '#/components/schemas/BulkUpdateRow'
    responses:
      200:
        description: Rows updated successfully
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/BulkUpdateRowsResponse'
```

Add new schemas:
```yaml
BulkUpdateRow:
  type: object
  required: [rowIndex, data]
  properties:
    rowIndex:
      type: integer
      minimum: 2
    data:
      $ref: '#/components/schemas/RowData'

BulkUpdateRowsResponse:
  type: object
  properties:
    rows:
      type: array
      items:
        $ref: '#/components/schemas/BulkRowResult'
```

## Files to Modify

1. `src/services/sheetsService.ts` - Add `updateRows()` function
2. `src/routes/rows.ts` - Add PUT `/bulk` route handler
3. `openapi.yaml` - Add endpoint documentation
4. `src/test/rows.contract.test.ts` - Add test suite

## Build and Deployment

- Run `npm run build` after updating OpenAPI spec to regenerate docs
- Automatic deployment via GitHub Actions on merge to `main`
- No additional configuration needed
