/**
 * SVG Renderer
 * Re-exports from @shumoku/core/renderer with namespace-style API
 */

import type { LayoutResult, NetworkGraph } from '@shumoku/core'
import { SVGRenderer, type SVGRendererOptions } from '@shumoku/core/renderer'

// Re-export for direct usage
export { SVGRenderer, type SVGRendererOptions }

// Namespace-style API
export interface RenderOptions extends SVGRendererOptions {}

/**
 * Render NetworkGraph to SVG string
 */
export function render(
  graph: NetworkGraph,
  layout: LayoutResult,
  options?: RenderOptions,
): string {
  const renderer = new SVGRenderer(options)
  return renderer.render(graph, layout)
}
