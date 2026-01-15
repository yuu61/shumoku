---
"@shumoku/netbox": patch
"@shumoku/renderer": patch
---

feat: add JSON output support for netbox CLI and shumoku render CLI

- netbox CLI: `--format json` or `-o file.json` outputs NetworkGraph JSON
- new `shumoku render` CLI in @shumoku/renderer to render JSON to SVG/HTML
- enables workflow: NetBox → JSON → merge/modify → render
