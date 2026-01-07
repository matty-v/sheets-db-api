import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'yaml';

interface OpenAPISpec {
  openapi: string;
  info: {
    title: string;
    description: string;
    version: string;
  };
  servers: Array<{ url: string; description: string }>;
  paths: Record<string, PathItem>;
  components: {
    parameters: Record<string, Parameter>;
    schemas: Record<string, Schema>;
  };
}

interface PathItem {
  [method: string]: Operation;
}

interface Operation {
  summary: string;
  description: string;
  operationId: string;
  parameters?: Array<Parameter | { $ref: string }>;
  requestBody?: {
    required: boolean;
    content: {
      'application/json': {
        schema: Schema | { $ref: string };
      };
    };
  };
  responses: Record<string, Response>;
}

interface Parameter {
  name: string;
  in: string;
  required: boolean;
  description: string;
  schema: Schema;
  example?: string | number;
}

interface Schema {
  type?: string;
  properties?: Record<string, Schema>;
  items?: Schema | { $ref: string };
  required?: string[];
  example?: unknown;
  description?: string;
  additionalProperties?: Schema | { oneOf: Schema[] };
  minimum?: number;
  $ref?: string;
}

interface Response {
  description: string;
  content?: {
    'application/json': {
      schema: Schema | { $ref: string };
    };
  };
}

