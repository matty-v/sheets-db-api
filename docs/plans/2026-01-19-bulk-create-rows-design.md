# Bulk Create Rows Design

**Date:** 2026-01-19
**Feature:** Bulk row creation endpoint

## Overview

Add a bulk create operation to the Sheets DB API that allows creating multiple rows in a single request. This enables efficient batch imports and reduces the number of API calls needed for bulk data operations.

## API Design

### Endpoint

**POST** `/sheets/{sheetName}/rows/bulk`

### Request Format

```json
{
  "rows": [
    { "name": "Alice", "email": "alice@example.com", "age": 30 },
    { "name": "Bob", "email": "bob@example.com", "age": 25 }
  ]
}
```

### Response Format (201 Created)

```json
{
  "rows": [
    { "rowIndex": 5, "data": { "name": "Alice", "email": "alice@example.com", "age": 30 } },
    { "rowIndex": 6, "data": { "name": "Bob", "email": "bob@example.com", "age": 25 } }
  ]
}
```

### Constraints

- **Minimum:** 1 row per request
- **Maximum:** 1000 rows per request (prevents timeout issues and API quota exhaustion)
- All rows must be valid objects (same validation as single row creation)
- Same header requirements: `X-Spreadsheet-Id` header is required

### Rationale

- **Array wrapped in object:** Maintains consistency with GET /sheets/{sheetName}/rows which returns `{ "rows": [...] }`
- **Return both index and data:** Allows clients to correlate their input with created rows' positions
- **1000 row limit:** Balances performance with Google Sheets API quotas (300 requests/minute/user) and Cloud Function timeouts (60s default)
- **Dedicated `/bulk` endpoint:** Clear intent, follows RESTful patterns, easier to extend with bulk update/delete later

## Implementation Approach

### Service Layer (sheetsService.ts)

Add new function: `appendRows(spreadsheetId: string, sheetName: string, rows: RowData[])`

**Logic:**
1. Validate rows array (1-1000 items, all objects)
2. Get existing headers OR create from first row's keys if sheet is empty
3. Transform each row object into value arrays matching header order
4. Use Google Sheets API's `values.append` with multiple rows in a single call
5. Parse `updatedRange` from response (e.g., `'Sheet1'!A5:C7`) to extract row indices
6. Return array of `{ rowIndex, data }` objects

**Key implementation detail:** Google Sheets API's `values.append` accepts multiple rows in a single call, providing better atomicity (though Sheets doesn't have true transactions) and efficiency compared to individual appends.

**Error handling:**
- All-or-nothing approach: pre-validate ALL rows before making any API calls
- If any validation fails, reject entire batch with 400 error
- If Google Sheets API call fails, no rows are created

### Route Layer (rows.ts)

Add new route handler:

```typescript
router.post('/bulk', async (req: Request, res: Response) => {
  // Validate request body structure
  // Call sheetsService.appendRows
  // Return 201 with rows array containing rowIndex and data
  // Handle errors with 400/500 responses
})
```

## Error Handling & Edge Cases

### Validation Errors (400 Bad Request)

- Empty rows array: `{ "error": "rows array cannot be empty" }`
- Too many rows: `{ "error": "Cannot create more than 1000 rows at once" }`
- Invalid row format: `{ "error": "All items in rows array must be objects" }`
- Missing rows field: `{ "error": "Request body must include 'rows' array" }`

### Google Sheets API Errors (500 Internal Server Error)

- API quota exceeded
- Invalid spreadsheet ID
- Permission denied
- Network errors

### Edge Cases

1. **Empty sheet (no headers):** Extract keys from first row, create header row, then append all data rows
2. **Inconsistent row schemas:** Each row maps to headers independently
   - Missing keys → empty cells
   - Extra keys → ignored
   - Consistent with single row creation behavior
3. **Date/time values:** Apply same ISO 8601 → Sheets datetime conversion for all rows (using existing `formatValueForSheets` function)
4. **Partial API failures:** Single API call means all-or-nothing (entire batch succeeds or fails)

### Row Index Calculation

Google Sheets API `append` response includes `updatedRange` like `'Sheet1'!A5:C7`:
- Parse to extract start row (5) and end row (7)
- Generate sequential indices: [5, 6, 7]
- Maintains consistency with single row creation which also parses `updatedRange`

## Testing Strategy

### Unit/Contract Tests (rows.contract.test.ts)

1. Successful bulk create (2-3 rows) → 201 with correct response format
2. Empty rows array → 400 error
3. Exceeds 1000 row limit → 400 error
4. Invalid row format (non-object in array) → 400 error
5. Missing 'rows' field → 400 error
6. Sheet with existing headers (rows should match schema)
7. Empty sheet (should create headers from first row)

### E2E Tests (api.e2e.test.ts)

1. Create multiple rows and verify they appear in sheet with correct data
2. Verify returned rowIndices match actual sheet positions
3. Test with various data types (strings, numbers, booleans, ISO dates)
4. Test with inconsistent row schemas (missing/extra fields)
5. Test with maximum allowed rows (1000)

## Documentation Updates

### OpenAPI Spec (openapi.yaml)

**New path:**
- `/sheets/{sheetName}/rows/bulk` with POST operation
- Document 1-1000 row limit in description
- Include example request/response

**New schemas:**
```yaml
BulkCreateRowsRequest:
  type: object
  properties:
    rows:
      type: array
      items:
        $ref: '#/components/schemas/RowData'
      minItems: 1
      maxItems: 1000
  required:
    - rows

BulkCreateRowsResponse:
  type: object
  properties:
    rows:
      type: array
      items:
        type: object
        properties:
          rowIndex:
            type: integer
          data:
            $ref: '#/components/schemas/RowData'
  required:
    - rows
```

### UI Documentation

The build script (`scripts/build-docs.ts`) will automatically:
- Add new sidebar navigation item under "Rows" section
- Generate endpoint card with request/response examples
- Create color-coded cURL example
- Include parameter tables and response codes

No manual UI work needed - just run `npm run build` after updating OpenAPI spec.

## Summary

This design provides an efficient, consistent, and well-tested bulk create operation that:
- Reduces API calls for batch operations (1 call vs N calls)
- Maintains consistency with existing single row creation
- Provides clear error messages and validation
- Handles edge cases gracefully (empty sheets, inconsistent schemas, date conversion)
- Auto-generates comprehensive documentation
- Follows RESTful patterns and can be extended to bulk update/delete in the future
