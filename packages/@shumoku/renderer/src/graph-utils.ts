/**
 * Shared graph utility functions
 * Used by both pipeline.ts and html/index.ts to avoid circular dependencies
 */

import type { NetworkGraph } from '@shumoku/core'

/**
 * Check if graph has hierarchical content (subgraphs with file/pins)
 */
export function hasHierarchicalContent(graph: NetworkGraph): boolean {
  if ('sheets' in graph || 'breadcrumb' in graph) return true
  if (!graph.subgraphs) return false
  return graph.subgraphs.some((sg) => sg.file || (sg.pins && sg.pins.length > 0))
}
