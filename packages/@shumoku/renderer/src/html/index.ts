/**
 * HTML Renderer
 * Generates standalone interactive HTML pages from NetworkGraph
 */

import {
  darkTheme,
  type HierarchicalNetworkGraph,
  type LayoutResult,
  lightTheme,
  type NetworkGraph,
  ROOT_SHEET_ID,
} from '@shumoku/core'
import { hasHierarchicalContent } from '../graph-utils.js'
import { SVGRenderer } from '../svg.js'
import { generateThemeVars } from '../theme-vars.js'
import type { HTMLRendererOptions } from '../types.js'
import {
  getBrandingHtml,
  getHierarchicalPanZoomScript,
  getSimplePanZoomScript,
  getToolbarHtml,
} from './inline-scripts.js'
import { getBaseStyles } from './inline-styles.js'
import {
  generateNavigationToolbar,
  getNavigationScript,
  getNavigationStyles,
  type NavigationState,
  type SheetInfo,
} from './navigation.js'
import { escapeHtml } from './utils.js'

export type { InteractiveInstance, InteractiveOptions } from '../types.js'
// Re-export navigation types
export type { NavigationState, SheetInfo } from './navigation.js'
// Re-export runtime for direct usage
export { initInteractive } from './runtime.js'

// IIFE content - will be set by consumer
let INTERACTIVE_IIFE = ''

/**
 * Set the IIFE content for standalone HTML pages
 */
export function setIIFE(iife: string): void {
  INTERACTIVE_IIFE = iife
}

/**
 * Get the current IIFE content
 */
export function getIIFE(): string {
  return INTERACTIVE_IIFE
}

export interface RenderOptions extends HTMLRendererOptions {
  /**
   * Enable hierarchical navigation UI
   */
  hierarchical?: boolean

  /**
   * Current sheet ID for hierarchical rendering
   */
  currentSheet?: string

  /**
   * Navigation state for hierarchical diagrams
   */
  navigation?: NavigationState

  /**
   * Pre-resolved icon dimensions for proper aspect ratio rendering
   */
  iconDimensions?: Map<string, { width: number; height: number }>
}

const DEFAULT_OPTIONS = {
  branding: true,
  toolbar: true,
  hierarchical: false,
}

/**
 * Render a complete standalone HTML page from NetworkGraph
 */
export function render(graph: NetworkGraph, layout: LayoutResult, options?: RenderOptions): string {
  const opts = { ...DEFAULT_OPTIONS, ...options }

  // Auto-detect hierarchical mode if not explicitly set
  if (options?.hierarchical === undefined) {
    opts.hierarchical = hasHierarchicalContent(graph)
  }

  const svgRenderer = new SVGRenderer({
    renderMode: 'interactive',
    iconDimensions: options?.iconDimensions,
  })
  const svg = svgRenderer.render(graph, layout)
  const title = options?.title || graph.name || 'Network Diagram'

  // Build navigation state if hierarchical
  let navigation: NavigationState | undefined = options?.navigation
  if (!navigation && opts.hierarchical && isHierarchicalGraph(graph)) {
    navigation = buildNavigationState(graph as HierarchicalNetworkGraph, opts.currentSheet)
  }

  const themeType = graph.settings?.theme
  return generateHtml(svg, title, { ...opts, navigation } as Required<RenderOptions>, themeType)
}

/**
 * Sheet data for hierarchical rendering
 */
export interface SheetData {
  graph: NetworkGraph
  layout: LayoutResult
}

/**
 * Render a hierarchical HTML page with multiple embedded sheets
 */
export function renderHierarchical(
  sheets: Map<string, SheetData>,
  options?: RenderOptions,
): string {
  const opts = { ...DEFAULT_OPTIONS, ...options, hierarchical: true }

  const sheetSvgs = new Map<string, string>()
  const sheetInfos = new Map<string, SheetInfo>()
  const rootSheet = sheets.get(ROOT_SHEET_ID)

  // Render child sheets for navigation (detail view when clicking subgraphs)
  for (const [sheetId, data] of sheets) {
    if (sheetId === ROOT_SHEET_ID) continue // Skip root for now

    // Render child sheet
    const svgRenderer = new SVGRenderer({
      renderMode: 'interactive',
      sheetId,
      iconDimensions: options?.iconDimensions,
    })
    const svg = svgRenderer.render(data.graph, data.layout)
    sheetSvgs.set(sheetId, svg)
    sheetInfos.set(sheetId, {
      id: sheetId,
      label: data.graph.name || sheetId,
      parentId: ROOT_SHEET_ID,
    })
  }

  // Render root sheet (ELK handles hierarchical layout natively, no embedding needed)
  if (rootSheet) {
    const rootRenderer = new SVGRenderer({
      renderMode: 'interactive',
      sheetId: ROOT_SHEET_ID,
      iconDimensions: options?.iconDimensions,
    })
    const rootSvg = rootRenderer.render(rootSheet.graph, rootSheet.layout)
    sheetSvgs.set(ROOT_SHEET_ID, rootSvg)
    sheetInfos.set(ROOT_SHEET_ID, {
      id: ROOT_SHEET_ID,
      label: rootSheet.graph.name || ROOT_SHEET_ID,
      parentId: undefined,
    })
  }

  // Get title from root sheet
  const title = options?.title || rootSheet?.graph.name || 'Network Diagram'

  // Build navigation state
  const navigation: NavigationState = {
    currentSheet: ROOT_SHEET_ID,
    breadcrumb: [ROOT_SHEET_ID],
    sheets: sheetInfos,
  }

  const themeType = rootSheet?.graph.settings?.theme
  return generateHierarchicalHtml(
    sheetSvgs,
    title,
    {
      ...opts,
      navigation,
    } as Required<RenderOptions>,
    themeType,
  )
}

