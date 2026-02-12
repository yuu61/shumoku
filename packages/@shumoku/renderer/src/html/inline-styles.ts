/**
 * Shared inline CSS styles for HTML renderers
 * Generates CSS shared by both simple (generateHtml) and hierarchical (generateHierarchicalHtml) modes.
 */

export interface InlineStyleOptions {
  containerHeight: string
  hierarchical?: boolean
}

/**
 * Generate base CSS styles shared by both simple and hierarchical HTML renderers
 */
export function getBaseStyles(options: InlineStyleOptions): string {
  const { containerHeight, hierarchical = false } = options

  const toolbarTitleFlex = hierarchical ? ' display: flex; align-items: center; gap: 8px;' : ''

  const backBtnStyles = hierarchical
    ? `
    .back-btn { display: inline-flex; align-items: center; gap: 4px; padding: 4px 8px; border: 1px solid #e5e7eb; background: white; border-radius: 6px; cursor: pointer; font-size: 13px; color: #6b7280; transition: all 0.15s; }
    .back-btn:hover { background: #f3f4f6; color: #374151; }
    .back-btn svg { width: 14px; height: 14px; }`
    : ''

  const svgContainerStyles = hierarchical
    ? `
    .sheet-container { width: 100%; height: 100%; }
    .sheet-container > svg { width: 100%; height: 100%; }`
    : `
    .container > svg { width: 100%; height: 100%; }`

  return `* { margin: 0; padding: 0; box-sizing: border-box; }
    body { background: #fafafa; min-height: 100vh; font-family: system-ui, -apple-system, sans-serif; }
    .toolbar { display: flex; align-items: center; justify-content: space-between; padding: 8px 16px; background: white; border-bottom: 1px solid #e5e7eb; }
    .toolbar-title { font-size: 14px; font-weight: 500; color: #374151;${toolbarTitleFlex} }
    .toolbar-buttons { display: flex; gap: 4px; align-items: center; }
    .toolbar button { padding: 6px; border: none; background: none; cursor: pointer; border-radius: 6px; color: #6b7280; transition: all 0.15s; }
    .toolbar button:hover { background: #f3f4f6; color: #374151; }
    .zoom-text { min-width: 50px; text-align: center; font-size: 13px; font-weight: 500; color: #6b7280; }${backBtnStyles}
    .container { position: relative; width: 100%; height: ${containerHeight}; overflow: hidden; cursor: grab; background: white; background-image: radial-gradient(#e5e7eb 1px, transparent 1px); background-size: 16px 16px; }
    .container.dragging { cursor: grabbing; }${svgContainerStyles}
    .branding { position: absolute; bottom: 16px; right: 16px; display: flex; align-items: center; gap: 8px; padding: 8px 12px; background: rgba(255,255,255,0.95); backdrop-filter: blur(8px); border: 1px solid rgba(0,0,0,0.1); border-radius: 8px; font-size: 13px; font-family: system-ui, sans-serif; color: #555; text-decoration: none; transition: all 0.2s; box-shadow: 0 2px 8px rgba(0,0,0,0.1); z-index: 100; }
    .branding:hover { color: #222; box-shadow: 0 4px 12px rgba(0,0,0,0.15); }
    .branding-icon { width: 16px; height: 16px; border-radius: 3px; flex-shrink: 0; }
    /* SVG interactive styles */
    .node { cursor: pointer; }
    .node:hover rect, .node:hover circle, .node:hover polygon { filter: brightness(0.95); }
    .port { cursor: pointer; }
    .link-hit-area { cursor: pointer; }
    /* Subgraph click for hierarchical navigation */
    .subgraph[data-has-sheet] { cursor: pointer; }
    .subgraph[data-has-sheet]:hover > rect { filter: brightness(0.95); }`
}
