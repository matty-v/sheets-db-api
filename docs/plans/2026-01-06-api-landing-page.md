# API Landing Page Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a static API documentation page at GET / that matches the voget.io visual style.

**Architecture:** A build-time TypeScript script parses openapi.yaml and generates a single HTML file with inline CSS. Express serves this file at the root route. No client-side JavaScript needed.

**Tech Stack:** TypeScript, Express, yaml package (already installed)

---

### Task 1: Create the HTML Generator Script

**Files:**
- Create: `scripts/build-docs.ts`

**Step 1: Create the scripts directory and base file**

Create `scripts/build-docs.ts`:

```typescript
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'yaml';

interface OpenAPISpec {
  info: { title: string; description: string; version: string };
  servers: { url: string; description: string }[];
  paths: Record<string, Record<string, PathOperation>>;
  components: {
    parameters: Record<string, Parameter>;
    schemas: Record<string, Schema>;
  };
}

interface PathOperation {
  summary: string;
  description: string;
  operationId: string;
  parameters?: (Parameter | { $ref: string })[];
  requestBody?: {
    required: boolean;
    content: { 'application/json': { schema: Schema | { $ref: string } } };
  };
  responses: Record<string, {
    description: string;
    content?: { 'application/json': { schema: Schema | { $ref: string } } };
  }>;
}

interface Parameter {
  name: string;
  in: string;
  required: boolean;
  description: string;
  schema: { type: string; minimum?: number };
  example?: string | number;
}

interface Schema {
  type: string;
  properties?: Record<string, Schema>;
  items?: Schema | { $ref: string };
  required?: string[];
  description?: string;
  example?: unknown;
  additionalProperties?: Schema | { oneOf: Schema[] };
  oneOf?: Schema[];
}

function resolveRef(spec: OpenAPISpec, ref: string): unknown {
  const parts = ref.replace('#/', '').split('/');
  let current: unknown = spec;
  for (const part of parts) {
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

function resolveSchema(spec: OpenAPISpec, schema: Schema | { $ref: string }): Schema {
  if ('$ref' in schema) {
    return resolveRef(spec, schema.$ref) as Schema;
  }
  return schema;
}

function resolveParameter(spec: OpenAPISpec, param: Parameter | { $ref: string }): Parameter {
  if ('$ref' in param) {
    return resolveRef(spec, param.$ref) as Parameter;
  }
  return param;
}

function schemaToExample(spec: OpenAPISpec, schema: Schema): unknown {
  if (schema.example !== undefined) return schema.example;

  if (schema.type === 'object') {
    if (schema.properties) {
      const obj: Record<string, unknown> = {};
      for (const [key, prop] of Object.entries(schema.properties)) {
        obj[key] = schemaToExample(spec, prop);
      }
      return obj;
    }
    if (schema.additionalProperties) {
      return { key: 'value' };
    }
    return {};
  }

  if (schema.type === 'array') {
    if (schema.items) {
      const resolved = '$ref' in schema.items
        ? resolveSchema(spec, schema.items)
        : schema.items;
      return [schemaToExample(spec, resolved)];
    }
    return [];
  }

  if (schema.type === 'string') return 'string';
  if (schema.type === 'integer' || schema.type === 'number') return 0;
  if (schema.type === 'boolean') return true;
  return null;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function getMethodColor(method: string): { bg: string; text: string; glow: string } {
  const colors: Record<string, { bg: string; text: string; glow: string }> = {
    get: { bg: 'rgba(0, 212, 255, 0.2)', text: '#00d4ff', glow: 'rgba(0, 212, 255, 0.4)' },
    post: { bg: 'rgba(167, 139, 250, 0.2)', text: '#a78bfa', glow: 'rgba(167, 139, 250, 0.4)' },
    put: { bg: 'rgba(251, 191, 36, 0.2)', text: '#fbbf24', glow: 'rgba(251, 191, 36, 0.4)' },
    delete: { bg: 'rgba(236, 72, 153, 0.2)', text: '#ec4899', glow: 'rgba(236, 72, 153, 0.4)' },
  };
  return colors[method] || colors.get;
}

function generateCurlExample(
  baseUrl: string,
  method: string,
  path: string,
  operation: PathOperation,
  spec: OpenAPISpec
): string {
  const resolvedParams = (operation.parameters || []).map(p => resolveParameter(spec, p));
  const headerParam = resolvedParams.find(p => p.in === 'header');

  let examplePath = path;
  for (const param of resolvedParams) {
    if (param.in === 'path' && param.example) {
      examplePath = examplePath.replace(`{${param.name}}`, String(param.example));
    }
  }

  let curl = `curl -X ${method.toUpperCase()} "${baseUrl}${examplePath}"`;

  if (headerParam) {
    curl += ` \\\n  -H "${headerParam.name}: ${headerParam.example || 'your-spreadsheet-id'}"`;
  }

  if (operation.requestBody) {
    const schema = resolveSchema(
      spec,
      operation.requestBody.content['application/json'].schema
    );
    const example = schemaToExample(spec, schema);
    curl += ` \\\n  -H "Content-Type: application/json"`;
    curl += ` \\\n  -d '${JSON.stringify(example)}'`;
  }

  return curl;
}

function generateEndpointHtml(
  spec: OpenAPISpec,
  path: string,
  method: string,
  operation: PathOperation,
  baseUrl: string
): string {
  const colors = getMethodColor(method);
  const resolvedParams = (operation.parameters || []).map(p => resolveParameter(spec, p));
  const pathParams = resolvedParams.filter(p => p.in === 'path');
  const headerParams = resolvedParams.filter(p => p.in === 'header');

  let html = `
    <div class="endpoint-card" id="${operation.operationId}">
      <div class="endpoint-header">
        <span class="method-badge" style="background: ${colors.bg}; color: ${colors.text}; box-shadow: 0 0 20px ${colors.glow};">
          ${method.toUpperCase()}
        </span>
        <code class="endpoint-path">${escapeHtml(path)}</code>
      </div>
      <p class="endpoint-summary">${escapeHtml(operation.summary)}</p>
      <p class="endpoint-description">${escapeHtml(operation.description)}</p>
  `;

  // Parameters
  if (headerParams.length > 0 || pathParams.length > 0) {
    html += `<div class="params-section"><h4>Parameters</h4><table class="params-table">`;
    html += `<thead><tr><th>Name</th><th>Location</th><th>Type</th><th>Required</th><th>Description</th></tr></thead><tbody>`;

    for (const param of [...headerParams, ...pathParams]) {
      html += `
        <tr>
          <td><code>${escapeHtml(param.name)}</code></td>
          <td>${param.in}</td>
          <td>${param.schema.type}${param.schema.minimum !== undefined ? ` (min: ${param.schema.minimum})` : ''}</td>
          <td>${param.required ? '<span class="required-badge">required</span>' : 'optional'}</td>
          <td>${escapeHtml(param.description)}</td>
        </tr>
      `;
    }
    html += `</tbody></table></div>`;
  }

  // Request Body
  if (operation.requestBody) {
    const schema = resolveSchema(spec, operation.requestBody.content['application/json'].schema);
    const example = schemaToExample(spec, schema);
    html += `
      <div class="request-section">
        <h4>Request Body</h4>
        <pre class="code-block"><code>${escapeHtml(JSON.stringify(example, null, 2))}</code></pre>
      </div>
    `;
  }

  // Responses
  html += `<div class="responses-section"><h4>Responses</h4>`;
  for (const [status, response] of Object.entries(operation.responses)) {
    const statusClass = status.startsWith('2') ? 'status-success' : status.startsWith('4') ? 'status-warning' : 'status-error';
    html += `
      <div class="response-item">
        <span class="status-badge ${statusClass}">${status}</span>
        <span class="response-desc">${escapeHtml(response.description)}</span>
      </div>
    `;
    if (response.content) {
      const schema = resolveSchema(spec, response.content['application/json'].schema);
      const example = schemaToExample(spec, schema);
      html += `<pre class="code-block"><code>${escapeHtml(JSON.stringify(example, null, 2))}</code></pre>`;
    }
  }
  html += `</div>`;

  // Curl Example
  const curlExample = generateCurlExample(baseUrl, method, path, operation, spec);
  html += `
    <div class="curl-section">
      <h4>Example</h4>
      <pre class="code-block"><code>${escapeHtml(curlExample)}</code></pre>
    </div>
  `;

  html += `</div>`;
  return html;
}

function generateNavigation(spec: OpenAPISpec): string {
  const groups: Record<string, { method: string; path: string; operationId: string; summary: string }[]> = {
    Overview: [],
    Health: [],
    Sheets: [],
    Rows: [],
  };

  for (const [path, methods] of Object.entries(spec.paths)) {
    for (const [method, operation] of Object.entries(methods)) {
      const item = { method, path, operationId: operation.operationId, summary: operation.summary };
      if (path === '/health') {
        groups.Health.push(item);
      } else if (path.includes('/rows')) {
        groups.Rows.push(item);
      } else if (path.includes('/sheets')) {
        groups.Sheets.push(item);
      }
    }
  }

  let nav = '';
  for (const [group, items] of Object.entries(groups)) {
    if (group === 'Overview') {
      nav += `<div class="nav-group"><a href="#overview" class="nav-link nav-overview">Overview</a></div>`;
      continue;
    }
    if (items.length === 0) continue;

    nav += `<div class="nav-group"><div class="nav-group-title">${group}</div>`;
    for (const item of items) {
      const colors = getMethodColor(item.method);
      nav += `
        <a href="#${item.operationId}" class="nav-link">
          <span class="nav-method" style="color: ${colors.text}">${item.method.toUpperCase()}</span>
          <span class="nav-path">${item.path}</span>
        </a>
      `;
    }
    nav += `</div>`;
  }

  return nav;
}

function generateHtml(spec: OpenAPISpec): string {
  const baseUrl = spec.servers[0]?.url || 'https://api.example.com';

  let endpointsHtml = '';
  for (const [path, methods] of Object.entries(spec.paths)) {
    for (const [method, operation] of Object.entries(methods)) {
      endpointsHtml += generateEndpointHtml(spec, path, method, operation, baseUrl);
    }
  }

  const navigationHtml = generateNavigation(spec);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${spec.info.title} - Documentation</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500;600&display=swap" rel="stylesheet">
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    :root {
      --bg-primary: #0a0e14;
      --bg-secondary: #121821;
      --accent-cyan: #00d4ff;
      --accent-purple: #a78bfa;
      --accent-pink: #ec4899;
      --accent-amber: #fbbf24;
      --text-primary: #f0f4f8;
      --text-muted: #8b9cb3;
      --grid-color: rgba(100, 150, 255, 0.08);
      --border-color: rgba(100, 150, 255, 0.2);
    }

    body {
      font-family: 'JetBrains Mono', monospace;
      background: var(--bg-primary);
      color: var(--text-primary);
      line-height: 1.6;
      overflow-x: hidden;
    }

    /* Animated background */
    .gradient-backdrop {
      position: fixed;
      top: -50%;
      left: -50%;
      width: 200%;
      height: 200%;
      background: radial-gradient(circle at 20% 50%, rgba(0, 212, 255, 0.08) 0%, transparent 50%),
                  radial-gradient(circle at 80% 50%, rgba(167, 139, 250, 0.06) 0%, transparent 50%),
                  radial-gradient(circle at 50% 50%, rgba(236, 72, 153, 0.04) 0%, transparent 50%);
      animation: gradientShift 20s ease-in-out infinite;
      z-index: 0;
      pointer-events: none;
    }

    @keyframes gradientShift {
      0%, 100% { transform: translate(0, 0) rotate(0deg); }
      33% { transform: translate(5%, -5%) rotate(120deg); }
      66% { transform: translate(-5%, 5%) rotate(240deg); }
    }

    .grid-overlay {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background-image: linear-gradient(var(--grid-color) 1px, transparent 1px),
                        linear-gradient(90deg, var(--grid-color) 1px, transparent 1px);
      background-size: 60px 60px;
      animation: gridMove 40s linear infinite;
      z-index: 0;
      opacity: 0.6;
      pointer-events: none;
    }

    @keyframes gridMove {
      0% { background-position: 0 0, 0 0; }
      100% { background-position: 60px 60px, 60px 60px; }
    }

    .scanline {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 2px;
      background: linear-gradient(to bottom, transparent, rgba(0, 212, 255, 0.15), transparent);
      animation: scan 8s linear infinite;
      z-index: 1;
      pointer-events: none;
    }

    @keyframes scan {
      0% { transform: translateY(0); }
      100% { transform: translateY(100vh); }
    }

    .corner-accent {
      position: fixed;
      width: 200px;
      height: 200px;
      pointer-events: none;
      z-index: 1;
    }

    .corner-accent.top-left {
      top: 0;
      left: 0;
      border-top: 1px solid rgba(0, 212, 255, 0.2);
      border-left: 1px solid rgba(0, 212, 255, 0.2);
      animation: cornerPulse 4s ease-in-out infinite;
    }

    .corner-accent.bottom-right {
      bottom: 0;
      right: 0;
      border-bottom: 1px solid rgba(167, 139, 250, 0.2);
      border-right: 1px solid rgba(167, 139, 250, 0.2);
      animation: cornerPulse 4s ease-in-out infinite 2s;
    }

    @keyframes cornerPulse {
      0%, 100% { opacity: 0.3; }
      50% { opacity: 0.8; }
    }

    /* Layout */
    .container {
      display: flex;
      min-height: 100vh;
      position: relative;
      z-index: 10;
    }

    /* Sidebar */
    .sidebar {
      width: 280px;
      position: fixed;
      top: 0;
      left: 0;
      height: 100vh;
      background: rgba(18, 24, 33, 0.8);
      backdrop-filter: blur(10px);
      border-right: 1px solid var(--border-color);
      padding: 2rem 1rem;
      overflow-y: auto;
      z-index: 100;
    }

    .sidebar-title {
      font-size: 1.25rem;
      font-weight: 600;
      color: var(--accent-cyan);
      text-shadow: 0 0 30px rgba(0, 212, 255, 0.3);
      margin-bottom: 2rem;
      padding-bottom: 1rem;
      border-bottom: 1px solid var(--border-color);
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
      margin-bottom: 0.5rem;
      padding-left: 0.5rem;
    }

    .nav-link {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.5rem;
      color: var(--text-muted);
      text-decoration: none;
      font-size: 0.8rem;
      border-radius: 0.5rem;
      transition: all 0.2s;
    }

    .nav-link:hover {
      background: rgba(0, 212, 255, 0.1);
      color: var(--text-primary);
    }

    .nav-overview {
      font-weight: 500;
      color: var(--text-primary);
    }

    .nav-method {
      font-weight: 600;
      font-size: 0.65rem;
      min-width: 3rem;
    }

    .nav-path {
      font-size: 0.75rem;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    /* Main content */
    .main {
      flex: 1;
      margin-left: 280px;
      padding: 3rem;
      max-width: 1000px;
    }

    /* Hero */
    .hero {
      text-align: center;
      padding: 4rem 0;
      margin-bottom: 3rem;
    }

    .hero h1 {
      font-size: 2.5rem;
      font-weight: 600;
      margin-bottom: 1rem;
    }

    .hero h1 .glow-cyan {
      color: var(--accent-cyan);
      text-shadow: 0 0 30px rgba(0, 212, 255, 0.3);
    }

    .hero-tagline {
      font-size: 1.1rem;
      color: var(--text-muted);
      font-weight: 300;
      margin-bottom: 1.5rem;
    }

    .hero-url {
      display: inline-block;
      background: var(--bg-secondary);
      border: 1px solid var(--border-color);
      padding: 0.5rem 1rem;
      border-radius: 0.5rem;
      font-size: 0.85rem;
      color: var(--accent-cyan);
    }

    .hero-description {
      max-width: 600px;
      margin: 1.5rem auto 0;
      color: var(--text-muted);
      font-weight: 300;
      font-size: 0.95rem;
    }

    /* Overview section */
    .overview {
      background: rgba(18, 24, 33, 0.7);
      backdrop-filter: blur(10px);
      border: 1px solid var(--border-color);
      border-radius: 1rem;
      padding: 2rem;
      margin-bottom: 3rem;
    }

    .overview h2 {
      color: var(--accent-purple);
      text-shadow: 0 0 30px rgba(167, 139, 250, 0.3);
      font-size: 1.5rem;
      margin-bottom: 1rem;
    }

    .overview p {
      color: var(--text-muted);
      font-weight: 300;
      margin-bottom: 1rem;
    }

    .overview ul {
      list-style: none;
      padding-left: 0;
    }

    .overview li {
      color: var(--text-muted);
      font-weight: 300;
      padding: 0.25rem 0;
      padding-left: 1.5rem;
      position: relative;
    }

    .overview li::before {
      content: ">";
      position: absolute;
      left: 0;
      color: var(--accent-cyan);
    }

    /* Endpoint cards */
    .endpoint-card {
      background: rgba(18, 24, 33, 0.7);
      backdrop-filter: blur(10px);
      border: 1px solid var(--border-color);
      border-radius: 1rem;
      padding: 2rem;
      margin-bottom: 2rem;
      transition: all 0.3s;
    }

    .endpoint-card:hover {
      border-color: rgba(167, 139, 250, 0.4);
      box-shadow: 0 0 60px rgba(167, 139, 250, 0.1);
    }

    .endpoint-header {
      display: flex;
      align-items: center;
      gap: 1rem;
      margin-bottom: 1rem;
    }

    .method-badge {
      padding: 0.25rem 0.75rem;
      border-radius: 0.375rem;
      font-size: 0.75rem;
      font-weight: 600;
      text-transform: uppercase;
    }

    .endpoint-path {
      font-size: 1.1rem;
      color: var(--text-primary);
    }

    .endpoint-summary {
      font-size: 1rem;
      font-weight: 500;
      color: var(--text-primary);
      margin-bottom: 0.5rem;
    }

    .endpoint-description {
      color: var(--text-muted);
      font-weight: 300;
      font-size: 0.9rem;
      margin-bottom: 1.5rem;
    }

    /* Sections within cards */
    .params-section, .request-section, .responses-section, .curl-section {
      margin-top: 1.5rem;
    }

    .params-section h4, .request-section h4, .responses-section h4, .curl-section h4 {
      font-size: 0.85rem;
      color: var(--accent-cyan);
      margin-bottom: 0.75rem;
      font-weight: 500;
    }

    /* Parameters table */
    .params-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.8rem;
    }

    .params-table th {
      text-align: left;
      padding: 0.5rem;
      color: var(--text-muted);
      font-weight: 500;
      border-bottom: 1px solid var(--border-color);
    }

    .params-table td {
      padding: 0.5rem;
      color: var(--text-muted);
      border-bottom: 1px solid rgba(100, 150, 255, 0.1);
      font-weight: 300;
    }

    .params-table code {
      color: var(--accent-cyan);
      background: rgba(0, 212, 255, 0.1);
      padding: 0.1rem 0.3rem;
      border-radius: 0.25rem;
    }

    .required-badge {
      background: rgba(236, 72, 153, 0.2);
      color: var(--accent-pink);
      padding: 0.1rem 0.4rem;
      border-radius: 0.25rem;
      font-size: 0.7rem;
    }

    /* Code blocks */
    .code-block {
      background: var(--bg-secondary);
      border: 1px solid var(--border-color);
      border-radius: 0.5rem;
      padding: 1rem;
      overflow-x: auto;
      font-size: 0.8rem;
    }

    .code-block code {
      color: var(--text-muted);
      white-space: pre;
    }

    /* Response items */
    .response-item {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      margin-bottom: 0.5rem;
    }

    .status-badge {
      padding: 0.2rem 0.5rem;
      border-radius: 0.25rem;
      font-size: 0.75rem;
      font-weight: 600;
    }

    .status-success {
      background: rgba(0, 212, 255, 0.2);
      color: var(--accent-cyan);
    }

    .status-warning {
      background: rgba(251, 191, 36, 0.2);
      color: var(--accent-amber);
    }

    .status-error {
      background: rgba(236, 72, 153, 0.2);
      color: var(--accent-pink);
    }

    .response-desc {
      color: var(--text-muted);
      font-size: 0.85rem;
      font-weight: 300;
    }

    /* Footer */
    footer {
      text-align: center;
      padding: 3rem 0;
      color: var(--text-muted);
      font-size: 0.8rem;
      font-weight: 300;
      border-top: 1px solid var(--border-color);
      margin-top: 3rem;
    }

    /* Responsive */
    @media (max-width: 900px) {
      .sidebar {
        display: none;
      }
      .main {
        margin-left: 0;
        padding: 1.5rem;
      }
    }
  </style>
</head>
<body>
  <div class="gradient-backdrop"></div>
  <div class="grid-overlay"></div>
  <div class="scanline"></div>
  <div class="corner-accent top-left"></div>
  <div class="corner-accent bottom-right"></div>

  <div class="container">
    <aside class="sidebar">
      <div class="sidebar-title">${escapeHtml(spec.info.title)}</div>
      <nav>
        ${navigationHtml}
      </nav>
    </aside>

    <main class="main">
      <header class="hero" id="overview">
        <h1>Sheets DB <span class="glow-cyan">API</span></h1>
        <p class="hero-tagline">Use Google Sheets as a lightweight database</p>
        <code class="hero-url">${escapeHtml(baseUrl)}</code>
        <p class="hero-description">${escapeHtml(spec.info.description)}</p>
      </header>

      <section class="overview">
        <h2>Getting Started</h2>
        <p>All endpoints require the <code>X-Spreadsheet-Id</code> header containing your Google Sheets spreadsheet ID.</p>
        <p>The spreadsheet ID can be found in the URL of your Google Sheet:</p>
        <pre class="code-block"><code>https://docs.google.com/spreadsheets/d/<strong>SPREADSHEET_ID</strong>/edit</code></pre>
        <p style="margin-top: 1rem;">Features:</p>
        <ul>
          <li>List and create sheets (tabs) in a spreadsheet</li>
          <li>CRUD operations on rows with automatic header detection</li>
          <li>Schema endpoint to get column headers</li>
          <li>JSON key-value format for row data</li>
        </ul>
      </section>

      ${endpointsHtml}

      <footer>
        <p>Sheets DB API v${escapeHtml(spec.info.version)}</p>
      </footer>
    </main>
  </div>
</body>
</html>`;
}

