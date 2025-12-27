export interface SheetInfo {
  sheetId: number;
  title: string;
  index: number;
}

export interface RowData {
  [key: string]: string | number | boolean | null;
}

export interface SheetsDbClientOptions {
  baseUrl: string;
  spreadsheetId: string;
  fetch?: typeof fetch;
}

export interface CreateRowResult {
  rowIndex: number;
}

export class SheetsDbError extends Error {
  constructor(
    message: string,
    public status: number,
    public response?: unknown
  ) {
    super(message);
    this.name = 'SheetsDbError';
  }
}

export class SheetsDbClient {
  private baseUrl: string;
  private spreadsheetId: string;
  private fetchFn: typeof fetch;

  constructor(options: SheetsDbClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, '');
    this.spreadsheetId = options.spreadsheetId;
    this.fetchFn = options.fetch ?? globalThis.fetch;
  }

  private async request<T>(
    path: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      'X-Spreadsheet-Id': this.spreadsheetId,
      ...options.headers,
    };

    const response = await this.fetchFn(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      let errorData: unknown;
      try {
        errorData = await response.json();
      } catch {
        errorData = await response.text();
      }
      const message =
        typeof errorData === 'object' &&
        errorData !== null &&
        'error' in errorData
          ? String((errorData as { error: unknown }).error)
          : `Request failed with status ${response.status}`;
      throw new SheetsDbError(message, response.status, errorData);
    }

    if (response.status === 204) {
      return undefined as T;
    }

    return response.json();
  }

  /**
   * Check API health status
   */
  async health(): Promise<{ status: string }> {
    const url = `${this.baseUrl}/health`;
    const response = await this.fetchFn(url);
    return response.json();
  }

  /**
   * List all sheets in the spreadsheet
   */
  async listSheets(): Promise<SheetInfo[]> {
    const result = await this.request<{ sheets: SheetInfo[] }>('/sheets');
    return result.sheets;
  }

  /**
   * Create a new sheet
   */
  async createSheet(name: string): Promise<SheetInfo> {
    const result = await this.request<{ sheet: SheetInfo }>('/sheets', {
      method: 'POST',
      body: JSON.stringify({ name }),
    });
    return result.sheet;
  }

  /**
   * Delete a sheet by name
   */
  async deleteSheet(sheetName: string): Promise<void> {
    await this.request(`/sheets/${encodeURIComponent(sheetName)}`, {
      method: 'DELETE',
    });
  }

  /**
   * Get the schema (column headers) for a sheet
   */
  async getSchema(sheetName: string): Promise<string[]> {
    const result = await this.request<{ columns: string[] }>(
      `/sheets/${encodeURIComponent(sheetName)}/schema`
    );
    return result.columns;
  }

  /**
   * Get all rows from a sheet
   */
  async getRows<T extends RowData = RowData>(sheetName: string): Promise<T[]> {
    const result = await this.request<{ rows: T[] }>(
      `/sheets/${encodeURIComponent(sheetName)}/rows`
    );
    return result.rows;
  }

  /**
   * Get a single row by index (must be >= 2)
   */
  async getRow<T extends RowData = RowData>(
    sheetName: string,
    rowIndex: number
  ): Promise<T> {
    const result = await this.request<{ row: T }>(
      `/sheets/${encodeURIComponent(sheetName)}/rows/${rowIndex}`
    );
    return result.row;
  }

  /**
   * Create a new row in a sheet
   */
  async createRow(
    sheetName: string,
    data: RowData
  ): Promise<CreateRowResult> {
    return this.request<CreateRowResult>(
      `/sheets/${encodeURIComponent(sheetName)}/rows`,
      {
        method: 'POST',
        body: JSON.stringify(data),
      }
    );
  }

  /**
   * Update an existing row by index
   */
  async updateRow(
    sheetName: string,
    rowIndex: number,
    data: RowData
  ): Promise<void> {
    await this.request(
      `/sheets/${encodeURIComponent(sheetName)}/rows/${rowIndex}`,
      {
        method: 'PUT',
        body: JSON.stringify(data),
      }
    );
  }

  /**
   * Delete a row by index
   */
  async deleteRow(sheetName: string, rowIndex: number): Promise<void> {
    await this.request(
      `/sheets/${encodeURIComponent(sheetName)}/rows/${rowIndex}`,
      {
        method: 'DELETE',
      }
    );
  }

  /**
   * Create a helper for working with a specific sheet
   */
  sheet<T extends RowData = RowData>(sheetName: string): SheetHelper<T> {
    return new SheetHelper<T>(this, sheetName);
  }
}

/**
 * Helper class for working with a specific sheet
 */
export class SheetHelper<T extends RowData = RowData> {
  constructor(
    private client: SheetsDbClient,
    private sheetName: string
  ) {}

  async getSchema(): Promise<string[]> {
    return this.client.getSchema(this.sheetName);
  }

  async getRows(): Promise<T[]> {
    return this.client.getRows<T>(this.sheetName);
  }

  async getRow(rowIndex: number): Promise<T> {
    return this.client.getRow<T>(this.sheetName, rowIndex);
  }

  async createRow(data: T): Promise<CreateRowResult> {
    return this.client.createRow(this.sheetName, data);
  }

  async updateRow(rowIndex: number, data: Partial<T>): Promise<void> {
    return this.client.updateRow(this.sheetName, rowIndex, data as RowData);
  }

  async deleteRow(rowIndex: number): Promise<void> {
    return this.client.deleteRow(this.sheetName, rowIndex);
  }

  async delete(): Promise<void> {
    return this.client.deleteSheet(this.sheetName);
  }
}

export default SheetsDbClient;
