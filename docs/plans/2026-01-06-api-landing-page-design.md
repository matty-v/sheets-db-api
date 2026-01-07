# Sheets DB API Landing Page Design

## Overview

Create a static API documentation landing page served at `GET /` that matches the visual style of voget.io. The page will be generated at build time from the existing `openapi.yaml` spec.

## Goals

- Provide clear, readable API documentation
- Match the dark tech aesthetic of voget.io (cyan/purple/pink accents, animations, glassmorphism)
- Keep it simple: static HTML with no client-side JavaScript required
- Integrate into existing build process

## Technical Approach

### Build-Time HTML Generation

A TypeScript script (`scripts/build-docs.ts`) will:
1. Read and parse `openapi.yaml`
2. Generate a single `docs.html` file with inline CSS
3. Output to `dist/docs.html`

### Express Integration

Add a route to serve the documentation:
```typescript
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'docs.html'));
});
```

### Build Process Update

Update `package.json`:
```json
{
  "scripts": {
    "build": "tsc && npm run build:docs",
    "build:docs": "npx ts-node scripts/build-docs.ts"
  }
}
```

## Page Structure

### Layout

- Full-width dark background with animated effects
- Left sidebar (sticky): Navigation grouped by resource
- Main content area: Hero + endpoint sections
- Max-width ~1200px for readability

### Sections

1. **Hero**
   - Title: "Sheets DB API" (with cyan glow)
   - Tagline: "Use Google Sheets as a lightweight database"
   - Base URL in code badge

2. **Sidebar Navigation**
   - Sticky positioning
   - Groups: Overview, Health, Sheets, Rows
   - Active section highlighting
   - Smooth scroll links

3. **Endpoint Cards** (one per endpoint)
   - Method badge (GET=cyan, POST=purple, PUT=amber, DELETE=pink)
   - Path in monospace
   - Description
   - Parameters table (path params, headers)
   - Request body schema (JSON code block)
   - Response schemas by status code
   - Curl example

## Visual Design

### Colors (from voget.io)

```css
--bg-primary: #0a0e14;
--bg-secondary: #121821;
--accent-cyan: #00d4ff;
--accent-purple: #a78bfa;
--accent-pink: #ec4899;
--accent-amber: #fbbf24;
--grid-color: rgba(100, 150, 255, 0.08);
```

### Typography

- Font: JetBrains Mono (monospace)
- Headings: semibold, tracking-tight
- Body: light weight, muted foreground color

### Effects

- Animated gradient backdrop
- Grid overlay with slow animation
- Floating particles
- Scanline effect
- Corner accents with pulse animation
- Glassmorphism cards (blur, subtle borders, shadows)
- Glow effects on accent text

### Components

**Method Badge:**
- Rounded pill shape
- Colored background with glow
- Uppercase text

**Code Block:**
- Dark card background (#121821)
- Cyan border accent
- Monospace font
- Subtle syntax highlighting for JSON

**Parameters Table:**
- Minimal borders
- Name in cyan, type in muted
- Required badge for mandatory params

## File Structure

```
sheets-db-api/
├── scripts/
│   └── build-docs.ts    # HTML generator script
├── src/
│   └── index.ts         # Add GET / route
├── dist/
│   └── docs.html        # Generated output
└── openapi.yaml         # Source of truth
```

## Endpoint Documentation Content

For each endpoint, display:

| Field | Source |
|-------|--------|
| Method | `paths[path][method]` |
| Path | key from `paths` |
| Summary | `summary` |
| Description | `description` |
| Parameters | `parameters[]` with `$ref` resolution |
| Request Body | `requestBody.content.application/json.schema` |
| Responses | `responses[code].content.application/json.schema` |

## Dependencies

Add to devDependencies:
- `yaml` - parse openapi.yaml (already installed)

No new runtime dependencies needed.

## Implementation Steps

1. Create `scripts/build-docs.ts` with HTML generation logic
2. Add CSS styles matching voget.io aesthetic (inline in HTML)
3. Parse openapi.yaml and generate endpoint sections
4. Update build script in package.json
5. Add GET / route in src/index.ts
6. Test locally
7. Deploy

## Out of Scope

- Interactive "try it" functionality
- Client-side JavaScript
- Search functionality
- Multiple pages/routing