/**
 * Check if graph is a hierarchical graph
 */
function isHierarchicalGraph(graph: NetworkGraph): graph is HierarchicalNetworkGraph {
  return 'sheets' in graph || 'breadcrumb' in graph
}

/**
 * Build navigation state from hierarchical graph
 */
function buildNavigationState(
  graph: HierarchicalNetworkGraph,
  currentSheet?: string,
): NavigationState {
  const sheets = new Map<string, SheetInfo>()

  // Add root
  sheets.set(ROOT_SHEET_ID, {
    id: ROOT_SHEET_ID,
    label: graph.name || 'Overview',
  })

  // Add sheets from subgraphs
  if (graph.subgraphs) {
    for (const subgraph of graph.subgraphs) {
      if (subgraph.file) {
        sheets.set(subgraph.id, {
          id: subgraph.id,
          label: subgraph.label,
          parentId: ROOT_SHEET_ID,
        })
      }
    }
  }

  // Add nested sheets
  if (graph.sheets) {
    for (const [id, sheet] of graph.sheets) {
      if (!sheets.has(id)) {
        sheets.set(id, {
          id,
          label: sheet.name || id,
          parentId: graph.parentSheet,
        })
      }
    }
  }

  // Build breadcrumb
  const breadcrumb = graph.breadcrumb || [ROOT_SHEET_ID]
  if (currentSheet && !breadcrumb.includes(currentSheet)) {
    breadcrumb.push(currentSheet)
  }

  return {
    currentSheet,
    breadcrumb,
    sheets,
  }
}

function generateHtml(
  svg: string,
  title: string,
  options: Required<RenderOptions>,
  themeType?: 'light' | 'dark',
): string {
  const theme = themeType === 'dark' ? darkTheme : lightTheme
  const themeVarsCSS = `:root {\n${generateThemeVars(theme)}\n  }`
  const brandingHtml = options.branding ? getBrandingHtml() : ''
  const toolbarHtml = options.toolbar ? getToolbarHtml(title) : ''

  // Navigation toolbar for hierarchical diagrams
  const navToolbarHtml =
    options.hierarchical && options.navigation ? generateNavigationToolbar(options.navigation) : ''

  // Navigation styles
  const navStyles = options.hierarchical ? getNavigationStyles() : ''

  // Navigation scripts
  const navScript = options.hierarchical ? getNavigationScript() : ''

  // Calculate container height based on toolbar presence
  const headerHeight = options.toolbar ? 45 : 0
  const navHeight = options.hierarchical && options.navigation ? 60 : 0
  const totalHeaderHeight = headerHeight + navHeight
  const containerHeight = totalHeaderHeight > 0 ? `calc(100vh - ${totalHeaderHeight}px)` : '100vh'

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <style>
    ${themeVarsCSS}
    ${getBaseStyles({ containerHeight })}
    ${navStyles}
  </style>
</head>
<body>
  ${toolbarHtml}
  ${navToolbarHtml}
  <div class="container" id="container">
    ${svg}
    ${brandingHtml}
  </div>
  <script>${INTERACTIVE_IIFE}</script>
  <script>
    ${getSimplePanZoomScript()}
  </script>
  <script>${navScript}</script>
</body>
</html>`
}

/**
 * Generate HTML with multiple embedded sheets for hierarchical navigation
 */
function generateHierarchicalHtml(
  sheetSvgs: Map<string, string>,
  title: string,
  options: Required<RenderOptions>,
  themeType?: 'light' | 'dark',
): string {
  const theme = themeType === 'dark' ? darkTheme : lightTheme
  const themeVarsCSS = `:root {\n${generateThemeVars(theme)}\n  }`
  const brandingHtml = options.branding ? getBrandingHtml() : ''
  const toolbarHtml = options.toolbar ? getToolbarHtml(title, { titleId: 'sheet-title' }) : ''

  // Build sheet containers
  const sheetContainers: string[] = []
  for (const [sheetId, svg] of sheetSvgs) {
    const isRoot = sheetId === 'root'
    const display = isRoot ? 'block' : 'none'
    sheetContainers.push(
      `<div class="sheet-container" data-sheet-id="${escapeHtml(sheetId)}" style="display: ${display};">
        ${svg}
      </div>`,
    )
  }

  // Build sheet info JSON for JavaScript
  const sheetInfoJson: Record<string, { label: string; parentId?: string }> = {}
  for (const [id, info] of options.navigation?.sheets || []) {
    sheetInfoJson[id] = { label: info.label, parentId: info.parentId }
  }

  const headerHeight = options.toolbar ? 45 : 0
  const containerHeight = headerHeight > 0 ? `calc(100vh - ${headerHeight}px)` : '100vh'

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <style>
    ${themeVarsCSS}
    ${getBaseStyles({ containerHeight, hierarchical: true })}
  </style>
</head>
<body>
  ${toolbarHtml}
  <div class="container" id="container">
    ${sheetContainers.join('\n    ')}
    ${brandingHtml}
  </div>
  <script>${INTERACTIVE_IIFE}</script>
  <script>
    ${getHierarchicalPanZoomScript(JSON.stringify(sheetInfoJson))}
  </script>
</body>
</html>`
}
