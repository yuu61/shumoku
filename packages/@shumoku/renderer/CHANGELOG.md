# @shumoku/renderer

## 0.2.14

### Patch Changes

- 2b6ff1a: feat: add JSON output support for netbox CLI and shumoku render CLI

  - netbox CLI: `--format json` or `-o file.json` outputs NetworkGraph JSON
  - new `shumoku render` CLI in @shumoku/renderer to render JSON to SVG/HTML
  - enables workflow: NetBox → JSON → merge/modify → render

## 0.2.3

### Patch Changes

- Fix: republish with correct code from master
- Updated dependencies
  - @shumoku/core@0.2.3