// Read and parse the OpenAPI spec
const openapiPath = path.join(__dirname, '..', 'openapi.yaml');
let spec: OpenAPISpec;
try {
  const openapiContent = fs.readFileSync(openapiPath, 'utf8');
  spec = yaml.parse(openapiContent);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Failed to read or parse OpenAPI spec at ${openapiPath}: ${message}`);
  process.exit(1);
}

// Helper to resolve $ref
function resolveRef(ref: string): Parameter | Schema {
  const parts = ref.replace('#/', '').split('/');
  let result: unknown = spec;
  for (const part of parts) {
    result = (result as Record<string, unknown>)[part];
  }
  return result as Parameter | Schema;
}

// Helper to get method color
function getMethodColor(method: string): string {
  const colors: Record<string, string> = {
    get: '#00d4ff',     // cyan
    post: '#22c55e',    // green
    put: '#fbbf24',     // amber
    delete: '#ec4899',  // pink
    patch: '#a78bfa',   // purple
  };
  return colors[method.toLowerCase()] || '#00d4ff';
}

// Helper to generate example from schema
function generateExample(schemaOrRef: Schema | { $ref: string }): unknown {
  // Handle $ref
  if ('$ref' in schemaOrRef && schemaOrRef.$ref) {
    const resolved = resolveRef(schemaOrRef.$ref) as Schema;
    return generateExample(resolved);
  }

  // Cast to Schema since we've handled the $ref case
  const schema = schemaOrRef as Schema;

  if (schema.example !== undefined) {
    return schema.example;
  }

  if (schema.type === 'object') {
    const obj: Record<string, unknown> = {};
    if (schema.properties) {
      for (const [key, prop] of Object.entries(schema.properties)) {
        obj[key] = generateExample(prop as Schema);
      }
    }
    return obj;
  }

  if (schema.type === 'array' && schema.items) {
    return [generateExample(schema.items as Schema | { $ref: string })];
  }

  if (schema.type === 'string') return 'string';
  if (schema.type === 'integer' || schema.type === 'number') return 0;
  if (schema.type === 'boolean') return true;

  return null;
}

// Group endpoints by resource
interface Endpoint {
  method: string;
  path: string;
  operation: Operation;
}

interface GroupedEndpoints {
  Health: Endpoint[];
  Sheets: Endpoint[];
  Rows: Endpoint[];
}

function groupEndpoints(): GroupedEndpoints {
  const groups: GroupedEndpoints = {
    Health: [],
    Sheets: [],
    Rows: [],
  };

  for (const [pathUrl, pathItem] of Object.entries(spec.paths)) {
    for (const [method, operation] of Object.entries(pathItem)) {
      if (['get', 'post', 'put', 'delete', 'patch'].includes(method)) {
        const endpoint: Endpoint = { method, path: pathUrl, operation: operation as Operation };

        if (pathUrl === '/health') {
          groups.Health.push(endpoint);
        } else if (pathUrl.includes('/rows')) {
          groups.Rows.push(endpoint);
        } else {
          groups.Sheets.push(endpoint);
        }
      }
    }
  }

  return groups;
}

// Generate HTML
function generateHTML(): string {
  const groups = groupEndpoints();
  const baseUrl = spec.servers[0]?.url || 'https://api.example.com';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${spec.info.title} - Documentation</title>
  <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg-primary: #0a0e14;
      --bg-secondary: #121821;
      --bg-tertiary: #1a2332;
      --accent-cyan: #00d4ff;
      --accent-purple: #a78bfa;
      --accent-pink: #ec4899;
      --accent-amber: #fbbf24;
      --accent-green: #22c55e;
      --text-primary: #e2e8f0;
      --text-secondary: #94a3b8;
      --text-muted: #64748b;
      --border-color: rgba(255, 255, 255, 0.1);
      --glass-bg: rgba(18, 24, 33, 0.8);
      --glass-border: rgba(255, 255, 255, 0.05);
    }

    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    html {
      scroll-behavior: smooth;
    }

    body {
      font-family: 'JetBrains Mono', monospace;
      background: var(--bg-primary);
      color: var(--text-primary);
      line-height: 1.6;
      min-height: 100vh;
    }

    /* Animated Background */
    .backdrop {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      z-index: -1;
      overflow: hidden;
    }

    .backdrop::before {
      content: '';
      position: absolute;
      top: -50%;
      left: -50%;
      width: 200%;
      height: 200%;
      background: radial-gradient(ellipse at center, rgba(0, 212, 255, 0.1) 0%, transparent 50%),
                  radial-gradient(ellipse at 80% 20%, rgba(167, 139, 250, 0.08) 0%, transparent 40%),
                  radial-gradient(ellipse at 20% 80%, rgba(236, 72, 153, 0.06) 0%, transparent 40%);
      animation: gradientMove 20s ease-in-out infinite;
    }

    @keyframes gradientMove {
      0%, 100% { transform: translate(0, 0) rotate(0deg); }
      25% { transform: translate(-5%, -5%) rotate(1deg); }
      50% { transform: translate(5%, 5%) rotate(-1deg); }
      75% { transform: translate(-3%, 3%) rotate(0.5deg); }
    }

    /* Grid Overlay */
    .grid-overlay {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      z-index: -1;
      background-image:
        linear-gradient(rgba(0, 212, 255, 0.03) 1px, transparent 1px),
        linear-gradient(90deg, rgba(0, 212, 255, 0.03) 1px, transparent 1px);
      background-size: 50px 50px;
      pointer-events: none;
    }

    /* Scanline Effect */
    .scanline {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      z-index: 1000;
      pointer-events: none;
      background: repeating-linear-gradient(
        0deg,
        rgba(0, 0, 0, 0.03) 0px,
        rgba(0, 0, 0, 0.03) 1px,
        transparent 1px,
        transparent 2px
      );
    }

    /* Layout */
    .container {
      display: flex;
      min-height: 100vh;
    }

    /* Sidebar */
    .sidebar {
      width: 280px;
      position: fixed;
      top: 0;
      left: 0;
      height: 100vh;
      background: var(--glass-bg);
      backdrop-filter: blur(20px);
      border-right: 1px solid var(--glass-border);
      padding: 2rem 1.5rem;
      overflow-y: auto;
      z-index: 100;
    }

    .sidebar::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      width: 3px;
      height: 100%;
      background: linear-gradient(180deg, var(--accent-cyan), var(--accent-purple), var(--accent-pink));
    }

    .sidebar-title {
      font-size: 1.25rem;
      font-weight: 700;
      color: var(--accent-cyan);
      text-shadow: 0 0 20px rgba(0, 212, 255, 0.5);
      margin-bottom: 0.5rem;
    }

    .sidebar-version {
      font-size: 0.75rem;
      color: var(--text-muted);
      margin-bottom: 2rem;
    }

    .nav-group {
      margin-bottom: 1.5rem;
    }

    .nav-group-title {
      font-size: 0.75rem;
      font-weight: 600;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.1em;
      margin-bottom: 0.75rem;
      padding-left: 0.5rem;
    }

    .nav-item {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.5rem 0.75rem;
      border-radius: 6px;
      text-decoration: none;
      color: var(--text-secondary);
      transition: all 0.2s ease;
      font-size: 0.875rem;
    }

    .nav-item:hover {
      background: rgba(0, 212, 255, 0.1);
      color: var(--text-primary);
    }

    .nav-method {
      font-size: 0.625rem;
      font-weight: 700;
      padding: 0.125rem 0.375rem;
      border-radius: 3px;
      text-transform: uppercase;
      min-width: 40px;
      text-align: center;
    }

    /* Main Content */
    .main {
      flex: 1;
      margin-left: 280px;
      padding: 3rem 4rem;
      max-width: calc(100% - 280px);
    }

    /* Hero Section */
    .hero {
      position: relative;
      padding: 4rem 0;
      margin-bottom: 3rem;
    }

    .hero::before,
    .hero::after {
      content: '';
      position: absolute;
      width: 40px;
      height: 40px;
      border: 2px solid var(--accent-cyan);
      opacity: 0.3;
    }

    .hero::before {
      top: 0;
      left: 0;
      border-right: none;
      border-bottom: none;
    }

    .hero::after {
      bottom: 0;
      right: 0;
      border-left: none;
      border-top: none;
    }

    .hero-title {
      font-size: 3rem;
      font-weight: 700;
      background: linear-gradient(135deg, var(--accent-cyan), var(--accent-purple));
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      margin-bottom: 1rem;
      text-shadow: 0 0 40px rgba(0, 212, 255, 0.3);
    }

    .hero-description {
      font-size: 1.125rem;
      color: var(--text-secondary);
      max-width: 600px;
      margin-bottom: 2rem;
    }

    .hero-url {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.75rem 1.5rem;
      background: var(--bg-tertiary);
      border: 1px solid var(--border-color);
      border-radius: 8px;
      font-size: 0.875rem;
      color: var(--accent-cyan);
    }

    .hero-url-label {
      color: var(--text-muted);
    }

    /* Getting Started Section */
    .section {
      margin-bottom: 4rem;
    }

    .section-title {
      font-size: 1.5rem;
      font-weight: 600;
      color: var(--text-primary);
      margin-bottom: 1.5rem;
      padding-bottom: 0.5rem;
      border-bottom: 1px solid var(--border-color);
    }

    .getting-started-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
      gap: 1.5rem;
    }

    .info-card {
      background: var(--glass-bg);
      backdrop-filter: blur(10px);
      border: 1px solid var(--glass-border);
      border-radius: 12px;
      padding: 1.5rem;
      position: relative;
      overflow: hidden;
    }

    .info-card::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 2px;
      background: linear-gradient(90deg, var(--accent-cyan), var(--accent-purple));
    }

    .info-card-title {
      font-size: 1rem;
      font-weight: 600;
      color: var(--accent-cyan);
      margin-bottom: 0.75rem;
    }

    .info-card-content {
      font-size: 0.875rem;
      color: var(--text-secondary);
    }

    .info-card code {
      background: var(--bg-primary);
      padding: 0.125rem 0.375rem;
      border-radius: 4px;
      font-size: 0.8125rem;
      color: var(--accent-amber);
    }

    .info-card-full {
      grid-column: 1 / -1;
    }

    .service-account {
      display: inline-block;
      background: var(--bg-primary);
      padding: 0.5rem 0.75rem;
      border-radius: 6px;
      font-size: 0.875rem;
      color: var(--accent-cyan);
      border: 1px solid var(--accent-cyan);
      word-break: break-all;
    }

    /* Endpoint Cards */
    .endpoint-card {
      background: var(--glass-bg);
      backdrop-filter: blur(10px);
      border: 1px solid var(--glass-border);
      border-radius: 12px;
      margin-bottom: 2rem;
      overflow: hidden;
      position: relative;
    }

    .endpoint-card::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      width: 4px;
      height: 100%;
    }

    .endpoint-header {
      padding: 1.5rem;
      border-bottom: 1px solid var(--border-color);
      display: flex;
      align-items: center;
      gap: 1rem;
      flex-wrap: wrap;
    }

    .method-badge {
      font-size: 0.75rem;
      font-weight: 700;
      padding: 0.375rem 0.75rem;
      border-radius: 6px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .endpoint-path {
      font-size: 1rem;
      font-weight: 600;
      color: var(--text-primary);
    }

    .endpoint-path .param {
      color: var(--accent-amber);
    }

    .endpoint-description {
      font-size: 0.875rem;
      color: var(--text-secondary);
      margin-left: auto;
    }

    .endpoint-body {
      padding: 1.5rem;
    }

    .endpoint-section {
      margin-bottom: 1.5rem;
    }

    .endpoint-section:last-child {
      margin-bottom: 0;
    }

    .endpoint-section-title {
      font-size: 0.75rem;
      font-weight: 600;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.1em;
      margin-bottom: 0.75rem;
    }

    /* Parameters Table */
    .params-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.875rem;
    }

    .params-table th {
      text-align: left;
      padding: 0.75rem;
      background: var(--bg-tertiary);
      color: var(--text-muted);
      font-weight: 600;
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .params-table th:first-child {
      border-radius: 6px 0 0 6px;
    }

    .params-table th:last-child {
      border-radius: 0 6px 6px 0;
    }

    .params-table td {
      padding: 0.75rem;
      border-bottom: 1px solid var(--border-color);
      color: var(--text-secondary);
    }

    .params-table tr:last-child td {
      border-bottom: none;
    }

    .param-name {
      color: var(--accent-cyan);
      font-weight: 500;
    }

    .param-required {
      color: var(--accent-pink);
      font-size: 0.75rem;
      margin-left: 0.5rem;
    }

    .param-type {
      color: var(--accent-purple);
      font-size: 0.8125rem;
    }

    .param-location {
      color: var(--text-muted);
      font-size: 0.75rem;
      background: var(--bg-tertiary);
      padding: 0.125rem 0.5rem;
      border-radius: 4px;
    }

    /* Code Blocks */
    .code-block {
      background: var(--bg-primary);
      border: 1px solid var(--border-color);
      border-radius: 8px;
      overflow: hidden;
    }

    .code-block-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0.5rem 1rem;
      background: var(--bg-tertiary);
      border-bottom: 1px solid var(--border-color);
      font-size: 0.75rem;
      color: var(--text-muted);
    }

    .code-block-content {
      padding: 1rem;
      overflow-x: auto;
      font-size: 0.8125rem;
      line-height: 1.7;
    }

    .code-block-content pre {
      margin: 0;
      white-space: pre-wrap;
      word-wrap: break-word;
    }

    /* Response Examples */
    .response-tabs {
      display: flex;
      gap: 0.5rem;
      margin-bottom: 0.75rem;
    }

    .response-tab {
      padding: 0.375rem 0.75rem;
      border-radius: 6px;
      font-size: 0.75rem;
      font-weight: 600;
      cursor: pointer;
      border: 1px solid var(--border-color);
      background: transparent;
      color: var(--text-secondary);
      transition: all 0.2s ease;
    }

    .response-tab.success {
      border-color: var(--accent-green);
      color: var(--accent-green);
    }

    .response-tab.error {
      border-color: var(--accent-pink);
      color: var(--accent-pink);
    }

    /* JSON Syntax Highlighting */
    .json-key { color: var(--accent-cyan); }
    .json-string { color: var(--accent-green); }
    .json-number { color: var(--accent-amber); }
    .json-boolean { color: var(--accent-purple); }
    .json-null { color: var(--accent-pink); }

    /* Scrollbar */
    ::-webkit-scrollbar {
      width: 8px;
      height: 8px;
    }

    ::-webkit-scrollbar-track {
      background: var(--bg-primary);
    }

    ::-webkit-scrollbar-thumb {
      background: var(--bg-tertiary);
      border-radius: 4px;
    }

    ::-webkit-scrollbar-thumb:hover {
      background: var(--text-muted);
    }

    /* Responsive */
    @media (max-width: 1024px) {
      .sidebar {
        width: 240px;
      }

      .main {
        margin-left: 240px;
        padding: 2rem;
        max-width: calc(100% - 240px);
      }
    }

    @media (max-width: 768px) {
      .sidebar {
        display: none;
      }

      .main {
        margin-left: 0;
        max-width: 100%;
        padding: 1.5rem;
      }

      .hero-title {
        font-size: 2rem;
      }
    }
  </style>
</head>
<body>
  <div class="backdrop"></div>
  <div class="grid-overlay"></div>
  <div class="scanline"></div>

  <div class="container">
    <!-- Sidebar Navigation -->
    <nav class="sidebar">
      <div class="sidebar-title">${spec.info.title}</div>
      <div class="sidebar-version">v${spec.info.version}</div>

      ${Object.entries(groups)
        .filter(([, endpoints]) => endpoints.length > 0)
        .map(([groupName, endpoints]) => `
        <div class="nav-group">
          <div class="nav-group-title">${groupName}</div>
          ${endpoints.map((endpoint: Endpoint) => `
            <a href="#${endpoint.operation.operationId}" class="nav-item">
              <span class="nav-method" style="background: ${getMethodColor(endpoint.method)}20; color: ${getMethodColor(endpoint.method)};">${endpoint.method}</span>
              <span>${escapeHtml(endpoint.operation.summary)}</span>
            </a>
          `).join('')}
        </div>
      `).join('')}
    </nav>

    <!-- Main Content -->
    <main class="main">
      <!-- Hero Section -->
      <section class="hero">
        <h1 class="hero-title">${spec.info.title}</h1>
        <p class="hero-description">${spec.info.description}</p>
        <div class="hero-url">
          <span class="hero-url-label">Base URL:</span>
          <span>${baseUrl}</span>
        </div>
      </section>

      <!-- Getting Started -->
      <section class="section">
        <h2 class="section-title">Getting Started</h2>
        <div class="getting-started-grid">
          <div class="info-card">
            <h3 class="info-card-title">Authentication</h3>
            <p class="info-card-content">
              All requests require the <code>X-Spreadsheet-Id</code> header containing your Google Sheets spreadsheet ID.
            </p>
          </div>
          <div class="info-card">
            <h3 class="info-card-title">Data Format</h3>
            <p class="info-card-content">
              The API uses JSON for request and response bodies. Row data is represented as key-value objects where keys are column headers.
            </p>
          </div>
          <div class="info-card">
            <h3 class="info-card-title">Row Indexing</h3>
            <p class="info-card-content">
              Rows are 1-indexed in the API. Row 1 contains headers, so data rows start at index 2.
            </p>
          </div>
          <div class="info-card info-card-full">
            <h3 class="info-card-title">Sheet Access</h3>
            <p class="info-card-content">
              Share your Google Sheet with the API service account to grant access:<br><br>
              <code class="service-account">sheets-db-api@kinetic-object-322814.iam.gserviceaccount.com</code><br><br>
              Grant <strong>Editor</strong> access to allow the API to read and write data.
            </p>
          </div>
        </div>
      </section>

      <!-- Endpoints -->
      ${Object.entries(groups)
        .filter(([, endpoints]) => endpoints.length > 0)
        .map(([groupName, endpoints]) => `
        <section class="section">
          <h2 class="section-title">${groupName}</h2>
          ${endpoints.map((endpoint: Endpoint) => {
            const { method, path: endpointPath, operation } = endpoint;
            const methodColor = getMethodColor(method);
            const resolvedParams: Parameter[] = [];

            if (operation.parameters) {
              for (const param of operation.parameters) {
                if ('$ref' in param) {
                  resolvedParams.push(resolveRef(param.$ref) as Parameter);
                } else {
                  resolvedParams.push(param);
                }
              }
            }

            // Format path with highlighted params
            const formattedPath = endpointPath.replace(/\{([^}]+)\}/g, '<span class="param">{$1}</span>');

            // Generate request body example
            let requestBodyExample = '';
            if (operation.requestBody?.content?.['application/json']?.schema) {
              const example = generateExample(operation.requestBody.content['application/json'].schema);
              requestBodyExample = JSON.stringify(example, null, 2);
            }

            // Generate response examples
            const responseExamples: Array<{ status: string; example: string }> = [];
            for (const [status, response] of Object.entries(operation.responses) as Array<[string, Response]>) {
              if (response.content?.['application/json']?.schema) {
                const example = generateExample(response.content['application/json'].schema);
                responseExamples.push({ status, example: JSON.stringify(example, null, 2) });
              } else if (status === '204') {
                responseExamples.push({ status, example: '// No content' });
              }
            }

            // Generate curl example
            const curlParts = [`curl -X ${method.toUpperCase()} '${baseUrl}${endpointPath}'`];
            curlParts.push(`  -H 'Content-Type: application/json'`);

            for (const param of resolvedParams) {
              if (param.in === 'header') {
                curlParts.push(`  -H '${param.name}: ${param.example || 'YOUR_VALUE'}'`);
              }
            }

            if (requestBodyExample) {
              curlParts.push(`  -d '${requestBodyExample.replace(/\n/g, '')}'`);
            }

            const curlExample = curlParts.join(' \\\n');

            return `
              <div class="endpoint-card" id="${operation.operationId}">
                <div style="position: absolute; top: 0; left: 0; width: 4px; height: 100%; background: ${methodColor};"></div>
                <div class="endpoint-header">
                  <span class="method-badge" style="background: ${methodColor}20; color: ${methodColor};">${method.toUpperCase()}</span>
                  <span class="endpoint-path">${formattedPath}</span>
                  <span class="endpoint-description">${escapeHtml(operation.summary)}</span>
                </div>
                <div class="endpoint-body">
                  <p style="color: var(--text-secondary); font-size: 0.875rem; margin-bottom: 1.5rem;">${escapeHtml(operation.description)}</p>

                  ${resolvedParams.length > 0 ? `
                    <div class="endpoint-section">
                      <h4 class="endpoint-section-title">Parameters</h4>
                      <table class="params-table">
                        <thead>
                          <tr>
                            <th>Name</th>
                            <th>Type</th>
                            <th>Location</th>
                            <th>Description</th>
                          </tr>
                        </thead>
                        <tbody>
                          ${resolvedParams.map(param => `
                            <tr>
                              <td>
                                <span class="param-name">${param.name}</span>
                                ${param.required ? '<span class="param-required">required</span>' : ''}
                              </td>
                              <td><span class="param-type">${param.schema?.type || 'string'}</span></td>
                              <td><span class="param-location">${param.in}</span></td>
                              <td>${escapeHtml(param.description)}</td>
                            </tr>
                          `).join('')}
                        </tbody>
                      </table>
                    </div>
                  ` : ''}

                  ${requestBodyExample ? `
                    <div class="endpoint-section">
                      <h4 class="endpoint-section-title">Request Body</h4>
                      <div class="code-block">
                        <div class="code-block-header">
                          <span>application/json</span>
                        </div>
                        <div class="code-block-content">
                          <pre>${syntaxHighlightJSON(requestBodyExample)}</pre>
                        </div>
                      </div>
                    </div>
                  ` : ''}

                  ${responseExamples.length > 0 ? `
                    <div class="endpoint-section">
                      <h4 class="endpoint-section-title">Responses</h4>
                      <div class="response-tabs">
                        ${responseExamples.map(({ status }) => `
                          <span class="response-tab ${parseInt(status) < 400 ? 'success' : 'error'}">${status}</span>
                        `).join('')}
                      </div>
                      <div class="code-block">
                        <div class="code-block-header">
                          <span>application/json</span>
                        </div>
                        <div class="code-block-content">
                          <pre>${syntaxHighlightJSON(responseExamples[0]?.example || '')}</pre>
                        </div>
                      </div>
                    </div>
                  ` : ''}

                  <div class="endpoint-section">
                    <h4 class="endpoint-section-title">Example</h4>
                    <div class="code-block">
                      <div class="code-block-header">
                        <span>cURL</span>
                      </div>
                      <div class="code-block-content">
                        <pre>${escapeHtml(curlExample)}</pre>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            `;
          }).join('')}
        </section>
      `).join('')}
    </main>
  </div>
</body>
</html>`;
}