function main() {
  const specPath = path.join(__dirname, '..', 'openapi.yaml');
  const outputPath = path.join(__dirname, '..', 'dist', 'docs.html');

  console.log('Reading OpenAPI spec...');
  const specContent = fs.readFileSync(specPath, 'utf-8');
  const spec = yaml.parse(specContent) as OpenAPISpec;

  console.log('Generating HTML...');
  const html = generateHtml(spec);

  // Ensure dist directory exists
  const distDir = path.dirname(outputPath);
  if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir, { recursive: true });
  }

  console.log('Writing docs.html...');
  fs.writeFileSync(outputPath, html);

  console.log(`Done! Documentation generated at ${outputPath}`);
}

main();
```

**Step 2: Run the script to verify it works**

Run: `npx ts-node scripts/build-docs.ts`
Expected: Output showing "Done! Documentation generated at dist/docs.html"

**Step 3: Commit**

```bash
git add scripts/build-docs.ts
git commit -m "feat: add build script for API documentation page"
```

---

### Task 2: Update Build Process

**Files:**
- Modify: `package.json`

**Step 1: Update the build script**

In `package.json`, change the build script from:
```json
"build": "tsc"
```
to:
```json
"build": "tsc && npx ts-node scripts/build-docs.ts"
```

**Step 2: Run build to verify**

Run: `npm run build`
Expected: TypeScript compiles, then docs generate successfully

**Step 3: Commit**

```bash
git add package.json
git commit -m "build: add docs generation to build process"
```

---

### Task 3: Add Express Route

**Files:**
- Modify: `src/index.ts`

**Step 1: Add the docs route**

Add this import at the top of `src/index.ts`:
```typescript
import * as path from 'path';
```

Add this route before the 404 handler (before line 31):
```typescript
app.get('/', (_req, res) => {
  res.sendFile(path.join(__dirname, 'docs.html'));
});
```

**Step 2: Rebuild and verify**

Run: `npm run build`
Expected: Builds successfully

**Step 3: Test locally**

Run: `npm start`
Then visit: `http://localhost:8080/`
Expected: See the documentation page styled like voget.io

**Step 4: Commit**

```bash
git add src/index.ts
git commit -m "feat: serve API documentation at GET /"
```

---

### Task 4: Manual Testing

**Step 1: Verify all sections render correctly**

Run: `npm start`
Check:
- Hero section shows title, tagline, base URL
- Sidebar navigation lists all endpoints
- Each endpoint card shows method, path, description
- Parameters tables display correctly
- Request/response examples render as JSON
- Curl examples are correct
- Animations work (gradient, grid, scanline)

**Step 2: Test navigation**

Click each sidebar link and verify smooth scroll to the correct section.

**Step 3: Verify mobile responsiveness**

Resize browser to < 900px width.
Expected: Sidebar hides, content remains readable.

---

### Task 5: Final Commit

**Step 1: Ensure all changes are committed**

Run: `git status`
Expected: Working tree clean

**Step 2: Create final commit if any uncommitted changes**

```bash
git add -A
git commit -m "feat: complete API documentation landing page"
```

---

## Summary

After completing these tasks:
- `GET /` serves a static documentation page
- Documentation matches voget.io visual style
- Build process generates docs from openapi.yaml
- No runtime dependencies added
