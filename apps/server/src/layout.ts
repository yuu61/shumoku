/**
 * Bun-compatible layout wrapper
 * Uses web-worker package to make elkjs work in Bun
 */

import ELKApi from 'elkjs/lib/elk-api.js'
import Worker from 'web-worker'
import { createRequire } from 'node:module'
import { HierarchicalLayout, type NetworkGraph, type LayoutResult, type HierarchicalLayoutOptions } from '@shumoku/core'

// Get the path to elk-worker.min.js
const require = createRequire(import.meta.url)
const elkWorkerPath = require.resolve('elkjs/lib/elk-worker.min.js')

/**
 * Create a Bun-compatible ELK instance using web-worker
 */
function createBunElk() {
  return new ELKApi({
    workerFactory: () => new Worker(elkWorkerPath) as never,
  })
}

/**
 * Bun-compatible HierarchicalLayout wrapper
 * Creates a HierarchicalLayout with a Bun-compatible ELK instance
 */
export class BunHierarchicalLayout {
  private layoutInstance: HierarchicalLayout

  constructor(options?: Omit<HierarchicalLayoutOptions, 'elk'>) {
    // Create HierarchicalLayout with Bun-compatible ELK
    this.layoutInstance = new HierarchicalLayout({
      ...options,
      elk: createBunElk(),
    })
  }

  /**
   * Compute layout (wrapper for HierarchicalLayout.layout)
   */
  layout(graph: NetworkGraph): LayoutResult {
    return this.layoutInstance.layout(graph)
  }

  /**
   * Compute layout asynchronously (wrapper for HierarchicalLayout.layoutAsync)
   */
  layoutAsync(graph: NetworkGraph): Promise<LayoutResult> {
    return this.layoutInstance.layoutAsync(graph)
  }
}