// Helper to escape HTML
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Simple JSON syntax highlighting
function syntaxHighlightJSON(json: string): string {
  if (!json || json.startsWith('//')) {
    return `<span class="json-null">${escapeHtml(json)}</span>`;
  }

  return escapeHtml(json)
    .replace(/"([^"]+)":/g, '<span class="json-key">"$1"</span>:')
    .replace(/: "([^"]*)"/g, ': <span class="json-string">"$1"</span>')
    .replace(/: (\d+)/g, ': <span class="json-number">$1</span>')
    .replace(/: (true|false)/g, ': <span class="json-boolean">$1</span>')
    .replace(/: (null)/g, ': <span class="json-null">$1</span>');
}

// Main execution
function main() {
  const html = generateHTML();

  // Ensure dist directory exists
  const distDir = path.join(__dirname, '..', 'dist');
  try {
    if (!fs.existsSync(distDir)) {
      fs.mkdirSync(distDir, { recursive: true });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Failed to create dist directory at ${distDir}: ${message}`);
    process.exit(1);
  }

  // Write the HTML file
  const outputPath = path.join(distDir, 'docs.html');
  try {
    fs.writeFileSync(outputPath, html, 'utf8');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Failed to write documentation file at ${outputPath}: ${message}`);
    process.exit(1);
  }

  console.log(`Done! Documentation generated at dist/docs.html`);
}

main();
