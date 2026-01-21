# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Shumoku is a modern network topology visualization library for Markdown. It enables network engineers to create interactive network diagrams directly in documentation. The project is a TypeScript monorepo using bun workspaces and Turborepo.

## Commands

### Development
```bash
bun install           # Install all dependencies
bun run build         # Build all packages (respects dependency order)
bun run dev           # Run all packages in dev mode
bun run typecheck     # Type check all packages
bun run lint          # Lint all packages
bun run format        # Format with Biome
bun run test          # Run tests across packages
```

### Package-specific
```bash
# Run docs dev server (includes playground)
cd apps/docs && bun run dev

# Run tests for core package only
cd packages/@shumoku/core && bun run test

# Watch mode for core development
cd packages/@shumoku/core && bun run dev
```

## Architecture

### Monorepo Structure
- `packages/@shumoku/core` - Core library (models, layout engines, themes, fixtures)
- `packages/@shumoku/parser-yaml` - YAML parser for network definitions
- `packages/@shumoku/renderer` - SVG/HTML renderers with interactive features
- `packages/@shumoku/icons` - Vendor icon sets (AWS, Juniper, Yamaha, Aruba)
- `packages/@shumoku/netbox` - NetBox API integration and CLI
- `packages/shumoku` - Main wrapper package (re-exports all packages)
- `apps/docs` - Documentation site with playground (Next.js)

### Core Library (`@shumoku/core`)

**Models** (`src/models/`): Data structures for network topology
- `Node` - Network devices with type, vendor, model
- `Link` - Connections between nodes with bandwidth, VLAN
- `Subgraph` - Logical groupings with nested structure
- `NetworkGraph` - Root container for the entire network definition

**Layout Engines** (`src/layout/`): Automatic positioning algorithms
- `HierarchicalLayout` - Dagre-based hierarchical layout
- Produces `LayoutResult` with positioned nodes, links, subgraphs

**Themes** (`src/themes/`): Visual styling
- `modernTheme`, `darkTheme` presets
- `createTheme()`, `mergeTheme()` utilities

**Fixtures** (`src/fixtures/`): Sample data for testing
- `sampleNetwork` - Multi-file hierarchical network example

### YAML Parser (`@shumoku/parser-yaml`)

Converts YAML network definitions to `NetworkGraph`. Supports:
- Nested or flat structure
- Multi-file hierarchical parsing with `file:` references
- Device:port notation: `"router1:eth0"`
- Type aliases: `switch` -> `l2-switch`, `fw` -> `firewall`

### Renderer (`@shumoku/renderer`)

**Pipeline API** (`src/pipeline.ts`): Unified render pipeline
- `prepareRender()` - Resolve icon dimensions and compute layout
- `renderSvg()` - Render to SVG from prepared data
- `renderHtml()` - Render to interactive HTML
- `renderPng()` - Render to PNG (Node.js only, requires @resvg/resvg-js)

**Convenience functions**: One-liner API
- `renderGraphToSvg()` - Direct graph to SVG
- `renderGraphToHtml()` - Direct graph to HTML
- `renderGraphToPng()` - Direct graph to PNG

**CDN Icons** (`src/cdn-icons.ts`): Icon dimension resolution
- Fetches icon dimensions from `https://icons.shumoku.packof.me`
- Supports proper aspect ratio rendering for vendor icons
- Browser fallback uses Image.onload for CORS-blocked requests

**Low-level renderers**:
- `svg.render()` - Pure SVG output
- `html.render()` - Interactive HTML with pan/zoom, tooltips
- `html.renderHierarchical()` - Multi-sheet navigation for hierarchical networks

### NetBox (`@shumoku/netbox`)

- CLI tool: `npx @shumoku/netbox`
- Converts NetBox API data to NetworkGraph
- Supports grouping by tag, site, location, or prefix

### Data Flow
```
YAML input → YamlParser.parse() → NetworkGraph → prepareRender() → PreparedRender → renderSvg/Html/Png() → Output
```

Pipeline internally handles:
1. Icon dimension resolution (CDN fetch with caching)
2. Layout computation (HierarchicalLayout)
3. Rendering with proper icon aspect ratios

## Versioning

- 0.x の間は基本 **patch** を使う
- **minor** は大きな新機能追加・新しい公開API追加時のみ
- **major** は 1.0.0 リリース時または破壊的変更時
- 迷ったら patch

## Code Style

- Biome for formatting and linting
- Single quotes, no semicolons, trailing commas
- 100 character line width
- ESM modules (`"type": "module"`)

## Key Types

```typescript
// Creating a network programmatically
const graph: NetworkGraph = {
  name: 'My Network',
  nodes: Node[],
  links: Link[],
  subgraphs?: Subgraph[],
  settings?: NetworkSettings
}

// Recommended: Use pipeline API (handles icon dimensions automatically)
import { prepareRender, renderSvg, renderHtml, renderPng } from '@shumoku/renderer'

const prepared = await prepareRender(graph)
const svgOutput = await renderSvg(prepared)
const htmlOutput = renderHtml(prepared)
const pngBuffer = await renderPng(prepared)  // Node.js only

// Or use convenience functions
import { renderGraphToSvg, renderGraphToHtml } from '@shumoku/renderer'

const svg = await renderGraphToSvg(graph)
const html = await renderGraphToHtml(graph)
```

## Testing

Tests use the shared `sampleNetwork` fixture from `@shumoku/core`:

```typescript
import { sampleNetwork } from '@shumoku/core'
// Multi-file sample: main.yaml, cloud.yaml, perimeter.yaml, dmz.yaml, campus.yaml
```
