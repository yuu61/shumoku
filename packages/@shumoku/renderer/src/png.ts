/**
 * PNG Renderer
 * Renders NetworkGraph to PNG (Node.js only)
 */

import type { LayoutResult, NetworkGraph } from '@shumoku/core'
import { Resvg } from '@resvg/resvg-js'
import {
  getCDNIconUrl,
  hasCDNIcons,
  resolveAllIconDimensions,
  type CDNConfig,
  type IconDimensions,
} from './cdn-icons.js'
import * as svg from './svg.js'

export interface PngOptions {
  /** Scale factor for output resolution (default: 2) */
  scale?: number
  /** Load system fonts (default: true) */
  loadSystemFonts?: boolean
  /** CDN configuration for icon dimension resolution */
  cdnConfig?: CDNConfig
  /** Pre-resolved icon dimensions (skips fetching if provided) */
  iconDimensions?: Map<string, IconDimensions>
}

/**
 * Collect all icon URLs from a NetworkGraph
 * Must match the URL generation logic in svg.ts calculateIconInfo()
 */
function collectIconUrls(graph: NetworkGraph): string[] {
  const urls = new Set<string>()

  // Collect from nodes
  for (const node of graph.nodes) {
    if (node.icon) {
      urls.add(node.icon)
    } else if (node.vendor && hasCDNIcons(node.vendor)) {
      // Match the same logic as calculateIconInfo in svg.ts
      const iconKey =
        node.service && node.resource
          ? `${node.service}/${node.resource}`
          : node.service || node.model
      if (iconKey) {
        urls.add(getCDNIconUrl(node.vendor, iconKey))
      }
    }
  }

  // Collect from subgraphs (flat structure)
  if (graph.subgraphs) {
    for (const sg of graph.subgraphs) {
      if (sg.icon) {
        urls.add(sg.icon)
      }
    }
  }

  return Array.from(urls)
}

/**
 * Render NetworkGraph to PNG buffer
 * Async version that pre-resolves icon dimensions for correct aspect ratios
 */
export async function render(
  graph: NetworkGraph,
  layout: LayoutResult,
  options: PngOptions = {},
): Promise<Buffer> {
  const scale = options.scale ?? 2
  const loadSystemFonts = options.loadSystemFonts ?? true

  // Use provided dimensions or resolve them
  let iconDimensions = options.iconDimensions
  if (!iconDimensions) {
    const urls = collectIconUrls(graph)
    if (urls.length > 0) {
      iconDimensions = await resolveAllIconDimensions(urls, options.cdnConfig)
    }
  }

  const svgString = svg.render(graph, layout, { iconDimensions })
  const resvg = new Resvg(svgString, {
    fitTo: { mode: 'zoom', value: scale },
    font: { loadSystemFonts },
  })

  return resvg.render().asPng()
}

/**
 * Render NetworkGraph to PNG buffer (sync version)
 * Does not resolve icon dimensions - use for simple graphs without CDN icons
 */
export function renderSync(
  graph: NetworkGraph,
  layout: LayoutResult,
  options: Omit<PngOptions, 'cdnConfig'> = {},
): Buffer {
  const scale = options.scale ?? 2
  const loadSystemFonts = options.loadSystemFonts ?? true

  const svgString = svg.render(graph, layout, { iconDimensions: options.iconDimensions })
  const resvg = new Resvg(svgString, {
    fitTo: { mode: 'zoom', value: scale },
    font: { loadSystemFonts },
  })

  return resvg.render().asPng()
}
